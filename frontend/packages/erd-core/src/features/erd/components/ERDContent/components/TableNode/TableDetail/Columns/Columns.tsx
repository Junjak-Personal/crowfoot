import type { Table } from '@crowfoot/schema'
import { Rows3 as Rows3Icon } from '@crowfoot/ui'
import type { FC } from 'react'
import { CollapsibleHeader } from '../CollapsibleHeader'
import { ColumnsItem } from './ColumnsItem'

type Props = {
  table: Table
}

export const Columns: FC<Props> = ({ table }) => {
  return (
    <CollapsibleHeader
      title="Columns"
      icon={<Rows3Icon width={12} />}
      isContentVisible={true}
      stickyTopHeight={0}
    >
      {Object.entries(table.columns).map(([key, column]) => (
        <ColumnsItem
          key={key}
          tableId={table.name}
          column={column}
          constraints={table.constraints}
        />
      ))}
    </CollapsibleHeader>
  )
}
