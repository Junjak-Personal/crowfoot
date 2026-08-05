// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { type NodeProps, useNodes, useReactFlow } from '@xyflow/react'
import clsx from 'clsx'
import {
  type FC,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useUserEditingOrThrow } from '../../../../../../stores'
import { useCommitTablePositions } from '../../../../hooks'
import type { TableGroupNodeType } from '../../../../types'
import { padGroupRect, resolveGroupMemberIds } from '../../../../utils'
import styles from './TableGroupNode.module.css'

type Props = NodeProps<TableGroupNodeType>

/**
 * How far the pointer may travel before the gesture stops being a click.
 * Measured in screen pixels, not flow units: at 200% zoom a flow-space
 * threshold would fire after half the visible movement, so "how far I twitched"
 * would mean something different at every zoom level.
 */
const DRAG_THRESHOLD_PX = 3

type DragState = {
  pointerId: number
  /** Pointer position in flow coordinates when the gesture started. */
  origin: { x: number; y: number }
  /** Screen position, for the click/drag threshold only. */
  screenOrigin: { x: number; y: number }
  /** Member positions at gesture start; every move is applied against these. */
  starts: Map<string, { x: number; y: number }>
  moved: boolean
}

/**
 * A dashed backdrop wrapping its member tables (RISK-1 candidate B, the
 * mechanism the plan settled on): position and size are recomputed every
 * render from the members' live bounding box and never written back into
 * node state. That is what makes a `setNodes` -> `onNodesChange` feedback
 * loop structurally absent, and lets the box track a drag for free — the
 * trade-off is that `fitView` never frames it, which is accepted (`fitView`
 * should frame tables).
 *
 * Known limitation (UI/UX ruling 4): React Flow writes `zIndex` and
 * `transform` inline on the node wrapper, and each of those starts its own
 * stacking context. That pins this whole subtree — box AND header — at
 * z-index -1 with no CSS escape, so a non-member table sitting in the
 * header's strip paints over the label. The group's own members are safe
 * (the padding band keeps them clear of the header); this is accepted, not
 * fixed, per the plan §5.2.
 */
export const TableGroupNode: FC<Props> = ({ data }) => {
  const { showGroups, editMode } = useUserEditingOrThrow()
  const nodes = useNodes()
  const { getNodesBounds, setNodes, getNodes, screenToFlowPosition } =
    useReactFlow()
  const commitTablePositions = useCommitTablePositions()

  const drag = useRef<DragState | null>(null)
  const [dragging, setDragging] = useState(false)

  const memberIds = useMemo(
    () => resolveGroupMemberIds(data.tableNames, nodes),
    [data.tableNames, nodes],
  )

  const rect = useMemo(() => {
    if (memberIds === null) return null
    return padGroupRect(getNodesBounds(memberIds))
  }, [memberIds, getNodesBounds])

  /**
   * Replaces the selection with the group's members (F9) — React Flow's own
   * `node.selected`, never `userEditing.selectedNodeIds`. The two selection
   * systems stay independent by design; this never touches the sidebar's.
   */
  const selectMembers = useCallback(() => {
    if (memberIds === null) return

    const members = new Set(memberIds)
    setNodes((current) =>
      current.map((node) => ({ ...node, selected: members.has(node.id) })),
    )
  }, [memberIds, setNodes])

  /**
   * Dragging the label moves the member *tables*; the box follows because it
   * is derived from their bounds. Nothing about the group itself is stored, so
   * this adds no state and no `setNodes` -> `onNodesChange` loop.
   *
   * A member that also belongs to another group moves too, and that group's
   * box stretches to keep containing it. Groups are a view over tables and the
   * tables are the truth, so a visible stretch beats silently leaving a member
   * behind.
   */
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!editMode || memberIds === null || event.button !== 0) return

      const members = new Set(memberIds)
      const starts = new Map(
        getNodes()
          .filter((node) => members.has(node.id))
          .map((node) => [node.id, { ...node.position }]),
      )

      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = {
        pointerId: event.pointerId,
        origin: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        screenOrigin: { x: event.clientX, y: event.clientY },
        starts,
        moved: false,
      }
    },
    [editMode, memberIds, getNodes, screenToFlowPosition],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const state = drag.current
      if (state === null || state.pointerId !== event.pointerId) return

      if (!state.moved) {
        const travelled = Math.hypot(
          event.clientX - state.screenOrigin.x,
          event.clientY - state.screenOrigin.y,
        )
        if (travelled < DRAG_THRESHOLD_PX) return

        state.moved = true
        setDragging(true)
        // Same end state as a plain header click, so a drag and a click leave
        // the selection looking alike.
        selectMembers()
      }

      const pointer = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      const dx = pointer.x - state.origin.x
      const dy = pointer.y - state.origin.y

      setNodes((current) =>
        current.map((node) => {
          const start = state.starts.get(node.id)
          if (start === undefined) return node
          // Members parented to NON_RELATED_TABLE_GROUP_NODE_ID hold relative
          // positions. A delta is a translation, so it is correct against both
          // absolute and relative coordinates as long as the parent stays put.
          return { ...node, position: { x: start.x + dx, y: start.y + dy } }
        }),
      )
    },
    [screenToFlowPosition, setNodes, selectMembers],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const state = drag.current
      if (state === null || state.pointerId !== event.pointerId) return

      drag.current = null
      setDragging(false)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      // Under the threshold the gesture was a click; `onClick` handles it.
      if (!state.moved) return

      commitTablePositions(
        getNodes().filter((node) => state.starts.has(node.id)),
      )
    },
    [getNodes, commitTablePositions],
  )

  // A drag ends with a click too, and that click re-selects exactly what the
  // drag already selected — so `onClick` needs no "was that a drag?" guard.

  // Single view (RISK-3's "before measurement" case is the same shape as
  // "toggled off": nothing to draw yet).
  if (!showGroups || rect === null) return null

  return (
    <div
      className={clsx(styles.box, data.color && styles.tinted)}
      data-view-color={data.color}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    >
      <button
        type="button"
        className={styles.header}
        data-draggable={editMode}
        data-dragging={dragging}
        aria-label={
          data.name
            ? `Select tables in group ${data.name}`
            : 'Select tables in unnamed group'
        }
        onClick={selectMembers}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span className={styles.chip}>{data.name}</span>
      </button>
    </div>
  )
}
