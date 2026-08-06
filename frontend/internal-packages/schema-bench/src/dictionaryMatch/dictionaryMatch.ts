/**
 * Dictionary (Concept) Matching
 *
 * concept ID based matching using
 * a pre-registered dictionary of alias groups. If a reference and
 * a candidate resolve to the same concept, we map them with priority
 * over other strategies.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Mapping from reference name to candidate name.
 * Mutated in place by `dictionaryMatch` to assign matches.
 */
type Mapping = Record<string, string>

/**
 * A single concept entry defined in a dictionary.
 * Represents a stable concept ID and its alias names.
 */
type Concept = {
  /** Stable identifier used as the match key across aliases. */
  id: string
  /** Names/aliases that refer to the same concept (before normalization). */
  aliases: string[]
  /** Optional contextual scope labels (not used by matching currently). */
  scope?: string[]
}

/**
 * On-disk dictionary file shape as parsed from JSON.
 */
type ConceptDictionaryFile = {
  /** List of concept definitions with their aliases. */
  concepts: Concept[]
}

/**
 * In-memory index built from one or more dictionaries for fast lookup.
 */
type ConceptIndex = {
  /** Normalized alias → concept ID. */
  aliasToConcept: Map<string, string>
  /** Concept ID → list of normalized aliases. */
  conceptToAliases: Map<string, string[]>
}

function normalizeAlias(s: string): string {
  // Basic canonicalization: lowercase, split CamelCase, replace non-alnum with underscore, trim underscores
  const camelSplit = s.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  const lowered = camelSplit.toLowerCase()
  const replaced = lowered.replace(/[^a-z0-9]+/g, '_')
  return replaced.replace(/^_+|_+$/g, '')
}

function toTokens(s: string): string[] {
  return normalizeAlias(s).split('_').filter(Boolean)
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = [...a].filter((x) => b.has(x)).length
  const uni = new Set([...a, ...b]).size
  return uni === 0 ? 0 : inter / uni
}

function readJsonFile(filePath: string): ConceptDictionaryFile | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed
  } catch {
    return null
  }
}

/**
 * Load default dictionary shipped with this package.
 */
function loadDefaultConceptDictionary(): ConceptDictionaryFile | null {
  // Resolve relative to this module file so tests/CLI can locate it reliably
  const __dirnameLocal = fileURLToPath(new URL('.', import.meta.url))
  const dictionaryFilePath = path.resolve(
    __dirnameLocal,
    '../dictionaries/global.concepts.json',
  )
  return readJsonFile(dictionaryFilePath)
}

function buildConceptIndex(): ConceptIndex {
  const aliasToConcept = new Map<string, string>()
  const conceptToAliases = new Map<string, string[]>()

  const selectedDictionaries: ConceptDictionaryFile[] = []
  const defaultDictionary = loadDefaultConceptDictionary()
  if (defaultDictionary) {
    selectedDictionaries.push(defaultDictionary)
  } else {
    // Warn so consumers notice dictionary-based matching is disabled
    console.warn(
      '[schema-bench] No concept dictionaries loaded; dictionaryMatch will be a no-op.',
    )
  }

  for (const dictionary of selectedDictionaries) {
    for (const concept of dictionary.concepts) {
      const normalizedAliases = concept.aliases.map((alias) =>
        normalizeAlias(alias),
      )
      conceptToAliases.set(concept.id, normalizedAliases)
      for (const normalizedAlias of normalizedAliases) {
        const existingConceptId = aliasToConcept.get(normalizedAlias)
        if (existingConceptId && existingConceptId !== concept.id) {
          // Keep the first mapping deterministically and warn for visibility
          console.warn(
            `[schema-bench] Duplicate alias "${normalizedAlias}" for concepts "${existingConceptId}" and "${concept.id}". Keeping "${existingConceptId}".`,
          )
          continue
        }
        aliasToConcept.set(normalizedAlias, concept.id)
      }
    }
  }

  return { aliasToConcept, conceptToAliases }
}

function inferConceptByTokens(
  name: string,
  index: ConceptIndex,
): string | null {
  const tokens = toTokens(name)
  const tokenSet = new Set(tokens)
  let best: { id: string; score: number } | null = null
  for (const [id, aliases] of index.conceptToAliases) {
    for (const alias of aliases) {
      const aliasTokens = toTokens(alias)
      const score = jaccard(tokenSet, new Set(aliasTokens))
      if (!best || score > best.score) best = { id, score }
    }
  }
  const threshold = 0.8
  return best && best.score >= threshold ? best.id : null
}

function resolveConceptId(name: string, index: ConceptIndex): string | null {
  const normalized = normalizeAlias(name)
  const conceptByAlias = index.aliasToConcept.get(normalized)
  if (conceptByAlias) return conceptByAlias
  return inferConceptByTokens(name, index)
}

/**
 * Assign predicted names to reference names when they share the same concept.
 *
 * Parameters:
 * - `references`: Reference names to be mapped.
 * - `predictNames`: Predicted names to map from.
 * - `mapping`: Existing partial mapping; respected as-is and extended.
 *
 * Notes:
 * - Each predicted name is used at most once.
 * - References with no resolvable concept remain unmapped.
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: Refactor to reduce complexity
export function dictionaryMatch(
  referenceNames: string[],
  predictNames: string[],
  mapping: Mapping,
): void {
  const localIndex = buildConceptIndex()

  // Track used candidates to avoid duplicates
  const usedPredictNames = new Set(Object.values(mapping))

  // Precompute candidate concepts
  const predictConceptIdByName = new Map<string, string | null>()
  for (const predictName of predictNames) {
    predictConceptIdByName.set(
      predictName,
      resolveConceptId(predictName, localIndex),
    )
  }

  for (const referenceName of referenceNames) {
    if (mapping[referenceName] !== undefined) continue
    const referenceConceptId = resolveConceptId(referenceName, localIndex)
    if (!referenceConceptId) continue

    // Choose the first unused candidate with the same concept; if multiple, prefer higher token overlap
    let bestPredict: { name: string; score: number } | null = null
    for (const predictName of predictNames) {
      if (usedPredictNames.has(predictName)) continue
      const predictConceptId = predictConceptIdByName.get(predictName)
      if (!predictConceptId || predictConceptId !== referenceConceptId) continue
      // Score by token Jaccard
      const similarityScore = jaccard(
        new Set(toTokens(referenceName)),
        new Set(toTokens(predictName)),
      )
      if (!bestPredict || similarityScore > bestPredict.score)
        bestPredict = { name: predictName, score: similarityScore }
    }
    if (bestPredict) {
      mapping[referenceName] = bestPredict.name
      usedPredictNames.add(bestPredict.name)
    }
  }
}
