// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import {
  Background,
  BackgroundVariant,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import {
  type FC,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { useVersionOrThrow } from '../../../../providers'
import { useUserEditingOrThrow } from '../../../../stores'
import { selectTableLogEvent } from '../../../gtm/utils'
import { repositionTableLogEvent } from '../../../gtm/utils/repositionTableLogEvent'
import { MAX_ZOOM, MIN_ZOOM } from '../../../reactflow/constants'
import { useTableSelection } from '../../hooks'
import type { DisplayArea } from '../../types'
import {
  clampMemoFontSize,
  createMemo,
  DEFAULT_MEMO_FONT_SIZE,
  deserializeMemos,
  deserializeTableColors,
  deserializeTableLayout,
  getEffectiveMemos,
  getTableColor,
  highlightNodesAndEdges,
  isTableNode,
  MAX_MEMO_FONT_SIZE,
  type Memo,
  MIN_MEMO_FONT_SIZE,
  rememberTablePositions,
  saveStoredMemos,
  serializeMemos,
  serializeTableLayout,
  setTableColor,
  stepMemoFontSize,
  type ViewColorKey,
} from '../../utils'
import {
  MemoLayer,
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

export const ERDContentInner: FC<Props> = ({
  nodes: _nodes,
  edges: _edges,
  displayArea,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    displayArea === 'relatedTables'
      ? _nodes.map((node) =>
          isTableNode(node)
            ? { ...node, data: { ...node.data, showMode: 'TABLE_NAME' } }
            : node,
        )
      : _nodes,
  )

  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(_edges)
  const {
    state: { loading },
  } = useErdContentContext()
  const {
    activeTableName,
    tablePositions,
    setTablePositions,
    tableColors,
    setTableColors,
    memoEntries,
    setMemoEntries,
    editMode,
  } = useUserEditingOrThrow()
  const { screenToFlowPosition } = useReactFlow()

  const { selectTable, deselectTable } = useTableSelection()

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
    (_event, _node, nodes) => {
      // Tables are not draggable outside edit mode, so this is belt and
      // braces: a read-only view must never write a layout.
      if (!editMode) return

      const stored = rememberTablePositions(nodes.filter(isTableNode))
      // Keep the link shareable: merge over whatever the incoming URL carried
      // so positions from a shared link survive a local drag.
      setTablePositions(
        serializeTableLayout({
          ...deserializeTableLayout(tablePositions),
          ...stored,
        }),
      )

      const operationId = `id_${Date.now()}`
      for (const node of nodes) {
        const tableId = node.id
        repositionTableLogEvent({
          tableId,
          operationId,
          platform: version.displayedOn,
          gitHash: version.gitHash,
          ver: version.version,
          appEnv: version.envName,
        })
      }
    },
    [version, tablePositions, setTablePositions, editMode],
  )

  const [memos, setMemos] = useState<Memo[]>(() =>
    getEffectiveMemos(deserializeMemos(memoEntries)),
  )

  const handleMemosChange = useCallback(
    (next: Memo[]) => {
      setMemos(next)
      saveStoredMemos(next)
      // Mirror into the link so a memo can be shared without a deploy.
      setMemoEntries(serializeMemos(next))
    },
    [setMemoEntries],
  )

  // Right-click rather than double-click: double-click is already React
  // Flow's zoom gesture, and overriding it broke zooming in edit mode.
  const [menu, setMenu] = useState<CanvasMenu | null>(null)

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
      setMenu({ ...target, x: event.clientX, y: event.clientY })
    },
    [editMode],
  )

  /**
   * React Flow swallows the pane context menu whenever panOnDrag includes the
   * right button (it calls preventDefault and returns without invoking
   * onPaneContextMenu), so the event is caught on the wrapper instead. The
   * target tells us whether a table or empty canvas was clicked.
   */
  const handleCanvasContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const node =
        event.target instanceof Element
          ? event.target.closest('.react-flow__node')
          : null
      const tableName = node?.getAttribute('data-id')

      openMenu(
        event,
        tableName ? { kind: 'table', tableName } : { kind: 'pane' },
      )
    },
    [openMenu],
  )

  const handleMemoContextMenu = useCallback(
    (event: ReactMouseEvent, memo: Memo) => {
      openMenu(event, { kind: 'memo', memoId: memo.id })
    },
    [openMenu],
  )

  const handleAddMemo = useCallback(() => {
    if (menu?.kind !== 'pane') return

    const { x, y } = screenToFlowPosition({ x: menu.x, y: menu.y })
    handleMemosChange([...memos, createMemo(crypto.randomUUID(), x, y)])
    setMenu(null)
  }, [menu, memos, handleMemosChange, screenToFlowPosition])

  const handleSelectColor = useCallback(
    (color: ViewColorKey | null) => {
      if (menu?.kind === 'table') {
        setTableColor(menu.tableName, color)
        setNodes((current) =>
          current.map((node) =>
            node.id === menu.tableName
              ? { ...node, data: { ...node.data, color: color ?? undefined } }
              : node,
          ),
        )

        // Mirror into the link, keeping colours the link already carried.
        const urlColors = deserializeTableColors(tableColors)
        if (color === null) {
          delete urlColors[menu.tableName]
        } else {
          urlColors[menu.tableName] = color
        }
        setTableColors(
          Object.entries(urlColors).map(([name, key]) => `${name}:${key}`),
        )
      } else if (menu?.kind === 'memo') {
        handleMemosChange(
          memos.map((m) =>
            m.id === menu.memoId ? { ...m, color: color ?? undefined } : m,
          ),
        )
      }

      setMenu(null)
    },
    [menu, memos, handleMemosChange, setNodes, tableColors, setTableColors],
  )

  const handleDeleteMemo = useCallback(() => {
    if (menu?.kind !== 'memo') return

    handleMemosChange(memos.filter((m) => m.id !== menu.memoId))
    setMenu(null)
  }, [menu, memos, handleMemosChange])

  // The menu stays open so the size can be adjusted repeatedly; ViewColorMenu
  // swallows clicks so the dismiss listener below does not fire.
  const setMemoFontSize = useCallback(
    (fontSize: number) => {
      if (menu?.kind !== 'memo') return

      handleMemosChange(
        memos.map((m) => (m.id === menu.memoId ? { ...m, fontSize } : m)),
      )
    },
    [menu, memos, handleMemosChange],
  )

  const selectedMemo =
    menu?.kind === 'memo' ? memos.find((m) => m.id === menu.memoId) : undefined

  const selectedFontSize = selectedMemo?.fontSize ?? DEFAULT_MEMO_FONT_SIZE

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
      : menu?.kind === 'memo'
        ? memos.find((m) => m.id === menu.memoId)?.color
        : undefined

  const panOnDrag = [1, 2]

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: this only suppresses
    // the native menu and opens the editing menu; nothing here is a control.
    <div
      className={styles.wrapper}
      data-loading={loading}
      onContextMenu={handleCanvasContextMenu}
    >
      {loading && <Spinner className={styles.loading} />}
      {editMode && (
        <div className={styles.editBadge}>
          Edit mode · Ctrl/Cmd + right-click to add a memo or set a colour
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
                    setMemoFontSize(stepMemoFontSize(selectedMemo, -1))
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
                  value={selectedFontSize}
                  onChange={(event) =>
                    setMemoFontSize(
                      clampMemoFontSize(event.target.valueAsNumber),
                    )
                  }
                />
                <button
                  type="button"
                  className={styles.contextMenuStep}
                  aria-label="Increase font size"
                  onClick={() =>
                    selectedMemo &&
                    setMemoFontSize(stepMemoFontSize(selectedMemo, 1))
                  }
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className={styles.contextMenuItem}
                onClick={handleDeleteMemo}
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
        onNodeClick={(_, node) => handleNodeClick(node.id)}
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
      >
        <Background
          color="var(--color-gray-600)"
          variant={BackgroundVariant.Dots}
          size={1}
          gap={16}
        />
        <MemoLayer
          memos={memos}
          editMode={editMode}
          onChange={handleMemosChange}
          onContextMenu={handleMemoContextMenu}
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
