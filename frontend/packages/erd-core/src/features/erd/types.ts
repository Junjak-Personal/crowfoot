// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import type { Cardinality, Table } from '@liam-hq/schema'
import type { Node } from '@xyflow/react'
import type { ShowMode } from '../../schemas/showMode/types'
import type { ViewColorKey } from './utils/viewColor'

export type TableNodeData = {
  table: Table
  isActiveHighlighted: boolean
  isHighlighted: boolean
  isTooltipVisible: boolean
  sourceColumnName: string | undefined
  targetColumnCardinalities?:
    | Record<string, Cardinality | undefined>
    | undefined
  showMode?: ShowMode | undefined
  /** User-assigned tint, kept in node data so the node re-renders on change. */
  color?: ViewColorKey | undefined
}

export type TableNodeType = Node<TableNodeData, 'table'>

export type DisplayArea = 'main' | 'relatedTables'
