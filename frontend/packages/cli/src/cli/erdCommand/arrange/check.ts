// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Schema } from '@crowfoot/schema/schema'
import {
  GROUP_BOX_PADDING,
  type Layout,
  TABLE_WIDTH,
  tableHeight,
} from './geometry.js'

type Box = { x: number; y: number; width: number; height: number }

type GroupBox = Box & {
  id: string
  name: string
  /** Members the layout actually placed. A group can have more. */
  placed: number
}

type Overlap = {
  left: string
  right: string
  /** How far the two boxes run into each other, per axis. */
  byX: number
  byY: number
}

type CheckReport = {
  groups: GroupBox[]
  overlaps: Overlap[]
  /**
   * Group members with no position of their own. The viewer places those
   * itself, and the box stretches to reach wherever it put them — so no box
   * here accounts for them.
   */
  unplaced: string[]
}

type CheckParams = {
  schema: Schema
  layout: Layout
  groups: { id: string; name: string; tableNames: string[] }[]
}

/**
 * The box the viewer will draw around a group.
 *
 * Its members' bounding box padded on every side, which is what
 * `padGroupRect` does in erd-core — the box is derived on every render and
 * never stored, so this is the only way to know its size without a browser.
 */
const boxOf = (
  schema: Schema,
  layout: Layout,
  tableNames: string[],
): Box | null => {
  const placed = tableNames
    .map((name) => {
      const point = layout[name]
      if (point === undefined) return null

      const columns = Object.keys(schema.tables[name]?.columns ?? {}).length
      return {
        left: point.x,
        top: point.y,
        right: point.x + TABLE_WIDTH,
        bottom: point.y + tableHeight(columns),
      }
    })
    .filter((bounds) => bounds !== null)

  if (placed.length === 0) return null

  const left = Math.min(...placed.map((b) => b.left)) - GROUP_BOX_PADDING
  const top = Math.min(...placed.map((b) => b.top)) - GROUP_BOX_PADDING
  const right = Math.max(...placed.map((b) => b.right)) + GROUP_BOX_PADDING
  const bottom = Math.max(...placed.map((b) => b.bottom)) + GROUP_BOX_PADDING

  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** How far two boxes run into each other; zero on either axis means they do not. */
const overlapOf = (left: Box, right: Box): { byX: number; byY: number } => ({
  byX:
    Math.min(left.x + left.width, right.x + right.width) -
    Math.max(left.x, right.x),
  byY:
    Math.min(left.y + left.height, right.y + right.height) -
    Math.max(left.y, right.y),
})

/**
 * What a diagram looks like, without looking at one.
 *
 * Two group boxes crossing is the failure that reads as a broken diagram, and
 * the only way to see it used to be to open a browser and measure the DOM. The
 * boxes are derived from the same numbers the viewer derives them from, so a
 * clean report here means a clean diagram there.
 */
export const checkArrangement = ({
  schema,
  layout,
  groups,
}: CheckParams): CheckReport => {
  const boxes: GroupBox[] = []

  for (const group of groups) {
    const box = boxOf(schema, layout, group.tableNames)
    if (box === null) continue

    boxes.push({
      ...box,
      id: group.id,
      name: group.name,
      placed: group.tableNames.filter((name) => layout[name] !== undefined)
        .length,
    })
  }

  const overlaps: Overlap[] = []

  for (const [index, left] of boxes.entries()) {
    for (const right of boxes.slice(index + 1)) {
      const { byX, byY } = overlapOf(left, right)
      if (byX > 0 && byY > 0) {
        overlaps.push({ left: left.id, right: right.id, byX, byY })
      }
    }
  }

  const unplaced = [
    ...new Set(
      groups.flatMap((group) =>
        group.tableNames.filter((name) => layout[name] === undefined),
      ),
    ),
  ].sort()

  return { groups: boxes, overlaps, unplaced }
}
