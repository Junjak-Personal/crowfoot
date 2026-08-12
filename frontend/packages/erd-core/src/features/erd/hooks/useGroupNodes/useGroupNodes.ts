// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { useCallback } from 'react'
import { useUserEditingOrThrow } from '../../../../stores'
import { getBaseGroups, groupsFromNodes, serializeGroups } from '../../utils'

/**
 * Groups live in React Flow's node state, which is what gives them
 * selection, multi-selection and dragging (via the members' own multi-
 * select drag) for free. The link is refreshed whenever an edit settles, and
 * carries only the difference from `groups.json` — the group counterpart of
 * useMemoNodes.
 */
export const useGroupNodes = () => {
  const { getNodes, setNodes } = useReactFlow()
  const { setGroupEntries } = useUserEditingOrThrow()

  /**
   * Applies a change to the canvas and mirrors the result in one step.
   *
   * The next node list is computed up front rather than read back
   * afterwards: React Flow queues `setNodes` and flushes it in a layout
   * effect, so reading the store straight after would still see the old
   * nodes.
   */
  const commitGroups = useCallback(
    (change: (nodes: Node[]) => Node[]) => {
      const next = change(getNodes())
      setNodes(next)

      setGroupEntries(serializeGroups(getBaseGroups(), groupsFromNodes(next)))
    },
    [getNodes, setNodes, setGroupEntries],
  )

  return { commitGroups }
}
