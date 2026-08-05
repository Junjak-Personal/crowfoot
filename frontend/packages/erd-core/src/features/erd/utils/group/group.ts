// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { TableNodeType } from '../../types'
import { isViewColorKey, type ViewColorKey } from '../viewColor'

/**
 * A human-authored, view-only grouping of tables. Groups never affect foreign
 * keys, relationship edges or any export output. A table may belong to
 * several groups — overlap, not nesting.
 */
export type Group = {
  id: string
  name: string
  tableNames: string[]
  color?: ViewColorKey | undefined
}

const STORAGE_KEY = 'liam:groups'

/** Groups shipped with the build (groups.json), set by the host app. */
let baseGroups: Group[] = []

const readColor = (entry: object): ViewColorKey | undefined =>
  'color' in entry && isViewColorKey(entry.color) ? entry.color : undefined

/**
 * `tableNames` is deduplicated within one entry (`['a','a']` -> `['a']`): the
 * invariant `partitionTablesByGroup` relies on is "N *groups* name this
 * table", not "N mentions inside one group". A non-string name inside the
 * array is dropped rather than failing the whole entry, matching the
 * per-entry, best-effort salvage every other sidecar field gets.
 */
const readTableNames = (entry: object): string[] | null => {
  if (!('tableNames' in entry) || !Array.isArray(entry.tableNames)) return null

  const names = entry.tableNames.filter(
    (name): name is string => typeof name === 'string',
  )
  if (names.length === 0) return null

  return Array.from(new Set(names))
}

const parseGroup = (entry: unknown): Group | null => {
  if (typeof entry !== 'object' || entry === null) return null
  if (!('id' in entry) || typeof entry.id !== 'string' || entry.id === '') {
    return null
  }
  if (!('name' in entry) || typeof entry.name !== 'string') return null

  const tableNames = readTableNames(entry)
  if (tableNames === null) return null

  return {
    id: entry.id,
    name: entry.name,
    tableNames,
    color: readColor(entry),
  }
}

/**
 * Total — never throws. A throw here would surface inside the CLI's
 * `ResultAsync.combine(...).map(...).andThen(...).match(ok, err)` chain as an
 * unhandled rejection in which neither `match` branch runs, leaving the ERD
 * permanently blank with no error UI from one malformed `groups.json`. Every
 * check below is `typeof` / `Array.isArray` / `in`, none of which can throw
 * on a `JSON.parse`-derived value — do not replace this with `v.parse`.
 */
export const parseGroups = (value: unknown): Group[] => {
  if (!Array.isArray(value)) return []

  // A `Set`, not `record[group.id] = ...`: `id: "__proto__"` is a valid
  // parsed id (a non-empty string), and a plain-object key would suffer a
  // local prototype swap that silently breaks the duplicate check for it.
  const seen = new Set<string>()
  const groups: Group[] = []

  for (const entry of value) {
    const group = parseGroup(entry)
    if (group === null || seen.has(group.id)) continue

    seen.add(group.id)
    groups.push(group)
  }

  return groups
}

export const setBaseGroups = (groups: Group[]): void => {
  baseGroups = groups
}

/**
 * Local edits replace groups.json wholesale rather than merging into it, for
 * the same reason memos do (see memo.ts): merging would make deletions
 * inexpressible, and groups are few enough that a full working copy is cheap.
 */
export const loadStoredGroups = (): Group[] | null => {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return parseGroups(JSON.parse(raw))
  } catch {
    return null
  }
}

export const saveStoredGroups = (groups: Group[]): void => {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
  } catch {
    // Storage full or blocked; edits just won't survive a reload.
  }
}

export const clearStoredGroups = (): void => {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Best-effort reset only.
  }
}

/**
 * Groups travel in the URL as one JSON blob rather than a compact field list,
 * exactly like memos: `name` is free-form text that would be shredded by a
 * comma-joined list, and the value is compressed before it reaches the query
 * string.
 */
export const serializeGroups = (groups: Group[]): string =>
  JSON.stringify(groups)

export const deserializeGroups = (raw: string): Group[] | null => {
  if (raw === '') return null

  try {
    return parseGroups(JSON.parse(raw))
  } catch {
    return null
  }
}

