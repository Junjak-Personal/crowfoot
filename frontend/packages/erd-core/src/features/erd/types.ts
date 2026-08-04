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

/**
 * Memos are React Flow nodes so that selecting, multi-selecting, dragging and
 * resizing them is React Flow's job rather than ours. Position and size live on
 * the node itself; only the note's own attributes go in `data`.
 */
type MemoNodeData = {
  text: string
  color?: ViewColorKey | undefined
  fontSize?: number | undefined
}

export type MemoNodeType = Node<MemoNodeData, 'memo'>

export type DisplayArea = 'main' | 'relatedTables'
