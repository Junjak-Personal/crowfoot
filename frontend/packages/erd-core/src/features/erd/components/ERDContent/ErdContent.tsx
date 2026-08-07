// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.

import { useToast } from '@crowfoot/ui'
import {
  Background,
  BackgroundVariant,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import {
  type FC,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useVersionOrThrow } from '../../../../providers'
import { useUserEditingOrThrow } from '../../../../stores'
import {
  connectTables,
  createTable,
  putTable,
  uniqueName,
} from '../../../../utils/schemaEdit'
import { selectTableLogEvent } from '../../../gtm/utils'
import { MAX_ZOOM, MIN_ZOOM } from '../../../reactflow/constants'
import {
  useCommitTablePositions,
  useGroupNodes,
  useMemoNodes,
  useSchemaEditing,
  useTableSelection,
} from '../../hooks'
import type { DisplayArea, MemoNodeType } from '../../types'
import {
  clampMemoFontSize,
  createMemo,
  DEFAULT_MEMO_FONT_SIZE,
  deserializeGroups,
  deserializeMemos,
  deserializeTableColors,
  deserializeTableLayout,
  duplicateMemo,
  type Group,
  getEffectiveGroups,
  getEffectiveMemos,
  getTableColor,
  groupsFromNodes,
  groupToNode,
  highlightNodesAndEdges,
  isMemoNode,
  isTableGroupNode,
  isTableNode,
  MAX_MEMO_FONT_SIZE,
  MIN_MEMO_FONT_SIZE,
  memoNodesFrom,
  memoToNode,
  nodeToMemo,
  parseMemosFromClipboard,
  placeMemos,
  serializeMemosToClipboard,
  serializeTableLayout,
  setTableColor,
  stepMemoFontSize,
  tableGroupNodesFrom,
  type ViewColorKey,
} from '../../utils'
import {
  MemoNode,
  NonRelatedTableGroupNode,
  RelationshipEdge,
  Spinner,
  TableGroupNode,
  TableNode,
  ViewColorMenu,
} from './components'
import styles from './ERDContent.module.css'
import { ErdContentProvider, useErdContentContext } from './ErdContentContext'
import { useInitialAutoLayout, useQueryParamsChanged } from './hooks'
import { nodeElementAt } from './utils'

const nodeTypes = {
  table: TableNode,
  nonRelatedTableGroup: NonRelatedTableGroupNode,
  tableGroup: TableGroupNode,
  memo: MemoNode,
}

const edgeTypes = {
  relationship: RelationshipEdge,
}

type Props = {
  nodes: Node[]
  edges: Edge[]
  displayArea: DisplayArea
}

/** What the right-click menu is acting on. */
type CanvasMenuTarget =
  | { kind: 'pane' }
  | { kind: 'table'; tableName: string }
  | { kind: 'memo'; memoId: string }
  | { kind: 'tableGroup'; groupId: string }

type CanvasMenu = CanvasMenuTarget & { x: number; y: number }

/** "Memo copied" / "3 memos pasted" — the count only earns a plural. */
const memoCountLabel = (count: number, verb: 'copied' | 'pasted') =>
  count === 1 ? `Memo ${verb}` : `${count} memos ${verb}`

/**
 * Which colour the open menu should show as selected. Kept out of the
 * component body (directive: decompose rather than extend inline) so a
 * third menu kind is one more branch here, not one more nested ternary in
 * ERDContentInner's own render.
 */
const resolveMenuColor = (
  menu: CanvasMenu | null,
  context: {
    getTableColor: (tableName: string) => ViewColorKey | undefined
    selectedMemo: MemoNodeType | undefined
    menuGroup: Group | undefined
  },
): ViewColorKey | undefined => {
  if (menu?.kind === 'table') return context.getTableColor(menu.tableName)
  if (menu?.kind === 'memo') return context.selectedMemo?.data.color
  if (menu?.kind === 'tableGroup') return context.menuGroup?.color
  return undefined
}

type TableGroupMenuItemsProps = {
  groups: Group[]
  canGroup: boolean
  onGroupSelected: () => void
  onRemoveFromGroup: (groupId: string) => void
}

/** The grouping rows injected into the table right-click menu. */
const TableGroupMenuItems: FC<TableGroupMenuItemsProps> = ({
  groups,
  canGroup,
  onGroupSelected,
  onRemoveFromGroup,
}) => (
  <>
    {canGroup && (
      <button
        type="button"
        className={styles.contextMenuItem}
        onClick={onGroupSelected}
      >
        Group selected tables
      </button>
    )}
    {groups.map((group) => (
      <button
        key={group.id}
        type="button"
        className={styles.contextMenuItem}
        onClick={() => onRemoveFromGroup(group.id)}
      >
        {group.name
          ? `Remove from "${group.name}"`
          : 'Remove from unnamed group'}
      </button>
    ))}
  </>
)

type GroupHeaderMenuProps = {
  x: number
  y: number
  selectedColor: ViewColorKey | undefined
  name: string
  onSelectColor: (color: ViewColorKey | null) => void
  onRename: (name: string) => void
  onUngroup: () => void
}

/** Right-click menu for a group header: colour palette, rename, ungroup. */
const GroupHeaderMenu: FC<GroupHeaderMenuProps> = ({
  x,
  y,
  selectedColor,
  name,
  onSelectColor,
  onRename,
  onUngroup,
}) => (
  <ViewColorMenu x={x} y={y} selected={selectedColor} onSelect={onSelectColor}>
    <div className={styles.contextMenuRow}>
      <span>Name</span>
      <input
        type="text"
        className={styles.contextMenuText}
        aria-label="Group name"
        value={name}
        onChange={(event) => onRename(event.target.value)}
      />
    </div>
    <button
      type="button"
      className={styles.contextMenuItem}
      onClick={onUngroup}
    >
      Ungroup
    </button>
  </ViewColorMenu>
)

export const ERDContentInner: FC<Props> = ({
  nodes: _nodes,
  edges: _edges,
  displayArea,
}) => {
  const {
    activeTableName,
    setActiveTableName,
    tableColors,
    setTableColors,
    tablePositions,
    setTablePositions,
    memoEntries,
    groupEntries,
    schemaEdits,
    editMode,
  } = useUserEditingOrThrow()

  const [initialNodes] = useState<Node[]>(() => {
    const tableNodes =
      displayArea === 'relatedTables'
        ? _nodes.map((node) =>
            isTableNode(node)
              ? { ...node, data: { ...node.data, showMode: 'TABLE_NAME' } }
              : node,
          )
        : _nodes

    // Group boxes join first — their negative z-index means DOM order should
    // agree — then tables, then memos. Memos and groups join up front so
    // React Flow owns their selection and position from the first render,
    // the same as it does for tables.
    return [
      ...tableGroupNodesFrom(
        getEffectiveGroups(deserializeGroups(groupEntries)),
      ),
      ...tableNodes,
      ...memoNodesFrom(getEffectiveMemos(deserializeMemos(memoEntries))),
    ]
  })

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes)

  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(_edges)

  const {
    state: { loading },
  } = useErdContentContext()
  const { screenToFlowPosition, getNodes } = useReactFlow()
  const toast = useToast()

  const { selectTable, deselectTable } = useTableSelection()
  const { commitMemos, selectedMemos } = useMemoNodes()
  const { commitGroups } = useGroupNodes()
  const commitTablePositions = useCommitTablePositions()
  const {
    schema,
    commit: commitSchema,
    reset: resetSchemaEdits,
  } = useSchemaEditing()

  useInitialAutoLayout({
    nodes,
    displayArea,
  })
  useQueryParamsChanged({
    displayArea,
  })

  const { version } = useVersionOrThrow()
  const handleNodeClick = useCallback(
    (tableId: string) => {
      selectTable({
        tableId,
        displayArea,
      })

      selectTableLogEvent({
        ref: 'mainArea',
        tableId,
        platform: version.displayedOn,
        gitHash: version.gitHash,
        ver: version.version,
        appEnv: version.envName,
      })
    },
    [version, displayArea, selectTable],
  )

  /**
   * A modified click is React Flow's multi-selection gesture. Running the
   * navigation as well would zoom the canvas onto the last table clicked,
   * which is the opposite of what building a selection needs. Memos navigate
   * to nothing, so they never reach it either.
   */
  const handleNodeClickEvent: NodeMouseHandler<Node> = useCallback(
    (event, node) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return
      if (!isTableNode(node)) return

      handleNodeClick(node.id)
    },
    [handleNodeClick],
  )

  const handlePaneClick = useCallback(() => {
    deselectTable()
  }, [deselectTable])

  const handleMouseEnterNode: NodeMouseHandler<Node> = useCallback(
    (_, { id }) => {
      const { nodes: updatedNodes, edges: updatedEdges } =
        highlightNodesAndEdges(nodes, edges, {
          activeTableName: activeTableName ?? undefined,
          hoverTableName: id,
        })

      setEdges(updatedEdges)
      setNodes(updatedNodes)
    },
    [edges, nodes, setNodes, setEdges, activeTableName],
  )

  const handleMouseLeaveNode: NodeMouseHandler<Node> = useCallback(() => {
    const { nodes: updatedNodes, edges: updatedEdges } = highlightNodesAndEdges(
      nodes,
      edges,
      {
        activeTableName: activeTableName ?? undefined,
        hoverTableName: undefined,
      },
    )

    setEdges(updatedEdges)
    setNodes(updatedNodes)
  }, [edges, nodes, setNodes, setEdges, activeTableName])

  const handleDragStopNode: OnNodeDrag<Node> = useCallback(
    (_event, _node, dragged) => {
      // Tables are not draggable outside edit mode, so this is belt and
      // braces: a read-only view must never write a layout.
      if (!editMode) return

      commitTablePositions(dragged)

      // A multi-selection drag can carry both kinds at once, so this is not an
      // else. The dragged nodes are merged in rather than read back: React
      // Flow has not flushed the final positions into the node list yet.
      if (dragged.some(isMemoNode)) {
        const moved = new Map(dragged.map((node) => [node.id, node]))
        commitMemos((current) =>
          current.map((node) => moved.get(node.id) ?? node),
        )
      }
    },
    [editMode, commitTablePositions, commitMemos],
  )

  /** Where a paste lands. Null until the pointer has been over the canvas. */
  const pointer = useRef<{ x: number; y: number } | null>(null)

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      pointer.current = { x: event.clientX, y: event.clientY }
    },
    [],
  )

  /**
   * Fallback for when the clipboard is unreadable — an insecure context, or a
   * paste carrying something that is not one of ours.
   */
  const copiedMemos = useRef<MemoNodeType[]>([])

  const pasteMemos = useCallback(
    (pasted: MemoNodeType[]) => {
      if (pasted.length === 0) return

      const at = pointer.current ?? {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }
      const { x, y } = screenToFlowPosition(at)
      const added = memoNodesFrom(
        placeMemos(pasted.map(nodeToMemo), () => crypto.randomUUID(), x, y),
      )

      commitMemos((current) => [
        ...current.map((node) =>
          node.selected ? { ...node, selected: false } : node,
        ),
        ...added.map((node) => ({ ...node, selected: true })),
      ])

      toast({
        title: memoCountLabel(added.length, 'pasted'),
        status: 'success',
      })
    },
    [screenToFlowPosition, commitMemos, toast],
  )

  useEffect(() => {
    if (!editMode) return

    /** Typing in a memo: ⌘C and ⌘V there mean the text, not the memo. */
    const isTyping = () => {
      const active = document.activeElement
      return (
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLInputElement
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'c' || (!event.metaKey && !event.ctrlKey)) return
      if (isTyping()) return

      const memos = selectedMemos()
      if (memos.length === 0) return

      event.preventDefault()

      copiedMemos.current = memos
      void navigator.clipboard
        ?.writeText(serializeMemosToClipboard(memos.map(nodeToMemo)))
        .catch(() => {
          // Insecure context; the in-memory copy above still works in this tab,
          // so this is a warning rather than a failure.
          toast({
            title: 'Copied for this tab only',
            description:
              'The clipboard is unavailable outside a secure context.',
            status: 'warning',
          })
        })

      toast({
        title: memoCountLabel(memos.length, 'copied'),
        status: 'success',
      })
    }

    // A `paste` event carries the clipboard text without asking for read
    // permission, which `navigator.clipboard.readText()` would.
    const handlePaste = (event: ClipboardEvent) => {
      if (isTyping()) return

      const text = event.clipboardData?.getData('text/plain') ?? ''
      const fromClipboard = parseMemosFromClipboard(text).map(memoToNode)
      const memos =
        fromClipboard.length > 0 ? fromClipboard : copiedMemos.current
      if (memos.length === 0) return

      event.preventDefault()
      pasteMemos(memos)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('paste', handlePaste)
    }
  }, [editMode, selectedMemos, pasteMemos, toast])

  // Right-click rather than double-click: double-click is already React
  // Flow's zoom gesture, and overriding it broke zooming in edit mode.
  const [menu, setMenu] = useState<CanvasMenu | null>(null)

  /**
   * What is currently typed in the font size box, before it is a usable size.
   * Clamping every keystroke would rewrite "4" to the minimum before "40"
   * could be finished, so the box keeps the raw text and the clamp waits for
   * the field to be left.
   */
  const [fontSizeDraft, setFontSizeDraft] = useState<string | null>(null)

  const openMenu = useCallback(
    (event: ReactMouseEvent | MouseEvent, target: CanvasMenuTarget) => {
      if (!editMode) return

      // Always suppress the browser menu on the canvas: React Flow pans with
      // the right button (panOnDrag), so the native menu would pop up at the
      // end of every right-drag.
      event.preventDefault()

      // Plain right-click is that pan gesture, so the editing menu sits behind
      // Ctrl (or Cmd on macOS).
      if (!event.ctrlKey && !event.metaKey) return

      event.stopPropagation()
      // A stale draft from the last memo must not show up in this menu's box.
      setFontSizeDraft(null)
      setMenu({ ...target, x: event.clientX, y: event.clientY })
    },
    [editMode],
  )

  /**
   * Right-clicking inside a selection acts on the whole selection; right-
   * clicking something outside it narrows the selection to that one thing.
   * This is what React Flow already does for a left click, so the two gestures
   * agree.
   */
  const claimSelection = useCallback(
    (nodeId: string) => {
      const node = getNodes().find((candidate) => candidate.id === nodeId)
      if (node?.selected) return

      setNodes((current) =>
        current.map((candidate) => ({
          ...candidate,
          selected: candidate.id === nodeId,
        })),
      )
    },
    [getNodes, setNodes],
  )

  /**
   * React Flow swallows the pane context menu whenever panOnDrag includes the
   * right button (it calls preventDefault and returns without invoking
   * onPaneContextMenu), so the event is caught on the wrapper instead. The
   * target tells us whether a table, a memo or empty canvas was clicked.
   */
  const handleCanvasContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const element = nodeElementAt(event.target, () =>
        document.elementsFromPoint(event.clientX, event.clientY),
      )
      const nodeId = element?.getAttribute('data-id') ?? null
      const node = nodeId
        ? getNodes().find((candidate) => candidate.id === nodeId)
        : undefined

      if (node && isMemoNode(node)) {
        claimSelection(node.id)
        openMenu(event, { kind: 'memo', memoId: node.id })
        return
      }

      if (node && isTableNode(node)) {
        claimSelection(node.id)
        openMenu(event, { kind: 'table', tableName: node.id })
        return
      }

      if (node && isTableGroupNode(node)) {
        // No claimSelection: the box is `selectable: false`, so there is no
        // selection to claim (RISK-2).
        openMenu(event, { kind: 'tableGroup', groupId: node.data.groupId })
        return
      }

      openMenu(event, { kind: 'pane' })
    },
    [getNodes, claimSelection, openMenu],
  )

  const handleAddMemo = useCallback(() => {
    if (menu?.kind !== 'pane') return

    const { x, y } = screenToFlowPosition({ x: menu.x, y: menu.y })
    const added = memoToNode(createMemo(crypto.randomUUID(), x, y))

    commitMemos((current) => [
      ...current.map((node) =>
        node.selected ? { ...node, selected: false } : node,
      ),
      { ...added, selected: true },
    ])
    setMenu(null)
  }, [menu, commitMemos, screenToFlowPosition])

  /**
   * A new table is pinned where it was dropped rather than left to the auto
   * layout, which would otherwise place it wherever ELK felt like — usually
   * off screen, which reads as "nothing happened".
   */
  const handleAddTable = useCallback(() => {
    if (menu?.kind !== 'pane') return

    const name = uniqueName(Object.keys(schema.tables), 'new_table')
    const { x, y } = screenToFlowPosition({ x: menu.x, y: menu.y })

    commitSchema((current) => putTable(current, createTable(name)))
    setTablePositions(
      serializeTableLayout({
        ...deserializeTableLayout(tablePositions),
        [name]: { x, y },
      }),
    )
    // Straight into the editor: an empty table has nothing to show on the
    // canvas, so landing on it is the only useful next step.
    setActiveTableName(name)
    setMenu(null)
  }, [
    menu,
    schema,
    commitSchema,
    screenToFlowPosition,
    tablePositions,
    setTablePositions,
    setActiveTableName,
  ])

  const handleDiscardSchemaEdits = useCallback(() => {
    resetSchemaEdits()
    setMenu(null)
  }, [resetSchemaEdits])

  /**
   * The table-to-table gesture: right-click the table that should hold the
   * key, pick what it references. `connectTables` reuses a column that already
   * follows the `<table>_<key>` convention and creates one when there is none,
   * so the edge appears without a trip to the drawer first.
   */
  const handleConnectTable = useCallback(
    (targetName: string) => {
      if (menu?.kind !== 'table' || targetName === '') return

      const sourceName = menu.tableName
      const result = connectTables(schema, sourceName, targetName)
      setMenu(null)

      if (!result) {
        toast({
          title: 'Cannot reference that table',
          description: `${targetName} has no primary key to point at.`,
          status: 'error',
        })
        return
      }

      commitSchema(() => result.schema)
      toast({
        title: `${sourceName} → ${targetName}`,
        description:
          result.createdColumns.length > 0
            ? `Added ${result.createdColumns.join(', ')} to ${sourceName}.`
            : 'Linked using the columns that were already there.',
        status: 'success',
      })
    },
    [menu, schema, commitSchema, toast],
  )

  /**
   * The nodes of one kind that the open menu applies to. A right-click has
   * already put the clicked node in the selection, so the selection is the
   * answer for both kinds.
   */
  const selectedIdsOf = useCallback(
    (kind: 'table' | 'memo'): string[] =>
      getNodes()
        .filter((node) => node.selected && node.type === kind)
        .map((node) => node.id),
    [getNodes],
  )

  const applyTableColor = useCallback(
    (color: ViewColorKey | null) => {
      const tableNames = selectedIdsOf('table')
      const tinted = new Set(tableNames)

      // Mirror into the link, keeping colours the link already carried.
      const urlColors = deserializeTableColors(tableColors)
      for (const tableName of tableNames) {
        setTableColor(tableName, color)
        if (color === null) {
          delete urlColors[tableName]
        } else {
          urlColors[tableName] = color
        }
      }

      setNodes((current) =>
        current.map((node) =>
          tinted.has(node.id)
            ? { ...node, data: { ...node.data, color: color ?? undefined } }
            : node,
        ),
      )
      setTableColors(
        Object.entries(urlColors).map(([name, key]) => `${name}:${key}`),
      )
    },
    [selectedIdsOf, tableColors, setTableColors, setNodes],
  )

  const applyMemoColor = useCallback(
    (color: ViewColorKey | null) => {
      const memoIds = new Set(selectedIdsOf('memo'))
      commitMemos((current) =>
        current.map((node) =>
          memoIds.has(node.id)
            ? { ...node, data: { ...node.data, color: color ?? undefined } }
            : node,
        ),
      )
    },
    [selectedIdsOf, commitMemos],
  )

  const applyGroupColor = useCallback(
    (color: ViewColorKey | null, groupId: string) => {
      commitGroups((current) =>
        current.map((node) =>
          isTableGroupNode(node) && node.data.groupId === groupId
            ? { ...node, data: { ...node.data, color: color ?? undefined } }
            : node,
        ),
      )
    },
    [commitGroups],
  )

  const handleSelectColor = useCallback(
    (color: ViewColorKey | null) => {
      if (menu?.kind === 'table') {
        applyTableColor(color)
      } else if (menu?.kind === 'memo') {
        applyMemoColor(color)
      } else if (menu?.kind === 'tableGroup') {
        applyGroupColor(color, menu.groupId)
      }

      setMenu(null)
    },
    [menu, applyTableColor, applyMemoColor, applyGroupColor],
  )

  /** Turns the current multi-selection into a new group (F9, a pure append —
   * existing group memberships of the selected tables are never touched). */
  const handleGroupSelected = useCallback(() => {
    const tableNames = selectedIdsOf('table')
    if (tableNames.length < 2) return

    commitGroups((current) => [
      ...current,
      groupToNode({ id: crypto.randomUUID(), name: '', tableNames }),
    ])
    setMenu(null)
  }, [selectedIdsOf, commitGroups])

  /**
   * Removes the right-clicked table from one group only — other memberships
   * of the same table are untouched (multi-group membership). A group left
   * with zero members is dropped entirely: an empty `tableNames` is not
   * representable in groups.json (parseGroups drops it), so keeping the
   * node here would make the canvas and a reloaded `?groups=` disagree.
   */
  const handleRemoveFromGroup = useCallback(
    (groupId: string) => {
      if (menu?.kind !== 'table') return
      const { tableName } = menu

      commitGroups((current) =>
        current
          .map((node) =>
            isTableGroupNode(node) && node.data.groupId === groupId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    tableNames: node.data.tableNames.filter(
                      (name) => name !== tableName,
                    ),
                  },
                }
              : node,
          )
          .filter(
            (node) =>
              !isTableGroupNode(node) || node.data.tableNames.length > 0,
          ),
      )
      setMenu(null)
    },
    [menu, commitGroups],
  )

  const handleRenameGroup = useCallback(
    (name: string) => {
      if (menu?.kind !== 'tableGroup') return
      const { groupId } = menu

      commitGroups((current) =>
        current.map((node) =>
          isTableGroupNode(node) && node.data.groupId === groupId
            ? { ...node, data: { ...node.data, name } }
            : node,
        ),
      )
    },
    [menu, commitGroups],
  )

  const handleUngroup = useCallback(() => {
    if (menu?.kind !== 'tableGroup') return
    const { groupId } = menu

    commitGroups((current) =>
      current.filter(
        (node) => !(isTableGroupNode(node) && node.data.groupId === groupId),
      ),
    )
    setMenu(null)
  }, [menu, commitGroups])

  const handleDuplicateMemos = useCallback(() => {
    if (menu?.kind !== 'memo') return

    const memoIds = new Set(selectedIdsOf('memo'))
    commitMemos((current) => {
      const copies = current
        .filter(isMemoNode)
        .filter((node) => memoIds.has(node.id))
        .map((node) =>
          memoToNode(duplicateMemo(nodeToMemo(node), crypto.randomUUID())),
        )

      return [
        ...current.map((node) =>
          node.selected ? { ...node, selected: false } : node,
        ),
        ...copies.map((node) => ({ ...node, selected: true })),
      ]
    })
    setMenu(null)
  }, [menu, selectedIdsOf, commitMemos])

  const handleDeleteMemos = useCallback(() => {
    if (menu?.kind !== 'memo') return

    const memoIds = new Set(selectedIdsOf('memo'))
    commitMemos((current) => current.filter((node) => !memoIds.has(node.id)))
    setMenu(null)
  }, [menu, selectedIdsOf, commitMemos])

  // The menu stays open so the size can be adjusted repeatedly; ViewColorMenu
  // swallows clicks so the dismiss listener below does not fire.
  const setMemoFontSize = useCallback(
    (fontSize: number) => {
      if (menu?.kind !== 'memo') return

      const memoIds = new Set(selectedIdsOf('memo'))
      commitMemos((current) =>
        current.map((node) =>
          memoIds.has(node.id)
            ? { ...node, data: { ...node.data, fontSize } }
            : node,
        ),
      )
    },
    [menu, selectedIdsOf, commitMemos],
  )

  const selectedMemo =
    menu?.kind === 'memo'
      ? nodes.filter(isMemoNode).find((node) => node.id === menu.memoId)
      : undefined

  const selectedFontSize = selectedMemo?.data.fontSize ?? DEFAULT_MEMO_FONT_SIZE

  const handleFontSizeInput = useCallback(
    (raw: string) => {
      setFontSizeDraft(raw)

      // Preview only a size that is already in range: a half-typed "4" on its
      // way to 40 must not drag the memo down to the minimum.
      const typed = Number(raw)
      if (
        raw !== '' &&
        Number.isFinite(typed) &&
        typed >= MIN_MEMO_FONT_SIZE &&
        typed <= MAX_MEMO_FONT_SIZE
      ) {
        setMemoFontSize(Math.round(typed))
      }
    },
    [setMemoFontSize],
  )

  /** Leaving the field is what commits an out-of-range or half-typed value. */
  const handleFontSizeCommit = useCallback(() => {
    const typed = Number(fontSizeDraft)
    if (
      fontSizeDraft !== null &&
      fontSizeDraft !== '' &&
      Number.isFinite(typed)
    ) {
      setMemoFontSize(clampMemoFontSize(typed))
    }

    // Clearing the draft snaps the box back to the size the memo actually has.
    setFontSizeDraft(null)
  }, [fontSizeDraft, setMemoFontSize])

  // Any click outside the menu dismisses it.
  useEffect(() => {
    if (!menu) return

    const dismiss = () => setMenu(null)
    window.addEventListener('click', dismiss)
    return () => window.removeEventListener('click', dismiss)
  }, [menu])

  const groups = groupsFromNodes(nodes)

  const menuGroup =
    menu?.kind === 'tableGroup'
      ? groups.find((group) => group.id === menu.groupId)
      : undefined

  const menuTableGroups =
    menu?.kind === 'table'
      ? groups.filter((group) => group.tableNames.includes(menu.tableName))
      : []

  const selectedTableCount = nodes.filter(
    (node) => node.selected && node.type === 'table',
  ).length

  const selectedColor = resolveMenuColor(menu, {
    getTableColor,
    selectedMemo,
    menuGroup,
  })

  const panOnDrag = [1, 2]

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: this only suppresses
    // the native menu and opens the editing menu; nothing here is a control.
    <div
      className={styles.wrapper}
      data-loading={loading}
      onContextMenu={handleCanvasContextMenu}
      onPointerMove={handlePointerMove}
    >
      {loading && <Spinner className={styles.loading} />}
      {editMode && (
        <div className={styles.editBadge}>
          Edit mode · drag to select · Ctrl/Cmd + right-click for the menu
        </div>
      )}
      {menu?.kind === 'pane' && (
        <div
          className={styles.contextMenu}
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            className={styles.contextMenuItem}
            onClick={handleAddMemo}
          >
            Add memo here
          </button>
          <button
            type="button"
            className={styles.contextMenuItem}
            onClick={handleAddTable}
          >
            Add table here
          </button>
          {schemaEdits !== '' && (
            <button
              type="button"
              className={styles.contextMenuItem}
              onClick={handleDiscardSchemaEdits}
            >
              Discard schema edits
            </button>
          )}
        </div>
      )}
      {(menu?.kind === 'table' || menu?.kind === 'memo') && (
        <ViewColorMenu
          x={menu.x}
          y={menu.y}
          selected={selectedColor}
          onSelect={handleSelectColor}
        >
          {menu.kind === 'memo' && (
            <>
              <div className={styles.contextMenuRow}>
                <span>Font size</span>
                <button
                  type="button"
                  className={styles.contextMenuStep}
                  aria-label="Decrease font size"
                  onClick={() =>
                    selectedMemo &&
                    setMemoFontSize(
                      stepMemoFontSize(nodeToMemo(selectedMemo), -1),
                    )
                  }
                >
                  −
                </button>
                <input
                  type="number"
                  className={styles.contextMenuNumber}
                  aria-label="Font size"
                  min={MIN_MEMO_FONT_SIZE}
                  max={MAX_MEMO_FONT_SIZE}
                  value={fontSizeDraft ?? selectedFontSize}
                  onChange={(event) => handleFontSizeInput(event.target.value)}
                  onBlur={handleFontSizeCommit}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                />
                <button
                  type="button"
                  className={styles.contextMenuStep}
                  aria-label="Increase font size"
                  onClick={() =>
                    selectedMemo &&
                    setMemoFontSize(
                      stepMemoFontSize(nodeToMemo(selectedMemo), 1),
                    )
                  }
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className={styles.contextMenuItem}
                onClick={handleDuplicateMemos}
              >
                Duplicate memo
              </button>
              <button
                type="button"
                className={styles.contextMenuItem}
                onClick={handleDeleteMemos}
              >
                Delete memo
              </button>
            </>
          )}
          {menu.kind === 'table' && (
            <>
              <div className={styles.contextMenuRow}>
                <span>Connect to</span>
                {/* A native select rather than a nested menu: it scrolls,
                    it has type-ahead, and a wide schema would otherwise need
                    a submenu taller than the screen. */}
                <select
                  className={styles.contextMenuText}
                  aria-label="Reference another table"
                  value=""
                  onChange={(event) => handleConnectTable(event.target.value)}
                >
                  <option value="">Pick a table…</option>
                  {Object.keys(schema.tables)
                    .filter((name) => name !== menu.tableName)
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </div>
              <TableGroupMenuItems
                groups={menuTableGroups}
                canGroup={selectedTableCount >= 2}
                onGroupSelected={handleGroupSelected}
                onRemoveFromGroup={handleRemoveFromGroup}
              />
            </>
          )}
        </ViewColorMenu>
      )}
      {menu?.kind === 'tableGroup' && (
        <GroupHeaderMenu
          x={menu.x}
          y={menu.y}
          selectedColor={selectedColor}
          name={menuGroup?.name ?? ''}
          onSelectColor={handleSelectColor}
          onRename={handleRenameGroup}
          onUngroup={handleUngroup}
        />
      )}
      <ReactFlow
        colorMode="dark"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        edgesFocusable={false}
        edgesReconnectable={false}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClickEvent}
        onPaneClick={handlePaneClick}
        onNodeMouseEnter={handleMouseEnterNode}
        onNodeMouseLeave={handleMouseLeaveNode}
        onNodeDragStop={handleDragStopNode}
        panOnScroll
        panOnDrag={panOnDrag}
        deleteKeyCode={null} // Turn off because it does not want to be deleted
        attributionPosition="bottom-left"
        nodesConnectable={false}
        // Read-only by default. Letting tables be dragged without saving would
        // silently throw the work away on the next reload.
        nodesDraggable={editMode}
        // The left button is free (panOnDrag uses the middle and right ones),
        // so in edit mode it draws a selection box. Dragging any node of a
        // selection moves the whole set, and onNodeDragStop persists it.
        selectionOnDrag={editMode}
        // Partial: a box that clips a wide table still selects it. Requiring
        // full containment makes large tables almost unselectable by box.
        selectionMode={SelectionMode.Partial}
      >
        <Background
          color="var(--color-gray-600)"
          variant={BackgroundVariant.Dots}
          size={1}
          gap={16}
        />
      </ReactFlow>
    </div>
  )
}

export const ERDContent: FC<Props> = (props) => {
  return (
    <ErdContentProvider>
      <ERDContentInner {...props} />
    </ErdContentProvider>
  )
}
