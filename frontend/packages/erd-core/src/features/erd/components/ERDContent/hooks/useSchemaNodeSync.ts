// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Edge, Node, OnNodesChange, XYPosition } from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useUserEditingOrThrow } from '../../../../../stores'
import { useCustomReactflow } from '../../../../reactflow/hooks'
import type { DisplayArea } from '../../../types'
import {
  deserializeTableLayout,
  dumpTableLayout,
  getEffectiveTableLayout,
  reconcileTableNodes,
  setResolvedTableLayout,
  settleOverlaps,
} from '../../../utils'

/** Long enough to read as making room, short enough not to be in the way. */
const SETTLE_ANIMATION_MS = 200

type Params = {
  /** What React Flow is showing. */
  nodes: Node[]
  /** What the schema says it should show — memoised on `(schema, showMode)`. */
  incomingNodes: Node[]
  incomingEdges: Edge[]
  displayArea: DisplayArea
  /** React Flow's own handler, from `useNodesState`. */
  onNodesChange: OnNodesChange<Node>
}

/**
 * Keeps the canvas in step with a schema edited underneath it, without
 * rebuilding it.
 *
 * The canvas used to be remounted on a key derived from the schema hash, which
 * is what made every edit reset the viewport, re-run the automatic layout over
 * tables nobody had moved, and drop the selection. Here the node list is
 * reconciled instead: only schema-derived `data` is replaced, and when a table
 * grows the tables below it slide down to make room.
 *
 * Only the main canvas. The related-tables preview is a read-only snapshot
 * built from its own extracted schema and remounted whenever the drawer opens,
 * so it has nothing to reconcile against.
 */
export const useSchemaNodeSync = ({
  nodes,
  incomingNodes,
  incomingEdges,
  displayArea,
  onNodesChange,
}: Params) => {
  const { tablePositions } = useUserEditingOrThrow()
  const { setNodes, setEdges, screenToFlowPosition } = useCustomReactflow()

  /**
   * Last known height of each table, so a schema edit that changes one can be
   * told apart from a plain re-measure. Renaming a column changes no height,
   * and so moves nothing.
   */
  const heightsRef = useRef(new Map<string, number>())
  /** Tables that just got taller. `null` means "not watching". */
  const grownRef = useRef<Set<string> | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isSettling, setIsSettling] = useState(false)

  const isMain = displayArea === 'main'

  /**
   * Where a table that was not on the canvas a moment ago should appear:
   * whatever pinned it (`Add table here` writes its drop point to `?positions=`
   * in the same commit), then the on-screen snapshot — which is how a *renamed*
   * table lands back on its own spot, `renameTableInLayout` having moved that
   * entry across — and only then the middle of the view.
   */
  const place = useCallback(
    (tableId: string): XYPosition => {
      const pinned =
        dumpTableLayout()[tableId] ??
        getEffectiveTableLayout(deserializeTableLayout(tablePositions))[tableId]

      return pinned
        ? { x: pinned.x, y: pinned.y }
        : screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          })
    },
    [tablePositions, screenToFlowPosition],
  )

  const stopSettleAnimation = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setIsSettling(false)
  }, [])

  useEffect(() => stopSettleAnimation, [stopSettleAnimation])

  /**
   * An effect rather than an event hook: the schema changes outside this
   * component and React Flow, not this render, owns the node list. What would
   * normally make that a loop is closed by `reconcileTableNodes` returning its
   * input untouched when nothing changed.
   */
  useEffect(() => {
    if (!isMain) return

    // The schema moved, so the measurements that follow are the ones worth
    // watching. Arming with an empty set is what makes this self-disarming on
    // first mount: nothing has a previous height to have grown from.
    grownRef.current = new Set()

    setNodes((current) =>
      reconcileTableNodes({ current, incoming: incomingNodes, place }),
    )
    setEdges(incomingEdges)
  }, [isMain, incomingNodes, incomingEdges, place, setNodes, setEdges])

  /**
   * React Flow measures nodes itself, so this is how a table that grew makes
   * itself known. Heights come off the changes rather than out of the node
   * list, which has not had them applied yet.
   */
  const handleNodesChange: OnNodesChange<Node> = useCallback(
    (changes) => {
      onNodesChange(changes)

      for (const change of changes) {
        if (change.type !== 'dimensions' || !change.dimensions) continue

        const previous = heightsRef.current.get(change.id)
        const height = change.dimensions.height
        heightsRef.current.set(change.id, height)

        // No previous height means this is a first measurement, not growth.
        if (previous !== undefined && height > previous) {
          grownRef.current?.add(change.id)
        }
      }
    },
    [onNodesChange],
  )

  /**
   * Makes room once React Flow has measured. Driven off `nodes` rather than
   * out of `observeMeasurements` so the sizes it reads are the ones already
   * committed to state.
   */
  useEffect(() => {
    const grown = grownRef.current
    if (!isMain || !grown?.size) return
    grownRef.current = null

    const settled = settleOverlaps({ nodes, grownIds: grown })
    if (settled === nodes) return

    setNodes(settled)
    // Keep the module's on-screen snapshot honest: renames and the layout.json
    // dump both read it.
    setResolvedTableLayout(settled)

    setIsSettling(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(
      () => setIsSettling(false),
      SETTLE_ANIMATION_MS,
    )
  }, [isMain, nodes, setNodes])

  return { handleNodesChange, isSettling, stopSettleAnimation }
}
