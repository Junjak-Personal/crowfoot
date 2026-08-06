/**
 * Word Overlap Matching Script
 *
 * This script performs lexical similarity matching between reference and candidate names
 * based on word overlap and string similarity. It uses multiple techniques:
 * - Word tokenization and stop word removal
 * - Exact word overlap detection between tokenized names
 *
 * The script is designed to find matches between names that share common words or
 * have high character-level similarity, making it effective for matching variations
 * of the same concept (e.g., "user_profile" vs "UserProfile" or "customer_data" vs "customer_info").
 */
type Mapping = Record<string, string>

/**
 * Simple stop words list
 */
const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'record'])

/**
 * Convert string to word set: tokenize, lowercase, and remove stop words
 */
function toWordSet(str: string): Set<string> {
  // NOTE: This is a simple implementation.
  // Consider handling CamelCase and expanding the stop words list in the future.
  return new Set(
    str
      .toLowerCase()
      .split(/[^a-zA-Z0-9]+/)
      .map((w) => w.trim())
      .filter((w) => w && !STOP_WORDS.has(w)),
  )
}

/**
 * sent_overlap: returns true if two schema names are "sufficiently similar"
 */
function wordOverlap(sent1: string, sent2: string): boolean {
  const wordSet1 = toWordSet(sent1)
  const wordSet2 = toWordSet(sent2)
  if ([...wordSet1].filter((w) => wordSet2.has(w)).length > 0) {
    return true
  }
  return false
}

/**
 * wordOverlapMatch: adds likely matches from Reference to Predict in the mapping
 */
export function wordOverlapMatch(
  references: string[],
  candidates: string[],
  mapping: Mapping,
): void {
  // Track used candidates in a Set for O(1) lookup instead of O(n) Object.values().includes()
  const usedCandidates = new Set(Object.values(mapping))

  for (const referenceName of references) {
    if (!(referenceName in mapping)) {
      for (const predictName of candidates) {
        if (!usedCandidates.has(predictName)) {
          if (wordOverlap(referenceName, predictName)) {
            mapping[referenceName] = predictName
            usedCandidates.add(predictName)
            break
          }
        }
      }
    }
  }
}
