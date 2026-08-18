// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import {
  applyDiff,
  deserializeDiff,
  diffRecords,
  type RecordDiff,
  serializeDiff,
} from '../../../../utils/recordDiff'
import type { TableNodeType } from '../../types'
import { readEditParam } from '../urlEdits'
import { isViewColorKey, type ViewColorKey } from '../viewColor'

/**
 * A human-authored, view-only grouping of tables. Groups never affect foreign
 * keys, relationship edges or any export output.
 *
 * **A table belongs to at most one group.** The box a group draws is derived
 * from its members' bounding box every render, so a shared table forces two
 * boxes to cross and makes dragging either one deform the other; `erd arrange`
 * cannot place a shared table in two columns either, and quietly gives it the
 * last one, stretching the first group's box across the diagram. Overlapping
 * domains are expressed by picking one grouping, not by sharing tables.
 */
export type Group = {
  id: string
  name: string
  tableNames: string[]
  color?: ViewColorKey | undefined
}

/** Groups shipped with the build (groups.json), set by the host app. */
let baseGroups: Group[] = []

const readColor = (entry: object): ViewColorKey | undefined =>
  'color' in entry && isViewColorKey(entry.color) ? entry.color : undefined

/**
 * `tableNames` is deduplicated within one entry (`['a','a']` -> `['a']`), so
 * that a repeated mention is not mistaken for anything. Across entries is
 * `claimEachTableOnce`'s job. A non-string name inside the array is dropped
 * rather than failing the whole entry, matching the per-entry, best-effort
 * salvage every other sidecar field gets.
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
const parseGroupList = (value: unknown): Group[] => {
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

/**
 * Enforces one group per table: the first group that names it keeps it, every
 * later one loses it, and a group left with nothing is dropped.
 *
 * First-wins rather than last-wins to match the duplicate-id rule right below,
 * and because `groups.json` order is the order the author wrote — the earlier
 * entry is the one they reached for first.
 *
 * A group with no members is not representable in `groups.json` (`parseGroups`
 * discards it), so keeping one here would make the canvas and a reloaded
 * `?groups=` disagree.
 *
 * This runs on every read rather than only on write because `groups.json`
 * files authored before 0.4.2, and links made against them, can still name a
 * table twice. Resolving that the same way everywhere is what keeps the
 * canvas, the sidebar and an export agreeing on which group owns a table.
 */
export const claimEachTableOnce = (groups: Group[]): Group[] => {
  const claimed = new Set<string>()
  const result: Group[] = []

  for (const group of groups) {
    const tableNames = group.tableNames.filter((name) => !claimed.has(name))
    if (tableNames.length === 0) continue

    for (const name of tableNames) claimed.add(name)
    result.push(
      tableNames.length === group.tableNames.length
        ? group
        : { ...group, tableNames },
    )
  }

  return result
}

export const parseGroups = (value: unknown): Group[] =>
  claimEachTableOnce(parseGroupList(value))

/**
 * The host app calls `setBaseGroups` from the sidecar fetch, which resolves
 * *after* the first render. Everything under the ERD's `schemaKey` remount
 * picks the new value up for free; LeftPane lives outside that key, so without
 * a notification it would cache the empty pre-fetch value for the life of the
 * page — the sidebar would stay flat however many groups groups.json declares.
 */
const baseGroupsListeners = new Set<() => void>()

export const setBaseGroups = (groups: Group[]): void => {
  baseGroups = groups
  baseGroupsListeners.forEach((notify) => {
    notify()
  })
}

/**
 * Snapshot for `useSyncExternalStore`: the same reference until `setBaseGroups`
 * replaces it, which is what stops the subscription from looping.
 */
export const getBaseGroups = (): Group[] => baseGroups

export const subscribeBaseGroups = (notify: () => void): (() => void) => {
  baseGroupsListeners.add(notify)
  return () => {
    baseGroupsListeners.delete(notify)
  }
}

