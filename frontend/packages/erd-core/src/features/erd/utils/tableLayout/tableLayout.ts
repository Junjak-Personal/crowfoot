// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node } from '@xyflow/react'
import { readStoredItem, removeStoredItem } from '../storage'
import { isViewColorKey, type ViewColorKey } from '../viewColor'

/**
 * Per-table view state. Position and colour live together because they are the
 * same kind of thing — how this table is presented — and share one sidecar
 * file, one storage key and one dump.
 */
export type TablePosition = {
  x: number
  y: number
  color?: ViewColorKey | undefined
}
export type TableLayout = Record<string, TablePosition>

const STORAGE_KEY = 'erdkit:tableLayout'
/** Read once, then migrated away — see `readStoredItem`. */
const LEGACY_STORAGE_KEY = 'liam:tableLayout'

/**
 * Canonical layout shipped with the build (layout.json), set by the host app.
 * Overridden per-browser by whatever the user drags around.
 */
let baseLayout: TableLayout = {}

/**
 * Positions currently rendered on screen. Kept so the canonical layout.json can
 * be dumped without asking the user to drag every table first.
 */
let resolvedLayout: TableLayout = {}

const isTablePosition = (value: unknown): value is TablePosition => {
  if (typeof value !== 'object' || value === null) return false
  if (!('x' in value) || !('y' in value)) return false

  return typeof value.x === 'number' && typeof value.y === 'number'
}

const readColor = (value: object): ViewColorKey | undefined => {
  if (!('color' in value)) return undefined
  return isViewColorKey(value.color) ? value.color : undefined
}

export const parseTableLayout = (value: unknown): TableLayout => {
  if (typeof value !== 'object' || value === null) return {}

  const layout: TableLayout = {}
  for (const [tableName, position] of Object.entries(value)) {
    if (isTablePosition(position)) {
      layout[tableName] = {
        x: position.x,
        y: position.y,
        color: readColor(position),
      }
    }
  }

  return layout
}

/**
 * Merge positions from the canvas into an existing layout, keeping whatever
 * colour each table already had — dragging a table must not reset its colour.
 */
const mergeNodePositions = (
  layout: TableLayout,
  nodes: Node[],
): TableLayout => {
  const merged: TableLayout = { ...layout }
  for (const node of nodes) {
    merged[node.id] = {
      ...merged[node.id],
      x: node.position.x,
      y: node.position.y,
    }
  }
  return merged
}

export const setBaseTableLayout = (layout: TableLayout): void => {
  baseLayout = layout
}

export const loadStoredTableLayout = (): TableLayout => {
  if (typeof localStorage === 'undefined') return {}

  try {
    const raw = readStoredItem(STORAGE_KEY, LEGACY_STORAGE_KEY)
    if (!raw) return {}
    return parseTableLayout(JSON.parse(raw))
  } catch {
    // Corrupted or unreadable storage falls back to the canonical layout.
    return {}
  }
}

const saveStoredTableLayout = (layout: TableLayout): void => {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // Storage full or blocked; positions just won't survive a reload.
  }
}

export const clearStoredTableLayout = (): void => {
  try {
    removeStoredItem(STORAGE_KEY, LEGACY_STORAGE_KEY)
  } catch {
    // Nothing to do; the caller only asked for a best-effort reset.
  }
}

/**
 * Compact `name:x:y` form. Only the tables the user actually moved are
 * encoded, so a shared link stays short: everything else is reproduced from
 * layout.json and the deterministic auto-layout.
 */
export const serializeTableLayout = (layout: TableLayout): string[] =>
  Object.entries(layout).map(
    ([tableName, { x, y }]) => `${tableName}:${Math.round(x)}:${Math.round(y)}`,
  )

export const deserializeTableLayout = (entries: string[]): TableLayout => {
  const layout: TableLayout = {}

  for (const entry of entries) {
    // Split from the right; a table name may itself contain ':'.
    const ySeparator = entry.lastIndexOf(':')
    if (ySeparator <= 0) continue
    const xSeparator = entry.lastIndexOf(':', ySeparator - 1)
    if (xSeparator <= 0) continue

    const tableName = entry.slice(0, xSeparator)
    const x = Number(entry.slice(xSeparator + 1, ySeparator))
    const y = Number(entry.slice(ySeparator + 1))
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue

    layout[tableName] = { x, y }
  }

  return layout
}

