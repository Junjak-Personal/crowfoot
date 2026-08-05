// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { type NodeProps, useNodes, useReactFlow } from '@xyflow/react'
import clsx from 'clsx'
import { type FC, useCallback, useMemo } from 'react'
import { useUserEditingOrThrow } from '../../../../../../stores'
import type { TableGroupNodeType } from '../../../../types'
import { padGroupRect, resolveGroupMemberIds } from '../../../../utils'
import styles from './TableGroupNode.module.css'

type Props = NodeProps<TableGroupNodeType>

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
  const { showGroups } = useUserEditingOrThrow()
  const nodes = useNodes()
  const { getNodesBounds, setNodes } = useReactFlow()

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
  const handleHeaderClick = useCallback(() => {
    if (memberIds === null) return

    const members = new Set(memberIds)
    setNodes((current) =>
      current.map((node) => ({ ...node, selected: members.has(node.id) })),
    )
  }, [memberIds, setNodes])

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
        aria-label={
          data.name
            ? `Select tables in group ${data.name}`
            : 'Select tables in unnamed group'
        }
        onClick={handleHeaderClick}
      >
        <span className={styles.chip}>{data.name}</span>
      </button>
    </div>
  )
}
