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
import type { Plan } from './plan.js'

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

/**
 * A table belongs to one group. Two groups naming it cannot both be honoured:
 * `arrangeTables` packs each group into its own column and writes one position
 * per table, so the second column silently wins and the first group's box
 * stretches across the diagram to reach a table that is no longer in it.
 *
 * Rejected rather than resolved, because this file is what an agent writes:
 * quietly picking a group would teach it that the plan meant something it did
 * not. The viewer, which has to open files that already exist, resolves
 * instead — see `claimEachTableOnce`.
 */
const checkNoSharedTables = (plan: Plan) => {
  const owner = new Map<string, string>()

  for (const group of plan.groups) {
    for (const table of group.tables) {
      const first = owner.get(table)
      if (first !== undefined && first !== group.id) {
        throw new ArgumentError(
          `The plan puts "${table}" in two groups, "${first}" and "${group.id}". A table belongs to one group.`,
        )
      }
      owner.set(table, group.id)
    }
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
 * Every table gets a coordinate, including the ones with no relationship at
 * all. Those used to be left out: the viewer parents them to a container of
 * its own and React Flow reads a child's position in the parent's frame, so a
 * coordinate written here landed a container's offset away. The viewer takes a
 * table out of that container the moment something places it, so writing one
 * is now the way to say where it goes.
 */
export const arrange = (schema: Schema, plan: Plan): ArrangeResult => {
  checkTablesExist(schema, plan)
  checkNoDuplicateGroupIds(plan)
  checkNoSharedTables(plan)

  const grouped = new Set(plan.groups.flatMap((group) => group.tables))
  const ungrouped = Object.keys(schema.tables).filter(
    (table) => !grouped.has(table),
  )

  const heightOf = (table: string) =>
    tableHeight(Object.keys(schema.tables[table]?.columns ?? {}).length)

  const { layout, span } = arrangeTables({
    groups: plan.groups.map((group) => ({ tables: group.tables })),
    ungrouped,
    heightOf,
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
  }
}