/**
 * Colours ride in their own URL entry (`name:colorkey`) rather than being
 * appended to the position entry: the position codec stays exactly as it was,
 * and a table can be coloured without ever having been moved.
 */
export const serializeTableColors = (layout: TableLayout): string[] =>
  Object.entries(layout)
    .filter(([, entry]) => entry.color !== undefined)
    .map(([tableName, entry]) => `${tableName}:${entry.color}`)

export const deserializeTableColors = (
  entries: string[],
): Record<string, ViewColorKey> => {
  const colors: Record<string, ViewColorKey> = {}

  for (const entry of entries) {
    // Split from the right; a table name may itself contain ':'.
    const separator = entry.lastIndexOf(':')
    if (separator <= 0) continue

    const color = entry.slice(separator + 1)
    if (!isViewColorKey(color)) continue

    colors[entry.slice(0, separator)] = color
  }

  return colors
}

/**
 * layout.json is the base, per-browser edits win, a shared link wins over both.
 *
 * Colours from the link are kept out of this map on purpose: an entry here
 * pins a position, and a table that was only recoloured must not be dragged to
 * (0, 0). Use `resolveTableColor` for the colour of a single table.
 */
export const getEffectiveTableLayout = (
  urlLayout: TableLayout = {},
): TableLayout => ({
  ...baseLayout,
  ...loadStoredTableLayout(),
  ...urlLayout,
})

export const resolveTableColor = (
  tableName: string,
  layout: TableLayout,
  urlColors: Record<string, ViewColorKey>,
): ViewColorKey | undefined => urlColors[tableName] ?? layout[tableName]?.color

/** Tables absent from the layout keep the position they already have. */
export const applyTableLayout = (nodes: Node[], layout: TableLayout): Node[] =>
  nodes.map((node) => {
    const entry = layout[node.id]
    if (!entry) return node

    return { ...node, position: { x: entry.x, y: entry.y } }
  })

/**
 * Memos and group boxes are React Flow nodes too, so everything that writes a
 * layout has to say "tables only" — otherwise a memo or group id would end up
 * in layout.json as if it were a table, and stay there. Filtering on
 * `type === 'table'` already excludes group nodes (`type: 'tableGroup'`)
 * automatically; no separate check is needed here.
 */
const tableNodesOnly = (nodes: Node[]): Node[] =>
  nodes.filter((node) => node.type === 'table')

export const setResolvedTableLayout = (nodes: Node[]): void => {
  resolvedLayout = mergeNodePositions(
    getEffectiveTableLayout(),
    tableNodesOnly(nodes),
  )
}

/**
 * Persist the tables the user just dragged, leaving the rest untouched.
 * Returns every locally stored table so the caller can mirror it into the URL.
 */
export const rememberTablePositions = (nodes: Node[]): TableLayout => {
  const tables = tableNodesOnly(nodes)
  resolvedLayout = mergeNodePositions(resolvedLayout, tables)

  const stored = mergeNodePositions(loadStoredTableLayout(), tables)
  saveStoredTableLayout(stored)

  return stored
}

/** Colour is stored alongside the position, in the same layout entry. */
export const setTableColor = (
  tableName: string,
  color: ViewColorKey | null,
): void => {
  const current = resolvedLayout[tableName] ??
    getEffectiveTableLayout()[tableName] ?? { x: 0, y: 0 }
  const next = { ...current, color: color ?? undefined }

  resolvedLayout = { ...resolvedLayout, [tableName]: next }
  saveStoredTableLayout({
    ...loadStoredTableLayout(),
    [tableName]: next,
  })
}

export const getTableColor = (tableName: string): ViewColorKey | undefined =>
  resolvedLayout[tableName]?.color

/** Snapshot for committing as layout.json. */
export const dumpTableLayout = (): TableLayout => ({ ...resolvedLayout })
