// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { useCallback } from 'react'
import { type EditWrite, useUserEditingOrThrow } from '../../../../stores'
import {
  getBaseMemos,
  isMemoNode,
  memosFromNodes,
  serializeMemos,
} from '../../utils'

/**
 * Memos live in React Flow's node state, which is what gives them selection,
 * multi-selection, dragging and resizing for free. The link is refreshed
 * whenever an edit settles, and carries only the difference from `memos.json`.
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
    (change: (nodes: Node[]) => Node[], write?: EditWrite) => {
      const next = change(getNodes())
      setNodes(next)

      setMemoEntries(
        serializeMemos(getBaseMemos(), memosFromNodes(next)),
        write,
      )
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