export type GroupDiff = RecordDiff<Group>

/**
 * Groups travel in the URL as one JSON blob rather than a compact field list,
 * exactly like memos: `name` is free-form text that would be shredded by a
 * comma-joined list, and the value is compressed before it reaches the query
 * string.
 *
 * What travels is the *difference* from `groups.json`, not the whole set — see
 * `RecordDiff`. A link that renames one group says only that, so redeploying
 * `groups.json` still reaches everyone holding one.
 */
export const serializeGroups = (base: Group[], next: Group[]): string =>
  serializeDiff(diffRecords(base, next))

export const deserializeGroups = (raw: string): GroupDiff | null =>
  deserializeDiff(raw, parseGroup)

/**
 * What shipped with the build, plus whatever the link changed. `null` from the
 * link means "the link said nothing", which is not the same as a link that
 * deliberately empties every group.
 *
 * `base` defaults to the module value for callers that remount when it lands.
 * A caller that does not remount passes the value it subscribed to, so React
 * sees the dependency it has to recompute on.
 *
 * Every reader of a group — canvas boxes, sidebar sections, the export — comes
 * through here, which is what makes it the one place one-group-per-table has
 * to hold. A link can still hand a table to a second group even when the base
 * is clean, so the rule is applied *after* the diff, not only at parse.
 */
export const getEffectiveGroups = (
  urlDiff: GroupDiff | null = null,
  base: Group[] = baseGroups,
): Group[] => claimEachTableOnce(applyDiff(base, urlDiff))

/** Snapshot for committing as groups.json, for the console helper. */
export const dumpGroups = (): Group[] =>
  getEffectiveGroups(deserializeGroups(readEditParam('groups')))

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
   * `sections` flattened. Each table appears once, because each is in one
   * section. This is the group-view `nodes` prop for `TableNameMenuButton` —
   * shift-range selection indexes into it, so its order must match the visual
   * render order.
   */
  flattenedUnique: TableNodeType[]
  /**
   * Every table exactly once, alphabetical — today's list. This is both the
   * single-view render source AND the source of every `(n/m visible)` count
   * in both modes.
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
 * Sections tables by the groups that name them, each table in exactly one
 * section — the first group that names it, "Ungrouped" for the rest.
 *
 * The `claimed` set makes that structural rather than a precondition on the
 * caller: everything upstream already comes through `getEffectiveGroups`, but
 * this is exported and pure, and a second section repeating a table would give
 * the sidebar two rows for it and throw off the shift-range indexing into
 * `flattenedUnique`.
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

  // First-wins on a repeated `group.id`, identical to `parseGroups`: the
  // sidebar keys its section elements on `section.group?.id ?? 'ungrouped'`,
  // so two sections sharing an id would produce duplicate React keys.
  const seenGroupIds = new Set<string>()
  const claimed = new Set<string>()
  const groupSections: TablePartitionSection[] = []

  for (const group of groups) {
    if (seenGroupIds.has(group.id)) continue
    seenGroupIds.add(group.id)

    const memberIds = new Set(group.tableNames)
    const nodes = flat.filter(
      (node) => memberIds.has(node.id) && !claimed.has(node.id),
    )
    if (nodes.length === 0) continue

    for (const node of nodes) claimed.add(node.id)
    groupSections.push({ group, nodes })
  }

  const sectioned = groupSections.length > 0
  if (!sectioned) {
    return { sectioned: false, sections: [], flattenedUnique: [], flat }
  }

  const ungroupedNodes = flat.filter((node) => !claimed.has(node.id))
  const sections: TablePartitionSection[] =
    ungroupedNodes.length > 0
      ? [...groupSections, { group: null, nodes: ungroupedNodes }]
      : groupSections

  return {
    sectioned,
    sections,
    flattenedUnique: sections.flatMap((section) => section.nodes),
    flat,
  }
}
