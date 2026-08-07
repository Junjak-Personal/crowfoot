// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node, XYPosition } from '@xyflow/react'

/** Same value as ELK's `elk.layered.spacing.baseValue`, so a settled gap
 *  matches one the automatic layout would have produced. */
export const SETTLE_GAP = 40

type Params = {
  nodes: Node[]
  /** Tables that just got taller. These are the anchors and never move. */
  grownIds: Set<string>
  gap?: number
}

/** A table's box in absolute space, whatever frame its position is stored in. */
type Box = {
  id: string
  left: number
  right: number
  top: number
  height: number
}

const ORIGIN: XYPosition = { x: 0, y: 0 }

/** One level of nesting is all this canvas has: the non-related group box. */
const parentOffsets = (nodes: Node[]) => {
  const positions = new Map(nodes.map((node) => [node.id, node.position]))

  return (node: Node): XYPosition =>
    (node.parentId ? positions.get(node.parentId) : undefined) ?? ORIGIN
}

const measuredBoxes = (
  nodes: Node[],
  offsetOf: (node: Node) => XYPosition,
): Box[] =>
  nodes.flatMap((node) => {
    if (node.type !== 'table' || node.hidden) return []

    const { width, height } = node.measured ?? {}
    if (width === undefined || height === undefined) return []

    const offset = offsetOf(node)
    return [
      {
        id: node.id,
        left: node.position.x + offset.x,
        right: node.position.x + offset.x + width,
        top: node.position.y + offset.y,
        height,
      },
    ]
  })

/**
 * Whether `box` has to move out of the way of `anchor` — it is in the same
 * column, it did not start above the anchor, and it is inside the clearance.
 */
const isInTheWay = (anchor: Box, box: Box, clearance: number): boolean =>
  box.top >= anchor.top &&
  box.right > anchor.left &&
  box.left < anchor.right &&
  box.top < clearance

/** Moves everything `anchor` is now in the way of clear of it, and says which. */
const pushBelow = (
  anchor: Box,
  boxes: Box[],
  grownIds: Set<string>,
  gap: number,
): Box[] => {
  const clearance = anchor.top + anchor.height + gap

  return boxes.filter((box) => {
    // A pushed table becomes an anchor on the next pass, so this has to exclude
    // itself explicitly — `grownIds` only covers the first round.
    if (box.id === anchor.id || grownIds.has(box.id)) return false
    if (!isInTheWay(anchor, box, clearance)) return false

    box.top = clearance
    return true
  })
}

/**
 * ELK lays this diagram out with `elk.algorithm: layered` in its default
 * left-to-right direction, so tables stack into vertical columns and a table
 * that grows can only ever run into what is **below** it. That is why this
 * pushes along one axis and never sideways.
 *
 * Nothing is ever pulled up, and nothing outside the path of a table that grew
 * is touched: a deliberate overlap the user dragged into place stays put.
 */
export const settleOverlaps = ({
  nodes,
  grownIds,
  gap = SETTLE_GAP,
}: Params): Node[] => {
  if (grownIds.size === 0) return nodes

  const offsetOf = parentOffsets(nodes)
  const boxes = measuredBoxes(nodes, offsetOf)
  const moved = new Map<string, number>()

  let frontier = boxes.filter((box) => grownIds.has(box.id))
  // Every step can only push a table further down, so this terminates; the
  // bound is a backstop, not the exit condition.
  for (let pass = 0; pass <= boxes.length && frontier.length > 0; pass++) {
    frontier = frontier.flatMap((anchor) =>
      pushBelow(anchor, boxes, grownIds, gap),
    )
    for (const box of frontier) moved.set(box.id, box.top)
  }

  if (moved.size === 0) return nodes

  return nodes.map((node) => {
    const top = moved.get(node.id)
    if (top === undefined) return node

    return {
      ...node,
      position: { x: node.position.x, y: top - offsetOf(node).y },
    }
  })
}
