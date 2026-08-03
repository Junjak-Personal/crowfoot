import type { Node } from '@xyflow/react'

export type TablePosition = { x: number; y: number }
export type TableLayout = Record<string, TablePosition>

const STORAGE_KEY = 'liam:tableLayout'

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

export const parseTableLayout = (value: unknown): TableLayout => {
  if (typeof value !== 'object' || value === null) return {}

  const layout: TableLayout = {}
  for (const [tableName, position] of Object.entries(value)) {
    if (isTablePosition(position)) {
      layout[tableName] = { x: position.x, y: position.y }
    }
  }

  return layout
}

const toTableLayout = (nodes: Node[]): TableLayout => {
  const layout: TableLayout = {}
  for (const node of nodes) {
    layout[node.id] = { x: node.position.x, y: node.position.y }
  }
  return layout
}

export const setBaseTableLayout = (layout: TableLayout): void => {
  baseLayout = layout
}

export const loadStoredTableLayout = (): TableLayout => {
  if (typeof localStorage === 'undefined') return {}

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.removeItem(STORAGE_KEY)
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

/** layout.json is the base, per-browser edits win, a shared link wins over both. */
export const getEffectiveTableLayout = (
  urlLayout: TableLayout = {},
): TableLayout => ({
  ...baseLayout,
  ...loadStoredTableLayout(),
  ...urlLayout,
})

/** Tables absent from the layout keep the position they already have. */
export const applyTableLayout = (nodes: Node[], layout: TableLayout): Node[] =>
  nodes.map((node) => {
    const position = layout[node.id]
    return position ? { ...node, position } : node
  })

export const setResolvedTableLayout = (nodes: Node[]): void => {
  resolvedLayout = toTableLayout(nodes)
}

/**
 * Persist the tables the user just dragged, leaving the rest untouched.
 * Returns every locally moved table so the caller can mirror it into the URL.
 */
export const rememberTablePositions = (nodes: Node[]): TableLayout => {
  const moved = toTableLayout(nodes)
  resolvedLayout = { ...resolvedLayout, ...moved }

  const stored = { ...loadStoredTableLayout(), ...moved }
  saveStoredTableLayout(stored)

  return stored
}

/** Snapshot for committing as layout.json. */
export const dumpTableLayout = (): TableLayout => ({ ...resolvedLayout })
