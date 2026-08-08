// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Edge } from '@xyflow/react'

const sameEnds = (edge: Edge, next: Edge): boolean =>
  edge.source === next.source &&
  edge.target === next.target &&
  edge.sourceHandle === next.sourceHandle &&
  edge.targetHandle === next.targetHandle &&
  edge.data?.['cardinality'] === next.data?.['cardinality']

/**
 * The edge counterpart of `reconcileTableNodes`, and it exists for the same
 * reason: `convertSchemaToNodes` builds a fresh object for every relationship
 * each time it runs, so handing its output straight to `setEdges` re-renders
 * every edge on the diagram to add one column. On a schema with a hundred-odd
 * relationships that is most of the cost of an edit.
 *
 * An edge carries no state of its own worth keeping — the highlight is
 * recomputed on hover — so this only has to hold references still where
 * nothing about the relationship changed.
 *
 * **Returns `current` itself when nothing changed**, which is what stops the
 * effect that drives it from looping.
 */
export const reconcileEdges = (current: Edge[], incoming: Edge[]): Edge[] => {
  if (current.length !== incoming.length) return incoming

  const byId = new Map(current.map((edge) => [edge.id, edge]))
  let changed = false

  const kept = incoming.map((next) => {
    const edge = byId.get(next.id)
    if (!edge || !sameEnds(edge, next)) {
      changed = true
      return next
    }
    return edge
  })

  return changed ? kept : current
}
