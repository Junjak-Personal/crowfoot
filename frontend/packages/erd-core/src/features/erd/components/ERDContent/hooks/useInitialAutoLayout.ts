import type { Node } from '@xyflow/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUserEditingOrThrow } from '../../../../../stores'
import { useCustomReactflow } from '../../../../reactflow/hooks'
import type { DisplayArea } from '../../../types'
import {
  applyTableLayout,
  computeAutoLayout,
  deserializeTableLayout,
  getEffectiveTableLayout,
  highlightNodesAndEdges,
  setResolvedTableLayout,
} from '../../../utils'
import { useErdContentContext } from '../ErdContentContext'
import { hasNonRelatedChildNodes, updateNodesHiddenState } from '../utils'

type Params = {
  nodes: Node[]
  displayArea: DisplayArea
}

export const useInitialAutoLayout = ({ nodes, displayArea }: Params) => {
  const { activeTableName, hiddenNodeIds, tablePositions } =
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

      setNodes(positionedNodes)
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
