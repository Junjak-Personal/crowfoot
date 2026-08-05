// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import type { Edge, Node } from '@xyflow/react'
import { getElkLayout } from './getElkLayout'

export const computeAutoLayout = async (nodes: Node[], edges: Edge[]) => {
  /** Kept out of the layout pass and re-appended unchanged. */
  const untouchedNodes: Node[] = []
  const visibleNodes: Node[] = []
  for (const node of nodes) {
    // Memos sit wherever the user put them, and group boxes are derived from
    // their members rather than laid out themselves. Handing either to ELK
    // would let the automatic layout rearrange notes placed by hand, or
    // recompute a geometry that isn't real, so both are split out here the
    // same way hidden nodes are.
    if (node.hidden || node.type === 'memo' || node.type === 'tableGroup') {
      untouchedNodes.push(node)
    } else {
      visibleNodes.push(node)
    }
  }

  // NOTE: Only include edges where both the source and target are in the nodes
  const nodeMap = new Map(visibleNodes.map((node) => [node.id, node]))
  const visibleEdges = edges.filter((edge) => {
    return nodeMap.get(edge.source) && nodeMap.get(edge.target)
  })

  const newNodes = await getElkLayout({
    nodes: visibleNodes,
    edges: visibleEdges,
  })

  return {
    nodes: [...untouchedNodes, ...newNodes],
    edges,
  }
}
