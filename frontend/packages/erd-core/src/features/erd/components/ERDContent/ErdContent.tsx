// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.

import {
  Button,
  ModalActions,
  ModalContent,
  ModalDescription,
  ModalOverlay,
  ModalPortal,
  ModalRoot,
  ModalTitle,
  useToast,
} from '@crowfoot/ui'
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
  type XYPosition,
} from '@xyflow/react'
import clsx from 'clsx'
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
  type ConnectResult,
  connectTables,
  createTable,
  putTable,
  type RelationshipKind,
  uniqueName,
} from '../../../../utils/schemaEdit'
import { selectTableLogEvent } from '../../../gtm/utils'
import { MAX_ZOOM, MIN_ZOOM } from '../../../reactflow/constants'
import {
  useCommitTablePositions,
  useGroupNodes,
  useLabelScale,
  useLodTier,
  useMemoNodes,
  useSchemaEditing,
  useTableSelection,
  useTextDraft,
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
  releaseTables,
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
  SelectionHud,
  Spinner,
  TableGroupNode,
  TableNode,
  ViewColorMenu,
} from './components'
import styles from './ERDContent.module.css'
import { ErdContentProvider, useErdContentContext } from './ErdContentContext'
import {
  useGroupMembership,
  useInitialAutoLayout,
  useQueryParamsChanged,
  useSchemaNodeSync,
} from './hooks'
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

/**
 * What the connect menu offers. The schema only ever stores a foreign key —
 * these say how to build one, and which end holds it. See `RelationshipKind`.
 */
const isMacOs =
  typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')

/**
 * Adding to a selection by clicking: the platform's own modifier, plus Shift.
 * React Flow's default is the platform modifier *alone*, so Shift + click did
 * nothing — which is not what the diagram's own documentation said.
 *
 * Ctrl is deliberately not included on macOS: there it is the secondary-click
 * gesture, and the editing menu already sits behind Ctrl/Cmd + right-click.
 * Shift remains the selection-box key too; the two do not collide.
 */
const MULTI_SELECTION_KEYS = isMacOs ? ['Meta', 'Shift'] : ['Control', 'Shift']

/**
 * Which grouping shortcut a keystroke is, if any. `event.key` is the *typed*
 * character, so holding Shift makes it "G" — comparing case-insensitively is
 * what keeps the ungroup binding working.
 */
const groupingShortcut = (event: KeyboardEvent): 'group' | 'ungroup' | null => {
  if (event.key.toLowerCase() !== 'g') return null
  if (!event.metaKey && !event.ctrlKey) return null

  return event.shiftKey ? 'ungroup' : 'group'
}

/**
 * Undo is the back button.
 *
 * Every edit writes the query string and pushes a history entry, so the state
 * before an edit is the entry before it — there is no separate stack of edits
 * to keep in step with the URL, and redo comes for free. The ceiling is that
 * it cannot reach past the entry the page was opened on.
 */
const historyShortcut = (event: KeyboardEvent): 'back' | 'forward' | null => {
  if (event.key.toLowerCase() !== 'z') return null
  if (!event.metaKey && !event.ctrlKey) return null

  return event.shiftKey ? 'forward' : 'back'
}

const RELATIONSHIP_KINDS: { kind: RelationshipKind; label: string }[] = [
  { kind: 'MANY_TO_ONE', label: 'many : 1' },
  { kind: 'ONE_TO_ONE', label: '1 : 1' },
  { kind: 'ONE_TO_MANY', label: '1 : many' },
  { kind: 'MANY_TO_MANY', label: 'many : many' },
]

/** What a finished connection actually did to the schema, for the toast. */
const connectionSummary = (result: ConnectResult): string => {
  if (result.createdTable !== null) {
    return `Joined through ${result.createdTable}.`
  }
  if (result.createdColumns.length > 0) {
    return `Added ${result.createdColumns.join(', ')}.`
  }
  return 'Linked using the columns that were already there.'
}

