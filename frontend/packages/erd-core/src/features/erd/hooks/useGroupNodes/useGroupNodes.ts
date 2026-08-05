// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { useCallback } from 'react'
import { useUserEditingOrThrow } from '../../../../stores'
import { groupsFromNodes, saveStoredGroups, serializeGroups } from '../../utils'

/**
 * Groups live in React Flow's node state, which is what gives them
 * selection, multi-selection and dragging (via the members' own multi-
 * select drag) for free. Browser storage and the shareable link are mirrors
 * of that state, refreshed whenever an edit settles — the group counterpart
 * of useMemoNodes.
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

      const groups = groupsFromNodes(next)
      saveStoredGroups(groups)
      setGroupEntries(serializeGroups(groups))
    },
    [getNodes, setNodes, setGroupEntries],
  )

  return { commitGroups }
}
