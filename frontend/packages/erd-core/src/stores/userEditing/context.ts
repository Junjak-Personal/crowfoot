// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import { createContext } from 'react'
import type { TableNodeType } from '../../features/erd/types'
import type { ShowMode } from '../../schemas'

export type UserEditingContextValue = {
  // URL synchronized state
  activeTableName: string | null
  setActiveTableName: (tableName: string | null) => void

  focusedElementId: string

  showMode: ShowMode
  setShowMode: (showMode: ShowMode | null) => void

  hiddenNodeIds: string[]
  setHiddenNodeIds: (nodeIds: string[] | null) => void
  toggleHiddenNodeId: (nodeId: string) => void

  /** Compact `name:x:y` entries for the tables the user has moved. */
  tablePositions: string[]
  setTablePositions: (positions: string[] | null) => void

  /** Compact `name:colorkey` entries for tables the user has tinted. */
  tableColors: string[]
  setTableColors: (colors: string[] | null) => void

  /** Compressed JSON of every memo, so a link reproduces them exactly. */
  memoEntries: string
  setMemoEntries: (memos: string | null) => void

  /** `?edit=1` — memos can be created, edited and moved only in this mode. */
  editMode: boolean

  // Local state
  selectedNodeIds: Set<string>
  updateSelectedNodeIds: (
    nodeId: string,
    isMultiSelect: 'ctrl' | 'shift' | 'single',
    nodes: TableNodeType[],
  ) => void
  resetSelectedNodeIds: () => void
  isPopstateInProgress: boolean
  setIsPopstateInProgress: (isPopstateInProgress: boolean) => void
  showDiff: boolean
  setShowDiff: (showDiff: boolean) => void
}

export const UserEditingContext = createContext<UserEditingContextValue | null>(
  null,
)
