import type { Indexes as IndexesType } from '@crowfoot/schema'
import { FileText } from '@crowfoot/ui'
import type { FC } from 'react'
import { CollapsibleHeader } from '../CollapsibleHeader'
import { IndexesItem } from './IndexesItem'

type Props = {
  tableId: string
  indexes: IndexesType
}

export const Indexes: FC<Props> = ({ tableId, indexes }) => {
  return (
    <CollapsibleHeader
      title="Indexes #"
      icon={<FileText width={12} />}
      isContentVisible={true}
      // NOTE: Header height for Columns section:
      // 40px (content) + 1px (border) = 41px
      stickyTopHeight={41}
    >
      {Object.entries(indexes).map(([key, index]) => (
        <IndexesItem key={key} tableId={tableId} index={index} />
      ))}
    </CollapsibleHeader>
  )
}
