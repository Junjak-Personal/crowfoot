// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node } from '@xyflow/react'
import { isTableNode } from '../../../utils'

/**
 * The canvas table ids that `visibleTableIds` does not cover — the value
 * `?hidden=` is written from, which the docs define as "hidden table names".
 *
 * Scoped to table nodes: the canvas also carries memo and group nodes, and an
 * unfiltered pass put their ids into `?hidden=` as if they were tables, the
 * same leak already closed in `hideAllNodes` and `showSelectedTables`.
 */
export const tableIdsToHide = (
  nodes: Node[],
  visibleTableIds: string[],
): string[] => {
  const visible = new Set(visibleTableIds)

  return nodes
    .filter(isTableNode)
    .filter((node) => !visible.has(node.id))
    .map((node) => node.id)
}