/** Why one could not be made — both ends need something to point at. */
const missingKeyReason = (
  kind: RelationshipKind,
  targetName: string,
): string =>
  kind === 'MANY_TO_MANY'
    ? 'Both tables need a primary key to point at.'
    : `${targetName} needs a primary key to point at.`

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

type CanvasBadgeProps = {
  editMode: boolean
  /** The table a half-made connection is waiting on, if there is one. */
  connectingFrom: string | null
}

/**
 * The one-line hint in the corner. Kept out of the component body for the same
 * reason the menus below are — one more state to explain should be one more
 * branch here, not another nested condition in ERDContentInner's own render.
 */
const CanvasBadge: FC<CanvasBadgeProps> = ({ editMode, connectingFrom }) => {
  if (connectingFrom !== null) {
    return (
      <div className={styles.connectBadge}>
        Click the table to connect <strong>{connectingFrom}</strong> to · Esc to
        cancel
      </div>
    )
  }

  if (!editMode) return null

  return (
    <div className={styles.editBadge}>
      Edit mode · drag to select · Ctrl/Cmd + right-click for the menu
    </div>
  )
}

/** Every group that claims at least one of the given tables. */
const groupsClaiming = (nodes: Node[], tableNames: string[]): Group[] => {
  const selected = new Set(tableNames)

  return groupsFromNodes(nodes).filter((group) =>
    group.tableNames.some((name) => selected.has(name)),
  )
}