/**
 * A shared link wins, then the local working copy, then what shipped with the
 * build. `null` from the link means "the link said nothing", which is not the
 * same as a link that deliberately carries zero groups.
 */
export const getEffectiveGroups = (urlGroups: Group[] | null = null): Group[] =>
  urlGroups ?? loadStoredGroups() ?? baseGroups

/** Snapshot for committing as groups.json. */
export const dumpGroups = (): Group[] => getEffectiveGroups()

/** One section of the sidebar list — a named group, or `null` for "Ungrouped". */
export type TablePartitionSection = {
  group: Group | null
  nodes: TableNodeType[]
}

export type TablePartition = {
  /**
   * `false` when there is no group data to show — either no groups were
   * authored, or every authored group's members were all dropped at render
   * time. The sidebar must render its plain flat list in this case, in BOTH
   * view modes, never a stray "Ungrouped" header.
   */
  sectioned: boolean
  /** Group sections in `groups.json` order, "Ungrouped" last. `[]` when `!sectioned`. */
  sections: TablePartitionSection[]
  /**
   * `sections` flattened, deduplicated to first appearance. This is the
   * group-view `nodes` prop for `TableNameMenuButton` — shift-range selection
   * indexes into it, so its order must match the visual render order.
   */
  flattenedUnique: TableNodeType[]
  /**
   * Every table exactly once, alphabetical — today's list. This is both the
   * single-view render source AND the source of every `(n/m visible)` count
   * in both modes, so a duplicated group-view row is never double-counted.
   */
  flat: TableNodeType[]
}

const compareTableNodes = (a: TableNodeType, b: TableNodeType): number => {
  const nameA = a.data.table.name
  const nameB = b.data.table.name
  if (nameA < nameB) return -1
  if (nameA > nameB) return 1
  return 0
}

/**
 * Sections tables by the groups that name them. A table may surface in
 * several sections (multi-group membership) and always lands in `flat`
 * exactly once, however many groups claim it.
 *
 * There is deliberately no `claimed` set that removes a table from
 * consideration once it is placed in one group — `groupedIds` below only
 * ever records "has a group at all", which is what makes "Ungrouped" its
 * complement rather than a leftover, and is what lets the same table appear
 * in every group that names it.
 *
 * Sections are built by iterating `groups` directly and pushing onto an
 * array — never by indexing an object or Map keyed on `group.id` — so a
 * crafted `id: "__proto__"` cannot collide with anything or make a section
 * silently vanish.
 */
export const partitionTablesByGroup = (
  tableNodes: TableNodeType[],
  groups: Group[],
): TablePartition => {
  const flat = [...tableNodes].sort(compareTableNodes)

  // First-wins on a repeated `group.id`, identical to `parseGroups`. Callers
  // today only ever pass already-deduped `parseGroups` output, but this
  // function is exported and pure — without this, a caller that didn't
  // dedupe would get two sections sharing one id, and the sidebar keys its
  // section elements on `section.group?.id ?? 'ungrouped'`, so that would
  // produce duplicate React keys. This makes section-id uniqueness
  // structural instead of a caller-trust precondition.
  const seenGroupIds = new Set<string>()
  const groupedIds = new Set<string>()
  const groupSections: TablePartitionSection[] = []

  for (const group of groups) {
    if (seenGroupIds.has(group.id)) continue
    seenGroupIds.add(group.id)

    const memberIds = new Set(group.tableNames)
    const nodes = flat.filter((node) => memberIds.has(node.id))
    if (nodes.length === 0) continue

    for (const node of nodes) groupedIds.add(node.id)
    groupSections.push({ group, nodes })
  }

  const sectioned = groupSections.length > 0
  if (!sectioned) {
    return { sectioned: false, sections: [], flattenedUnique: [], flat }
  }

  const ungroupedNodes = flat.filter((node) => !groupedIds.has(node.id))
  const sections: TablePartitionSection[] =
    ungroupedNodes.length > 0
      ? [...groupSections, { group: null, nodes: ungroupedNodes }]
      : groupSections

  const seen = new Set<string>()
  const flattenedUnique: TableNodeType[] = []
  for (const section of sections) {
    for (const node of section.nodes) {
      if (seen.has(node.id)) continue
      seen.add(node.id)
      flattenedUnique.push(node)
    }
  }

  return { sectioned, sections, flattenedUnique, flat }
}
