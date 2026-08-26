// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@crowfoot/ui'
import type { NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import type { FC } from 'react'
import { useLodTier, useShowMode } from '../../../../hooks'
import type { TableNodeType } from '../../../../types'
import { useErdContentContext } from '../../ErdContentContext'
import { TableColumnList } from './TableColumnList'
import { TableHeader } from './TableHeader'
import styles from './TableNode.module.css'

type Props = NodeProps<TableNodeType>

export const TableNode: FC<Props> = ({ data }) => {
  const showMode = useShowMode(data.showMode)
  const {
    state: { groupedTables },
  } = useErdContentContext()
  const tier = useLodTier()
  const name = data?.table?.name

  /**
   * Zoomed out this far a group draws for its members, and drawing them too
   * says the same thing twice at the size where there is least room for it.
   *
   * Hidden rather than unmounted: the group's box is its members' bounding box,
   * so a member that stopped taking up space would move the label that replaced
   * it. `visibility` keeps the measurement and takes the pixels — and the
   * pointer with them, so there is nothing invisible left to click.
   */
  const spokenFor = tier === 'group' && groupedTables.has(name)

  return (
    <TooltipProvider>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <div
            className={clsx(
              styles.wrapper,
              spokenFor && styles.spokenFor,
              data.color && styles.wrapperTinted,
              data.isHighlighted && styles.wrapperHighlighted,
              data.isActiveHighlighted && styles.wrapperActive,
            )}
            data-view-color={data.color}
            data-erd={
              (data.isHighlighted || data.isActiveHighlighted) &&
              'table-node-highlighted'
            }
          >
            <TableHeader data={data} />
            {showMode === 'ALL_FIELDS' && <TableColumnList data={data} />}
            {showMode === 'KEY_ONLY' && (
              <TableColumnList data={data} filter="KEY_ONLY" />
            )}
          </div>
        </TooltipTrigger>

        <TooltipPortal>
          <TooltipContent
            side={'top'}
            sideOffset={4}
            hidden={!data.isTooltipVisible}
          >
            {name}
          </TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  )
}
