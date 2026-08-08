// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Edge, Node, OnNodesChange, XYPosition } from '@xyflow/react'
import { useUpdateNodeInternals } from '@xyflow/react'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useUserEditingOrThrow } from '../../../../../stores'
import { useCustomReactflow } from '../../../../reactflow/hooks'
import type { DisplayArea } from '../../../types'
import {
  applyTableLayout,
  computeAutoLayout,
  deserializeTableLayout,
  dumpTableLayout,
  getEffectiveTableLayout,
  reconcileEdges,
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
  /**
   * The setters from `useNodesState` / `useEdgesState` — not the ones on the
   * React Flow instance. On a controlled flow those go through `onEdgesChange`
   * as `replace` changes, which can only swap an edge that is already there:
   * the edge a new relationship needs would be dropped on the floor.
   */
  setNodes: Dispatch<SetStateAction<Node[]>>
  setEdges: Dispatch<SetStateAction<Edge[]>>
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
  setNodes,
  setEdges,
}: Params) => {
  const { tablePositions } = useUserEditingOrThrow()
  const { getEdges, fitView } = useCustomReactflow()
  const updateNodeInternals = useUpdateNodeInternals()

  /**
   * Last known height of each table, so a schema edit that changes one can be
   * told apart from a plain re-measure. Renaming a column changes no height,
   * and so moves nothing.
   */
  const heightsRef = useRef(new Map<string, number>())
  /** Tables that just got taller. `null` means "not watching". */
  const grownRef = useRef<Set<string> | null>(null)
  /**
   * Tables whose handles React Flow has not been told about yet. A column row
   * grows a `<Handle>` the moment it becomes one end of a foreign key, and
   * React Flow does not look for handles appearing on a node it already
   * mounted — an edge pointing at one it has never seen has nowhere to attach.
   */
  const restatedRef = useRef<string[]>([])
  /**
   * Set when tables arrived that nothing pins. The schema is fetched after the
   * first render, so on load *every* table arrives this way — and with the
   * canvas no longer remounting when it lands, laying them out is this hook's
   * job rather than `useInitialAutoLayout`'s, which by then has already run
   * against whatever was on screen.
   */
  const needsLayoutRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isSettling, setIsSettling] = useState(false)

  const isMain = displayArea === 'main'

  /**
   * Where a table that was not on the canvas a moment ago should appear:
   * whatever pinned it (`Add table here` writes its drop point to `?positions=`
   * in the same commit), then the on-screen snapshot — which is how a *renamed*
   * table lands back on its own spot, `renameTableInLayout` having moved that
   * entry across.
   *
   * `null` means nothing pins it. Guessing a spot would pile every such table
   * on the same one; the caller lays the diagram out instead.
   */
  const place = useCallback(
    (tableId: string): XYPosition | null => {
      const pinned =
        dumpTableLayout()[tableId] ??
        getEffectiveTableLayout(deserializeTableLayout(tablePositions))[tableId]

      return pinned ? { x: pinned.x, y: pinned.y } : null
    },
    [tablePositions],
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

    setNodes((current) => {
      const { nodes, touched, unplaced } = reconcileTableNodes({
        current,
        incoming: incomingNodes,
        place,
      })
      // Writing a ref from an updater is normally a smell; this one is
      // idempotent, so React calling the updater twice in StrictMode records
      // the same list twice rather than compounding.
      if (touched.length > 0) restatedRef.current = touched
      if (unplaced.length > 0) needsLayoutRef.current = true
      return nodes
    })
    setEdges((current) => reconcileEdges(current, incomingEdges))
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
  // After the render that put the new handles in the DOM, never before it.
  useEffect(() => {
    const ids = restatedRef.current
    if (ids.length === 0) return
    restatedRef.current = []

    // Filtering against `nodes` is not only a guard against a table that was
    // removed again before this ran — it is what keeps `nodes` in the
    // dependency list. Without a reference to it in the body the exhaustive-deps
    // fixer strips it, and the effect then only ever runs on mount, when there
    // is nothing to restate. That is precisely how a new relationship ended up
    // with an edge React Flow could not attach until the page was reloaded.
    const present = new Set(nodes.map((node) => node.id))
    updateNodeInternals(ids.filter((id) => present.has(id)))
  }, [nodes, updateNodeInternals])

  /**
   * Lays out tables that arrived with nowhere to go, once React Flow has
   * measured them — ELK needs real sizes, and unmeasured nodes come out stacked
   * in a single column. Anything already pinned is put back afterwards.
   */
  useEffect(() => {
    if (!isMain || !needsLayoutRef.current) return

    const tables = nodes.filter((node) => node.type === 'table')
    if (tables.length === 0 || tables.some((node) => !node.measured)) return
    needsLayoutRef.current = false

    let cancelled = false
    const pinned = getEffectiveTableLayout(
      deserializeTableLayout(tablePositions),
    )

    computeAutoLayout(applyTableLayout(nodes, pinned), getEdges()).then(
      ({ nodes: laidOut }) => {
        if (cancelled) return

        const positioned = applyTableLayout(laidOut, pinned)
        setNodes(positioned)
        setResolvedTableLayout(positioned)
        fitView({ duration: 0 })
      },
    )

    return () => {
      cancelled = true
    }
  }, [isMain, nodes, tablePositions, getEdges, setNodes, fitView])

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
