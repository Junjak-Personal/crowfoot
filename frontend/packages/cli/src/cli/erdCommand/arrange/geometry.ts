// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.

/**
 * Everything here is measured off the rendered viewer, not derived. Change the
 * table styling and these drift silently — `geometry.test.ts` pins the two that
 * erd-core owns as constants, and `docs/` records the rest.
 */

/** Table node width at every show mode. */
export const TABLE_WIDTH = 340
/** Table header height, above the first column row. */
const TABLE_HEADER = 52
/** One column row, at `show=all`. */
const TABLE_ROW = 34

/** Gap between two tables stacked in the same column. */
const STACK_GAP = 40
/** Gap between the two columns inside one group. */
const COLUMN_GAP = 40

/**
 * Gap between neighbouring groups.
 *
 * The floor is twice `GROUP_BOX_PADDING` (24 in erd-core): a group's box extends
 * that far past its members on every side, so two groups closer than 48 have
 * boxes that visibly overlap. This is well above the floor because the boxes
 * carry a name label and butting them together reads as one region.
 */
export const GROUP_BOX_PADDING = 24
export const MIN_GROUP_GAP = GROUP_BOX_PADDING * 2
const GROUP_GAP = 340

/**
 * Three or fewer tables read better in one column; two columns leaves a wide,
 * mostly empty box.
 */
const SINGLE_COLUMN_MAX = 3
/**
 * Tables per column beyond that, and the ceiling on columns.
 *
 * Fixing every block at two columns makes a big one a ribbon: the fifteen
 * `estimate_*` tables in the schema this was tested against stacked eight deep
 * and set the height of the whole diagram. Widening the big blocks squares it
 * up without spreading the small ones out.
 */
const COLUMN_DEPTH = 5
const MAX_COLUMNS = 4

const columnCountFor = (tableCount: number): number =>
  tableCount <= SINGLE_COLUMN_MAX
    ? 1
    : Math.min(MAX_COLUMNS, Math.max(2, Math.ceil(tableCount / COLUMN_DEPTH)))

type Point = { x: number; y: number }
export type Layout = Record<string, Point>

export const tableHeight = (columnCount: number): number =>
  TABLE_HEADER + columnCount * TABLE_ROW

/**
 * Stacks a group's tables into one or two columns and reports how wide the
 * result is, so the caller can place the next group clear of it.
 */
const packGroup = (
  tables: string[],
  heightOf: (table: string) => number,
  originX: number,
): { layout: Layout; width: number } => {
  const columns = columnCountFor(tables.length)
  const layout: Layout = {}
  const nextY: number[] = Array.from({ length: columns }, () => 0)

  // Into whichever column is currently shortest, so a block of tall and short
  // tables comes out level rather than lopsided.
  for (const table of tables) {
    let shortest = 0
    for (let column = 1; column < columns; column++) {
      if ((nextY[column] ?? 0) < (nextY[shortest] ?? 0)) shortest = column
    }

    layout[table] = {
      x: originX + shortest * (TABLE_WIDTH + COLUMN_GAP),
      y: nextY[shortest] ?? 0,
    }
    nextY[shortest] = (nextY[shortest] ?? 0) + heightOf(table) + STACK_GAP
  }

  return {
    layout,
    width: columns * TABLE_WIDTH + (columns - 1) * COLUMN_GAP,
  }
}

type ArrangedTables = {
  layout: Layout
  /** Left and right edge of everything placed, for putting memos above it. */
  span: { left: number; right: number }
}

/**
 * Lays groups out left to right, each packed into its own column or pair of
 * columns, and appends anything the plan did not group as one more block.
 *
 * `originX` exists because a schema with relationship-less tables gets a group
 * box the viewer places itself, and grouped columns have to start clear of it —
 * see `ORPHAN_CLEARANCE` at the call site.
 */
export const arrangeTables = ({
  groups,
  ungrouped,
  heightOf,
  originX,
}: {
  groups: { tables: string[] }[]
  ungrouped: string[]
  heightOf: (table: string) => number
  originX: number
}): ArrangedTables => {
  const layout: Layout = {}
  let x = originX

  const blocks =
    ungrouped.length > 0 ? [...groups, { tables: ungrouped }] : groups

  for (const block of blocks) {
    if (block.tables.length === 0) continue

    const packed = packGroup(block.tables, heightOf, x)
    Object.assign(layout, packed.layout)
    x += packed.width + GROUP_GAP
  }

  return {
    layout,
    // The last group added a trailing gap that nothing occupies.
    span: { left: originX, right: Math.max(originX, x - GROUP_GAP) },
  }
}

/**
 * Text metrics, measured rather than computed: the viewer has no monospace and
 * no way to ask it from here.
 *
 * A line at font size F takes about `F * 0.62` per character, and a rendered
 * line occupies about `F * 1.55`. A memo hides whatever does not fit — its
 * overflow is hidden and `scrollHeight` reports the clipped height — so both of
 * these round up, and a margin is added on top.
 */
const CHAR_WIDTH_RATIO = 0.62
const LINE_HEIGHT_RATIO = 1.55
const MEMO_BREATHING = 64

export const memoLineCapacity = (width: number, fontSize: number): number =>
  Math.max(1, Math.floor(width / (fontSize * CHAR_WIDTH_RATIO)))

/**
 * How tall a memo has to be for none of `text` to be cut off, counting the
 * lines the viewer will wrap it onto rather than only the ones it was written
 * with.
 */
export const memoHeight = (
  text: string,
  width: number,
  fontSize: number,
): number => {
  const capacity = memoLineCapacity(width, fontSize)
  const lines = text
    .split('\n')
    .reduce(
      (total, line) => total + Math.max(1, Math.ceil(line.length / capacity)),
      0,
    )

  return Math.ceil(lines * fontSize * LINE_HEIGHT_RATIO) + MEMO_BREATHING
}
