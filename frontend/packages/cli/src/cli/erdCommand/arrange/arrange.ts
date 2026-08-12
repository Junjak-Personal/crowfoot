// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Schema } from '@crowfoot/schema/schema'
import { ArgumentError } from '../../errors.js'
import {
  arrangeTables,
  type Layout,
  memoHeight,
  tableHeight,
} from './geometry.js'
import { type Plan, unrelatedTables } from './plan.js'

/**
 * Where the grouped columns start when the schema has tables with no
 * relationships.
 *
 * Those tables are parented to a group the viewer creates and places itself, and
 * nothing here can know where that lands. This clears it. The number was
 * arrived at by rendering the demo and looking — it is the least derived thing
 * in this file, and the open question in the design doc.
 */
const UNRELATED_CLEARANCE = 3100

/** Memo column width, and the gap between columns. */
const MEMO_WIDTH = 1560
const MEMO_GAP = 120
/** How far above the tables the memo band sits. */
const MEMO_BAND_GAP = 200
const DEFAULT_FONT_SIZE = 32

type ArrangeResult = {
  layout: Layout
  groups: { id: string; name: string; color?: string; tableNames: string[] }[]
  memos: {
    id: string
    text: string
    x: number
    y: number
    width: number
    height: number
    color?: string
    fontSize: number
  }[]
  /** Tables the viewer will place itself, so the caller can say so. */
  unplaceable: string[]
}

const checkTablesExist = (schema: Schema, plan: Plan) => {
  const known = new Set(Object.keys(schema.tables))
  const missing = plan.groups
    .flatMap((group) => group.tables)
    .filter((table) => !known.has(table))

  if (missing.length > 0) {
    throw new ArgumentError(
      `The plan names tables that are not in the schema: ${[...new Set(missing)].join(', ')}`,
    )
  }
}

const checkNoDuplicateGroupIds = (plan: Plan) => {
  const seen = new Set<string>()
  for (const group of plan.groups) {
    if (seen.has(group.id)) {
      throw new ArgumentError(`Two groups share the id "${group.id}".`)
    }
    seen.add(group.id)
  }
}

/**
 * Memo ids are derived from position rather than random so that re-running with
 * the same plan produces the same file — a diff of the output should be empty
 * when nothing changed.
 */
const memoId = (index: number): string =>
  `a0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`

/** Lays the memos out in a band above the diagram, wrapping by column count. */
const arrangeMemos = (
  plan: Plan,
  span: { left: number; right: number },
): { memos: ArrangeResult['memos']; height: number } => {
  const entries = plan.memos ?? []
  if (entries.length === 0) return { memos: [], height: 0 }

  const columns = Math.max(
    1,
    Math.floor((span.right - span.left + MEMO_GAP) / (MEMO_WIDTH + MEMO_GAP)),
  )

  const placed: ArrangeResult['memos'] = []
  let column = 0
  let rowTop = 0
  let rowHeight = 0

  entries.forEach((memo, index) => {
    const fontSize = memo.fontSize ?? DEFAULT_FONT_SIZE
    const spanColumns = Math.min(memo.span ?? 1, columns)
    const width = spanColumns * MEMO_WIDTH + (spanColumns - 1) * MEMO_GAP

    if (column + spanColumns > columns) {
      column = 0
      rowTop += rowHeight + MEMO_GAP
      rowHeight = 0
    }

    const height = memoHeight(memo.text, width, fontSize)
    placed.push({
      id: memoId(index),
      text: memo.text,
      x: span.left + column * (MEMO_WIDTH + MEMO_GAP),
      y: rowTop,
      width,
      height,
      ...(memo.color === undefined ? {} : { color: memo.color }),
      fontSize,
    })

    column += spanColumns
    rowHeight = Math.max(rowHeight, height)
  })

  const bandHeight = rowTop + rowHeight
  // Shift the whole band above the tables now that its height is known.
  for (const memo of placed) memo.y -= bandHeight + MEMO_BAND_GAP

  return { memos: placed, height: bandHeight }
}

/**
 * Turns a plan into the three sidecar files, working out every coordinate.
 *
 * Tables with no relationship at all are deliberately absent from the layout:
 * the viewer parents them to a group of its own, and React Flow reads a child's
 * position in the parent's frame, so a coordinate written for one here would be
 * applied somewhere else entirely.
 */
export const arrange = (schema: Schema, plan: Plan): ArrangeResult => {
  checkTablesExist(schema, plan)
  checkNoDuplicateGroupIds(plan)

  const unplaceable = unrelatedTables(schema)
  const skip = new Set(unplaceable)

  const grouped = new Set(plan.groups.flatMap((group) => group.tables))
  const ungrouped = Object.keys(schema.tables).filter(
    (table) => !grouped.has(table) && !skip.has(table),
  )

  const heightOf = (table: string) =>
    tableHeight(Object.keys(schema.tables[table]?.columns ?? {}).length)

  const { layout, span } = arrangeTables({
    // Only the coordinate is withheld from a table with no foreign key. Which
    // group it belongs to is the plan's statement about the schema, and
    // dropping it from `groups.json` threw that away without saying so.
    groups: plan.groups.map((group) => ({
      tables: group.tables.filter((table) => !skip.has(table)),
    })),
    ungrouped,
    heightOf,
    originX: unplaceable.length > 0 ? UNRELATED_CLEARANCE : 0,
  })

  const { memos } = arrangeMemos(plan, span)

  return {
    layout,
    groups: plan.groups.map((group) => ({
      id: group.id,
      name: group.name,
      ...(group.color === undefined ? {} : { color: group.color }),
      tableNames: group.tables,
    })),
    memos,
    unplaceable,
  }
}
