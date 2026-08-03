// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import type { Node } from '@xyflow/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUserEditingOrThrow } from '../../../../../stores'
import { useCustomReactflow } from '../../../../reactflow/hooks'
import type { DisplayArea } from '../../../types'
import {
  applyTableLayout,
  computeAutoLayout,
  deserializeTableColors,
  deserializeTableLayout,
  getEffectiveTableLayout,
  highlightNodesAndEdges,
  resolveTableColor,
  setResolvedTableLayout,
} from '../../../utils'
import { useErdContentContext } from '../ErdContentContext'
import { hasNonRelatedChildNodes, updateNodesHiddenState } from '../utils'

type Params = {
  nodes: Node[]
  displayArea: DisplayArea
}

export const useInitialAutoLayout = ({ nodes, displayArea }: Params) => {
  const { activeTableName, hiddenNodeIds, tablePositions, tableColors } =
    useUserEditingOrThrow()
  const { getEdges, setNodes, setEdges, fitView } = useCustomReactflow()
  const {
    actions: { setLoading },
  } = useErdContentContext()

  const [initializeComplete, setInitializeComplete] = useState(false)

  const tableNodesInitialized = useMemo(() => {
    return nodes
      .filter((node) => node.type === 'table')
      .some((node) => node.measured)
  }, [nodes])

  const initialize = useCallback(async () => {
    if (initializeComplete) {
      return
    }

    if (tableNodesInitialized) {
      setLoading(true)

      const updateNodes =
        displayArea === 'main'
          ? updateNodesHiddenState({
              nodes,
              hiddenNodeIds,
              shouldHideGroupNodeId: !hasNonRelatedChildNodes(nodes),
            })
          : nodes
      const { nodes: highlightedNodes, edges: highlightedEdges } =
        highlightNodesAndEdges(updateNodes, getEdges(), {
          activeTableName: activeTableName ?? undefined,
        })
      // Seed pinned positions before layout so ELK's INTERACTIVE strategy
      // places unpinned tables around them, then re-apply so pinned tables
      // land exactly where they were saved.
      const tableLayout = getEffectiveTableLayout(
        deserializeTableLayout(tablePositions),
      )
      const { nodes: layoutedNodes, edges: layoutedEdges } =
        await computeAutoLayout(
          applyTableLayout(highlightedNodes, tableLayout),
          highlightedEdges,
        )
      const positionedNodes = applyTableLayout(layoutedNodes, tableLayout)
      setResolvedTableLayout(positionedNodes)

      // Colour lives in node data so React Flow re-renders the table when it
      // changes; the layout entry is only the source of truth on load.
      const urlColors = deserializeTableColors(tableColors)
      const colouredNodes = positionedNodes.map((node) => {
        const color = resolveTableColor(node.id, tableLayout, urlColors)
        return color ? { ...node, data: { ...node.data, color } } : node
      })

      setNodes(colouredNodes)
      setEdges(layoutedEdges)

      const fitViewOptions =
        displayArea === 'main' && activeTableName
          ? { maxZoom: 1, duration: 300, nodes: [{ id: activeTableName }] }
          : { duration: 0 }
      fitView(fitViewOptions)

      setInitializeComplete(true)
      setLoading(false)
    }
  }, [
    initializeComplete,
    tableNodesInitialized,
    activeTableName,
    displayArea,
    hiddenNodeIds,
    tablePositions,
    tableColors,
    nodes,
    getEdges,
    setNodes,
    setEdges,
    setLoading,
    fitView,
  ])

  useEffect(() => {
    initialize()
  }, [initialize])
}
