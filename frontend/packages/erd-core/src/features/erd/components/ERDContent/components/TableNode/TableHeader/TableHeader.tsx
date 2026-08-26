// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import { Table2 } from '@crowfoot/ui'
import { Handle, Position } from '@xyflow/react'
import clsx from 'clsx'
import { type FC, type MouseEvent, useMemo } from 'react'
import { match } from 'ts-pattern'
import {
  useSchemaOrThrow,
  useUserEditingOrThrow,
} from '../../../../../../../stores'
import { DiffIcon } from '../../../../../../diff/components/DiffIcon'
import diffStyles from '../../../../../../diff/styles/Diff.module.css'
import { useCustomReactflow } from '../../../../../../reactflow/hooks'
import { useShowMode } from '../../../../../hooks'
import type { TableNodeData } from '../../../../../types'
import { columnHandleId } from '../../../../../utils'
import { getChangeStatus } from './getChangeStatus'
import styles from './TableHeader.module.css'

type Props = {
  data: TableNodeData
}

export const TableHeader: FC<Props> = ({ data }) => {
  const name = data.table.name
  const { showDiff } = useUserEditingOrThrow()

  const { operations } = useSchemaOrThrow()
  const showMode = useShowMode(data.showMode)

  /** The columns something points at — one handle each, as in the column list. */
  const targetColumnNames = Object.keys(data.targetColumnCardinalities ?? {})

  // Only calculate diff-related values when showDiff is true
  const changeStatus = useMemo(() => {
    if (!showDiff) return undefined
    return getChangeStatus({
      tableId: name,
      operations: operations ?? [],
    })
  }, [showDiff, name, operations])

  const diffStyle = useMemo(() => {
    if (!showDiff || !changeStatus) return undefined
    return match(changeStatus)
      .with('added', () => diffStyles.addedBg)
      .with('removed', () => diffStyles.removedBg)
      .with('modified', () => diffStyles.modifiedBg)
      .otherwise(() => undefined)
  }, [showDiff, changeStatus])

  const { updateNode } = useCustomReactflow()

  const handleHoverEvent = (event: MouseEvent<HTMLSpanElement>) => {
    // Get computed styles to check if text is truncated
    const element = event.currentTarget
    // Create a range to measure the text
    const range = document.createRange()
    range.selectNodeContents(element)

    // Get the text width using getBoundingClientRect
    const textWidth = range.getBoundingClientRect().width
    const containerWidth = element.getBoundingClientRect().width
    const isTruncated = textWidth > containerWidth + 0.018

    updateNode(name, {
      data: {
        ...data,
        isTooltipVisible: isTruncated,
      },
    })
  }

  return (
    <div
      className={clsx(
        styles.wrapper,
        showMode === 'TABLE_NAME' && styles.wrapperTableNameMode,
        data.color && styles.wrapperTinted,
      )}
      data-view-color={data.color}
    >
      {showDiff && changeStatus && (
        <div
          className={clsx(
            styles.diffBox,
            showMode === 'TABLE_NAME' && styles.diffBoxTableNameMode,
            diffStyle,
          )}
        >
          <DiffIcon changeStatus={changeStatus} />
        </div>
      )}

      <div
        className={clsx(
          styles.container,
          showMode === 'TABLE_NAME' && styles.containerTableNameMode,
          showDiff && styles.containerDiffView,
          showDiff && diffStyle,
        )}
      >
        <Table2 className={styles.tableIcon} />

        <span className={styles.name} onMouseEnter={handleHoverEvent}>
          {name}
        </span>

        {/*
          The column rows are gone in this mode, and their handles with them —
          so the header carries the same handle *ids* instead, collapsed onto
          its own edges. Naming them after the columns rather than the table is
          what lets the zoom drop a canvas into this mode without rebuilding a
          single edge: an edge drawn to `orders.user_id` still finds its end.
          Nothing reads a table-named handle, so there is no second set.
        */}
        {showMode === 'TABLE_NAME' && (
          <>
            {targetColumnNames.map((columnName) => (
              <Handle
                key={columnName}
                id={columnHandleId(name, columnName)}
                type="target"
                position={Position.Left}
                className={styles.handle}
              />
            ))}
            {data.sourceColumnName !== undefined && (
              <Handle
                id={columnHandleId(name, data.sourceColumnName)}
                type="source"
                position={Position.Right}
                className={styles.handle}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
