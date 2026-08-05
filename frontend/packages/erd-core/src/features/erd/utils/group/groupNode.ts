// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node, Rect } from '@xyflow/react'
import { zIndex } from '../../constants'
import type { TableGroupNodeType } from '../../types'
import type { Group } from './group'

export const isTableGroupNode = (node: Node): node is TableGroupNodeType =>
  node.type === 'tableGroup'

/**
 * Table node ids ARE table names (see convertSchemaToNodes.ts), so an
 * unprefixed group id could collide with a table and corrupt React Flow's
 * `nodeLookup`. The real id lives in `data.groupId` — recover it from there,
 * never by parsing this prefix back off.
 */
const nodeId = (groupId: string): string => `tableGroup:${groupId}`

/**
 * `groups.json` and `?groups=` keep the flat record; the canvas wants a
 * node. `position` here is a placeholder, never source of truth — the box's
 * real geometry is derived every render from its members' bounding box (see
 * `resolveGroupMemberIds` / `padGroupRect` below and `TableGroupNode.tsx`),
 * which is what keeps a stored box from ever drifting out of sync with the
 * tables it wraps.
 *
 * `measured: { width: 0, height: 0 }` is required, not a placeholder to
 * trim: an entirely UNmeasured node makes React Flow report
 * `nodesInitialized: false` forever, which permanently breaks `fitView` (the
 * Zoom-to-Fit button and the initial framing both die). A MEASURED zero is
 * initialised and still excluded from `fitView`'s bounds. This leans on
 * React Flow 12.8.6 internals (`adoptUserNodes`, `nodeHasDimensions`,
 * `getFitViewNodes`, the `visibility` line in `NodeWrapper`) that a future
 * major version must re-verify — see the plan's follow-up list.
 */
export const groupToNode = (group: Group): TableGroupNodeType => ({
  id: nodeId(group.id),
  type: 'tableGroup',
  position: { x: 0, y: 0 },
  measured: { width: 0, height: 0 },
  draggable: false,
  selectable: false,
  zIndex: zIndex.tableGroupBox,
  data: {
    groupId: group.id,
    name: group.name,
    tableNames: group.tableNames,
    color: group.color,
  },
})

export const nodeToGroup = (node: TableGroupNodeType): Group => ({
  id: node.data.groupId,
  name: node.data.name,
  tableNames: node.data.tableNames,
  color: node.data.color,
})

/** Group nodes on the canvas, in the shape `groups.json` is written in. */
export const groupsFromNodes = (nodes: Node[]): Group[] =>
  nodes.filter(isTableGroupNode).map(nodeToGroup)

export const tableGroupNodesFrom = (groups: Group[]): TableGroupNodeType[] =>
  groups.map(groupToNode)

const isMeasured = (node: Node): boolean =>
  node.measured?.width !== undefined && node.measured?.height !== undefined

/**
 * Which member table ids should feed `getNodesBounds` for this group this
 * render, or `null` if the box should not be drawn at all.
 *
 * Never returns `[]`: `getNodesBounds([])` returns a zero rect at the flow
 * origin, and an unrecognised id, an all-hidden group, or an unmeasured
 * member would otherwise merge a box at (0, 0) into the layout instead of
 * being skipped. All three guards below (member absent, hidden, unmeasured)
 * return `null` instead of an empty array.
 */
export const resolveGroupMemberIds = (
  tableNames: string[],
  nodes: Node[],
): string[] | null => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  const visible: Node[] = []
  for (const tableName of tableNames) {
    const node = nodeById.get(tableName)
    if (!node || node.hidden) continue
    visible.push(node)
  }

  if (visible.length === 0) return null
  // Render nothing until every visible member reports a size — a box drawn
  // around only the already-measured members would be just as wrong as the
  // box snapping from a point to full size once the rest arrive.
  if (visible.some((node) => !isMeasured(node))) return null

  return visible.map((node) => node.id)
}

/** How far the box extends past its members' bounding box, on every side. */
export const GROUP_BOX_PADDING = 24

export const padGroupRect = (rect: Rect): Rect => ({
  x: rect.x - GROUP_BOX_PADDING,
  y: rect.y - GROUP_BOX_PADDING,
  width: rect.width + GROUP_BOX_PADDING * 2,
  height: rect.height + GROUP_BOX_PADDING * 2,
})
