// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import type { Node } from '@xyflow/react'
import type { ElkNode } from 'elkjs'

/**
 * A table draws its own size, so it is handed back to React Flow to measure.
 *
 * React Flow honours an explicit `width`/`height` instead of measuring, and
 * ELK echoes back the sizes it was handed — so a table carried the size it had
 * when the layout ran for as long as it stayed on the canvas. It could not
 * shrink once its columns were hidden, nor widen for a name set larger, which
 * is how a zoomed-out diagram ended up as tall boxes with their names cut
 * short. `reconcileTableNodes` already drops both for the same reason after a
 * schema edit; this is the other half of it.
 *
 * The non-related-tables container is the exception: it is an empty box whose
 * only size is the one ELK gives it.
 */
const place = (node: Node, elkNode: ElkNode): Node => {
  const position = { x: elkNode.x ?? 0, y: elkNode.y ?? 0 }

  if (node.type !== 'table') {
    return {
      ...node,
      position,
      width: elkNode.width ?? 0,
      height: elkNode.height ?? 0,
    }
  }

  // Dropped rather than left alone: a table placed by an earlier layout is
  // still carrying that one's size.
  const { width: _pinnedWidth, height: _pinnedHeight, ...carried } = node

  return { ...carried, position }
}

export function convertElkNodesToNodes(
  elkNodes: ElkNode[],
  originNodes: Node[],
): Node[] {
  const nodes: Node[] = []
  for (const elkNode of elkNodes) {
    const originNode = originNodes.find((node) => node.id === elkNode.id)
    if (!originNode) continue

    nodes.push(place(originNode, elkNode))

    if (elkNode.children) {
      for (const child of elkNode.children) {
        nodes.push(...convertElkNodesToNodes([child], originNodes))
      }
    }
  }

  return nodes
}
