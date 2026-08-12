// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import { createContext } from 'react'
import type { TableNodeType } from '../../features/erd/types'
import type { ShowMode } from '../../schemas'

/**
 * How an edit write should land in the back button.
 *
 * `transient` is for a write that is part of a gesture still in progress —
 * typing into a memo, where one history entry per character would make the
 * back button useless. The gesture pushes once when it finishes.
 */
export type EditWrite = { transient?: boolean }

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
  setTablePositions: (positions: string[] | null, write?: EditWrite) => void

  /** Compact `name:colorkey` entries for tables the user has tinted. */
  tableColors: string[]
  setTableColors: (colors: string[] | null, write?: EditWrite) => void

  /** Compressed JSON of the memos a link changed, against memos.json. */
  memoEntries: string
  setMemoEntries: (memos: string | null, write?: EditWrite) => void

  /** Compressed JSON of the groups a link changed, against groups.json. */
  groupEntries: string
  setGroupEntries: (groups: string | null, write?: EditWrite) => void

  /**
   * Group view (boxes + labels on the canvas, sections in the sidebar) vs
   * single view (today's flat list, every table once) — `?showgroups=`.
   */
  showGroups: boolean
  setShowGroups: (showGroups: boolean | null) => void

  /** `?edit=1` — memos can be created, edited and moved only in this mode. */
  editMode: boolean
  setEditMode: (editMode: boolean) => void

  /**
   * Compressed JSON of the viewer's schema edits — the tables they changed and
   * the ones they removed, on top of the schema the build shipped.
   */
  schemaEdits: string
  setSchemaEdits: (edits: string | null, write?: EditWrite) => void

  /**
   * Which deployed documents every edit parameter above was written against.
   * Empty when the link carries no edits, or was made before this existed.
   */
  baseVersionParam: string

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