type UngroupConfirmProps = {
  /** `null` while nothing is waiting to be confirmed. */
  groups: Group[] | null
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Ungrouping throws away a grouping someone put together by hand, and
 * `Ctrl`/`Cmd` + `Shift` + `G` is easy to hit while reaching for something
 * else, so it asks first.
 */
const UngroupConfirm: FC<UngroupConfirmProps> = ({
  groups,
  onCancel,
  onConfirm,
}) => {
  if (groups === null) return null

  const named = groups
    .map((group) =>
      group.name === '' ? 'an unnamed group' : `"${group.name}"`,
    )
    .join(', ')

  return (
    <ModalRoot
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <ModalPortal>
        <ModalOverlay />
        <ModalContent>
          <ModalTitle>
            {groups.length === 1 ? 'Ungroup?' : `Ungroup ${groups.length}?`}
          </ModalTitle>
          <ModalDescription>
            {named} will be dissolved. The tables stay exactly where they are —
            only the grouping goes.
          </ModalDescription>
          <ModalActions>
            <Button variant="outline-secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="solid-danger" onClick={onConfirm}>
              Ungroup
            </Button>
          </ModalActions>
        </ModalContent>
      </ModalPortal>
    </ModalRoot>
  )
}

type TableGroupMenuItemsProps = {
  /** The group holding the right-clicked table, if one does. */
  group: Group | undefined
  canGroup: boolean
  onGroupSelected: () => void
  onRemoveFromGroup: () => void
}

/** The grouping rows injected into the table right-click menu. */
const TableGroupMenuItems: FC<TableGroupMenuItemsProps> = ({
  group,
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
    {group && (
      <button
        type="button"
        className={styles.contextMenuItem}
        onClick={onRemoveFromGroup}
      >
        {group.name
          ? `Remove from "${group.name}"`
          : 'Remove from unnamed group'}
      </button>
    )}
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
}) => {
  const draft = useTextDraft(name)

  return (
    <ViewColorMenu
      x={x}
      y={y}
      selected={selectedColor}
      onSelect={onSelectColor}
    >
      <div className={styles.contextMenuRow}>
        <span>Name</span>
        <input
          type="text"
          className={styles.contextMenuText}
          aria-label="Group name"
          value={draft.value}
          onChange={(event) => {
            draft.edit(event.target.value)
            onRename(event.target.value)
          }}
          onBlur={draft.release}
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
}

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

    // Group boxes join first — they paint under the tables, so DOM order
    // should agree — then tables, then memos. Memos and groups join up front so
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
    state: { loading, selectedGroupId },
    actions: { setSelectedGroupId, setGroupPreview, setGroupedTables },
  } = useErdContentContext()
  const { screenToFlowPosition, getNodes } = useReactFlow()
  const toast = useToast()

  const { selectTable, deselectTable } = useTableSelection()
  const { commitMemos, selectedMemos } = useMemoNodes()
  const { commitGroups } = useGroupNodes()
  const {
    moveSelectionToGroup,
    removeSelectionFromGroups,
    removeTableFromItsGroup,
    enterGroup,
    dropGroupSelection,
  } = useGroupMembership()
  const commitTablePositions = useCommitTablePositions()
  const {
    schema,
    commit: commitSchema,
    reset: resetSchemaEdits,
  } = useSchemaEditing()

  /** Carries `--label-scale` down to every name drawn on this canvas. */
  const canvas = useRef<HTMLDivElement>(null)
  useLabelScale(canvas)
  const lodTier = useLodTier()

  const { handleNodesChange, isSettling, stopSettleAnimation } =
    useSchemaNodeSync({
      nodes,
      incomingNodes: _nodes,
      incomingEdges: _edges,
      displayArea,
      onNodesChange,
      setNodes,
      setEdges,
    })

  useInitialAutoLayout({
    nodes,
    displayArea,
  })
  useQueryParamsChanged()

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
   * A connection waiting for its other end. Picking the kind up front rather
   * than after the second click keeps the whole gesture to one popup: choose,
   * then click the table to connect to.
   */
  const [connecting, setConnecting] = useState<{
    from: string
    kind: RelationshipKind
  } | null>(null)

  /** Groups the viewer has asked to dissolve, waiting on the confirmation. */
  const [pendingUngroup, setPendingUngroup] = useState<Group[] | null>(null)

  /** Pins a table's spot so the automatic layout does not get a say in it. */
  const pinTable = useCallback(
    (tableName: string, position: XYPosition) => {
      setTablePositions(
        serializeTableLayout({
          ...deserializeTableLayout(tablePositions),
          [tableName]: position,
        }),
      )
    },
    [tablePositions, setTablePositions],
  )

  /**
   * Completes it. `connectTables` reuses a column that already follows the
   * `<table>_<key>` convention and creates one when there is none, so the edge
   * appears without a trip to the drawer first.
   */
  const handleFinishConnect = useCallback(
    (targetName: string) => {
      if (!connecting) return
      const { from, kind } = connecting
      setConnecting(null)

      if (targetName === from) return

      const result = connectTables({
        schema,
        sourceName: from,
        targetName,
        kind,
      })

      if (!result) {
        toast({
          title: 'Cannot connect those tables',
          description: missingKeyReason(kind, targetName),
          status: 'error',
        })
        return
      }

      commitSchema(() => result.schema)
      toast({
        title: `${from} → ${targetName}`,
        description: connectionSummary(result),
        status: 'success',
      })

      if (result.createdTable) {
        // Halfway between the two tables it joins. Left to the automatic
        // layout it would appear wherever there happened to be room, which on
        // a diagram this size means going to look for it.
        const ends = getNodes().filter(
          (node) => node.id === from || node.id === targetName,
        )
        const first = ends[0]?.position
        const second = ends[1]?.position
        if (first && second) {
          pinTable(result.createdTable, {
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2,
          })
        }
        // It is new and empty, so it is worth landing in.
        setActiveTableName(result.createdTable)
      }
    },
    [
      connecting,
      schema,
      commitSchema,
      toast,
      setActiveTableName,
      getNodes,
      pinTable,
    ],
  )

  /**
   * A modified click is React Flow's multi-selection gesture; opening the
   * drawer and re-highlighting on every one of them is the opposite of what
   * building a selection needs. Memos open nothing, so they never reach it.
   */
  const handleNodeClickEvent: NodeMouseHandler<Node> = useCallback(
    (event, node) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return
      if (!isTableNode(node)) return

      // While a connection is waiting for its other end, a click picks that end
      // rather than navigating to the table.
      if (connecting) {
        handleFinishConnect(node.id)
        return
      }

      handleNodeClick(node.id)
    },
    [connecting, handleFinishConnect, handleNodeClick],
  )

  const handlePaneClick = useCallback(() => {
    // Clicking empty canvas is how you back out of a connection.
    if (connecting) {
      setConnecting(null)
      return
    }
    // React Flow clears its own node selection here; the group selection is
    // ours, so it has to be cleared alongside or the panel would go on
    // offering commands for a group nothing is pointing at any more.
    setSelectedGroupId(null)
    deselectTable()
  }, [connecting, deselectTable, setSelectedGroupId])

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
    pinTable(name, { x, y })
    // Straight into the editor: an empty table has nothing to show on the
    // canvas, so landing on it is the only useful next step.
    setActiveTableName(name)
    setMenu(null)
  }, [
    menu,
    schema,
    commitSchema,
    screenToFlowPosition,
    pinTable,
    setActiveTableName,
  ])

  const handleDiscardSchemaEdits = useCallback(() => {
    resetSchemaEdits()
    setMenu(null)
  }, [resetSchemaEdits])

  /**
   * Arms the table-to-table gesture. The menu closes and the next table clicked
   * becomes the other end — picking from a list meant knowing the name of the
   * table you were looking straight at.
   */
  const handleStartConnect = useCallback(
    (kind: RelationshipKind) => {
      if (menu?.kind !== 'table') return

      setConnecting({ from: menu.tableName, kind })
      setMenu(null)
    },
    [menu],
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

  /**
   * Turns the current multi-selection into a new group (F9). The selected
   * tables leave whatever groups they were in: a table belongs to one group,
   * so the new group takes them rather than sharing them, and any group left
   * empty by that goes with them.
   */
  const handleGroupSelected = useCallback(() => {
    const tableNames = selectedIdsOf('table')
    if (tableNames.length < 2) {
      // The menu item only appears with two selected; the shortcut does not,
      // so silence here would read as the key not working.
      toast({
        title: 'Select two or more tables to group them',
        status: 'warning',
      })
      return
    }

    commitGroups((current) => [
      ...releaseTables(current, tableNames, null),
      groupToNode({ id: crypto.randomUUID(), name: '', tableNames }),
    ])
    setMenu(null)
  }, [selectedIdsOf, commitGroups, toast])

  /** Removes the right-clicked table from the group it is in. */
  const handleRemoveFromGroup = useCallback(() => {
    if (menu?.kind !== 'table') return

    removeTableFromItsGroup(menu.tableName)
    setMenu(null)
  }, [menu, removeTableFromItsGroup])

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

  /**
   * With a group selected it dissolves that one; with tables selected, every
   * group they belong to. Reading only the table selection — which is what
   * this did before there were two kinds — meant the shortcut did nothing at
   * all, and said nothing about it, whenever a group was what was selected.
   */
  const handleUngroupSelected = useCallback(() => {
    const groups =
      selectedGroupId === null
        ? groupsClaiming(getNodes(), selectedIdsOf('table'))
        : groupsFromNodes(getNodes()).filter(({ id }) => id === selectedGroupId)

    if (groups.length === 0) {
      toast({
        title: 'Nothing selected belongs to a group',
        status: 'warning',
      })
      return
    }
    setPendingUngroup(groups)
  }, [getNodes, selectedGroupId, selectedIdsOf, toast])

  const handleUngroup = useCallback(() => {
    if (menu?.kind !== 'tableGroup') return
    const { groupId } = menu

    const group = groupsFromNodes(getNodes()).find(
      (candidate) => candidate.id === groupId,
    )
    setMenu(null)
    if (group) setPendingUngroup([group])
  }, [menu, getNodes])

  const handleCancelUngroup = useCallback(() => {
    setPendingUngroup(null)
  }, [])

  const confirmUngroup = useCallback(() => {
    const ids = new Set((pendingUngroup ?? []).map((group) => group.id))
    setPendingUngroup(null)
    if (ids.size === 0) return

    commitGroups((current) =>
      current.filter(
        (node) => !(isTableGroupNode(node) && ids.has(node.data.groupId)),
      ),
    )
  }, [pendingUngroup, commitGroups])

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

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setConnecting(null)
      setSelectedGroupId(null)
    }

    const handleHistory = (event: KeyboardEvent) => {
      const shortcut = historyShortcut(event)
      // Inside a memo, Cmd+Z is the browser undoing text. Taking it there
      // would leave no way to take back a keystroke.
      if (shortcut === null || isTyping()) return

      event.preventDefault()

      if (shortcut === 'forward') window.history.forward()
      else window.history.back()
    }

    const handleGrouping = (event: KeyboardEvent) => {
      const shortcut = groupingShortcut(event)
      if (shortcut === null || isTyping()) return

      // The browser's own ⌘G (find again) would otherwise take it.
      event.preventDefault()

      if (shortcut === 'ungroup') handleUngroupSelected()
      else handleGroupSelected()
    }

    document.addEventListener('keydown', handleHistory)
    document.addEventListener('keydown', handleGrouping)
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('keydown', handleHistory)
      document.removeEventListener('keydown', handleGrouping)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('paste', handlePaste)
    }
  }, [
    editMode,
    selectedMemos,
    pasteMemos,
    toast,
    handleGroupSelected,
    handleUngroupSelected,
    setSelectedGroupId,
  ])

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

  /**
   * Handed down so a table can tell whether some group speaks for it — which it
   * has to know to hide itself once the canvas is drawing groups only. Derived
   * here because this is where the node list lives; a group node is a sibling
   * of the tables it contains, not their parent.
   */
  const groupedTableNames = groups
    .flatMap((group) => group.tableNames)
    .join(',')

  // biome-ignore lint/correctness/useExhaustiveDependencies: the joined names
  // are the dependency; the array they came from is rebuilt every render.
  useEffect(() => {
    setGroupedTables(
      new Set(groupedTableNames === '' ? [] : groupedTableNames.split(',')),
    )
  }, [groupedTableNames, setGroupedTables])

  const menuGroup =
    menu?.kind === 'tableGroup'
      ? groups.find((group) => group.id === menu.groupId)
      : undefined

  const menuTableGroup =
    menu?.kind === 'table'
      ? groups.find((group) => group.tableNames.includes(menu.tableName))
      : undefined

  const selectedTableNames = nodes
    .filter((node) => node.selected && node.type === 'table')
    .map((node) => node.id)
  const selectedTableCount = selectedTableNames.length

  const selectedGroup = groups.find((group) => group.id === selectedGroupId)

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
      ref={canvas}
      className={clsx(styles.wrapper, {
        [styles.settling]: isSettling,
        [styles.connecting]: connecting !== null,
      })}
      data-loading={loading}
      data-lod={lodTier}
      onContextMenu={handleCanvasContextMenu}
      onPointerMove={handlePointerMove}
    >
      {loading && <Spinner className={styles.loading} />}
      <UngroupConfirm
        groups={pendingUngroup}
        onCancel={handleCancelUngroup}
        onConfirm={confirmUngroup}
      />
      <CanvasBadge
        editMode={editMode}
        connectingFrom={connecting?.from ?? null}
      />
      <SelectionHud
        editMode={editMode}
        selectedTableNames={selectedTableNames}
        selectedGroup={selectedGroup}
        groups={groups}
        onGroup={handleGroupSelected}
        onMoveToGroup={moveSelectionToGroup}
        onRemoveFromGroups={removeSelectionFromGroups}
        onEnterGroup={enterGroup}
        onUngroup={handleUngroupSelected}
        onPreview={setGroupPreview}
      />
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
                <span>Connect</span>
                {RELATIONSHIP_KINDS.map(({ kind, label }) => (
                  <button
                    key={kind}
                    type="button"
                    className={styles.contextMenuChip}
                    onClick={() => handleStartConnect(kind)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <TableGroupMenuItems
                group={menuTableGroup}
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
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClickEvent}
        onSelectionChange={dropGroupSelection}
        onPaneClick={handlePaneClick}
        onNodeMouseEnter={handleMouseEnterNode}
        onNodeMouseLeave={handleMouseLeaveNode}
        onNodeDragStart={stopSettleAnimation}
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
        multiSelectionKeyCode={MULTI_SELECTION_KEYS}
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
