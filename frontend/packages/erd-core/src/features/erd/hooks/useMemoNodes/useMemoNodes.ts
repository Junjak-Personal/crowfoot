// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { useCallback } from 'react'
import { useUserEditingOrThrow } from '../../../../stores'
import {
  isMemoNode,
  memosFromNodes,
  saveStoredMemos,
  serializeMemos,
} from '../../utils'

/**
 * Memos live in React Flow's node state, which is what gives them selection,
 * multi-selection, dragging and resizing for free. Browser storage and the
 * shareable link are mirrors of that state, refreshed whenever an edit settles.
 */
export const useMemoNodes = () => {
  const { getNodes, setNodes } = useReactFlow()
  const { setMemoEntries } = useUserEditingOrThrow()

  /**
   * Applies a change to the canvas and mirrors the result in one step.
   *
   * The next node list is computed up front rather than read back afterwards:
   * React Flow queues `setNodes` and flushes it in a layout effect, so reading
   * the store straight after would still see the old nodes.
   */
  const commitMemos = useCallback(
    (change: (nodes: Node[]) => Node[]) => {
      const next = change(getNodes())
      setNodes(next)

      const memos = memosFromNodes(next)
      saveStoredMemos(memos)
      setMemoEntries(serializeMemos(memos))
    },
    [getNodes, setNodes, setMemoEntries],
  )

  /** The memos React Flow currently has selected. */
  const selectedMemos = useCallback(
    () =>
      getNodes()
        .filter(isMemoNode)
        .filter((node) => node.selected),
    [getNodes],
  )

  return { commitMemos, selectedMemos }
}
