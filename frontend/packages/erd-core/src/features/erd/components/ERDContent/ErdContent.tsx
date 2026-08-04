// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.

import { useToast } from '@liam-hq/ui'
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
import { selectTableLogEvent } from '../../../gtm/utils'
import { repositionTableLogEvent } from '../../../gtm/utils/repositionTableLogEvent'
import { MAX_ZOOM, MIN_ZOOM } from '../../../reactflow/constants'
import { useMemoNodes, useTableSelection } from '../../hooks'
import type { DisplayArea, MemoNodeType } from '../../types'
import {
  clampMemoFontSize,
  createMemo,
  DEFAULT_MEMO_FONT_SIZE,
  deserializeMemos,
  deserializeTableColors,
  deserializeTableLayout,
  duplicateMemo,
  getEffectiveMemos,
  getTableColor,
  highlightNodesAndEdges,
  isMemoNode,
  isTableNode,
  MAX_MEMO_FONT_SIZE,
  MIN_MEMO_FONT_SIZE,
  memoNodesFrom,
  memoToNode,
  nodeToMemo,
  parseMemosFromClipboard,
  placeMemos,
  rememberTablePositions,
  serializeMemosToClipboard,
  serializeTableLayout,
  setTableColor,
  stepMemoFontSize,
  type ViewColorKey,
} from '../../utils'
import {
  MemoNode,
  NonRelatedTableGroupNode,
  RelationshipEdge,
  Spinner,
  TableNode,
  ViewColorMenu,
} from './components'
import styles from './ERDContent.module.css'
import { ErdContentProvider, useErdContentContext } from './ErdContentContext'
import { useInitialAutoLayout, useQueryParamsChanged } from './hooks'

const nodeTypes = {
  table: TableNode,
  nonRelatedTableGroup: NonRelatedTableGroupNode,
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

type CanvasMenu = CanvasMenuTarget & { x: number; y: number }

/** "Memo copied" / "3 memos pasted" — the count only earns a plural. */
const memoCountLabel = (count: number, verb: 'copied' | 'pasted') =>
  count === 1 ? `Memo ${verb}` : `${count} memos ${verb}`

export const ERDContentInner: FC<Props> = ({
  nodes: _nodes,
  edges: _edges,
  displayArea,
}) => {
  const {
    activeTableName,
    tablePositions,
    setTablePositions,
    tableColors,
    setTableColors,
    memoEntries,
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

    // Memos join the node list up front so React Flow owns their selection and
    // position from the first render, the same as it does for tables.
    return [
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

      const tables = dragged.filter(isTableNode)
      if (tables.length > 0) {
        const stored = rememberTablePositions(tables)
        // Keep the link shareable: merge over whatever the incoming URL carried
        // so positions from a shared link survive a local drag.
        setTablePositions(
          serializeTableLayout({
            ...deserializeTableLayout(tablePositions),
            ...stored,
          }),
        )

        const operationId = `id_${Date.now()}`
        for (const node of tables) {
          repositionTableLogEvent({
            tableId: node.id,
            operationId,
            platform: version.displayedOn,
            gitHash: version.gitHash,
            ver: version.version,
            appEnv: version.envName,
          })
        }
      }

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
    [version, tablePositions, setTablePositions, editMode, commitMemos],
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
      const element =
        event.target instanceof Element
          ? event.target.closest('.react-flow__node')
          : null
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

  const handleSelectColor = useCallback(
    (color: ViewColorKey | null) => {
      if (menu?.kind === 'table') {
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
      } else if (menu?.kind === 'memo') {
        const memoIds = new Set(selectedIdsOf('memo'))
        commitMemos((current) =>
          current.map((node) =>
            memoIds.has(node.id)
              ? { ...node, data: { ...node.data, color: color ?? undefined } }
              : node,
          ),
        )
      }

      setMenu(null)
    },
    [menu, selectedIdsOf, commitMemos, setNodes, tableColors, setTableColors],
  )

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

  const selectedColor =
    menu?.kind === 'table'
      ? getTableColor(menu.tableName)
      : selectedMemo?.data.color

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
        </ViewColorMenu>
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
