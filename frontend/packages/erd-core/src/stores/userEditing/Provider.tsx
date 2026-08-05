// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
'use client'

import {
  createParser,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import {
  type FC,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from 'react'
import type { TableNodeType } from '../../features/erd/types'
import type { ShowMode } from '../../schemas'
import { compressToEncodedUriComponent } from '../../utils/compressToEncodedUriComponent'
import { decompressFromEncodedUriComponent } from '../../utils/decompressFromEncodedUriComponent'
import { UserEditingContext } from './context'

const parseAsCompressedStringArray = createParser({
  parse: (value: string): string[] => {
    const decompressed = decompressFromEncodedUriComponent(value)

    if (!decompressed) return []
    return decompressed.split(',').filter(Boolean)
  },

  serialize: (value: string[]): string => {
    if (value.length === 0) return ''

    const joined = value.join(',')
    const compressed = compressToEncodedUriComponent(joined)

    return compressed
  },
})

/**
 * `?show=all|table|key` — short, typeable values rather than the internal
 * ALL_FIELDS / TABLE_NAME / KEY_ONLY names.
 */
const SHOW_MODE_BY_PARAM: Record<string, ShowMode> = {
  all: 'ALL_FIELDS',
  table: 'TABLE_NAME',
  key: 'KEY_ONLY',
}

const PARAM_BY_SHOW_MODE: Record<ShowMode, string> = {
  ALL_FIELDS: 'all',
  TABLE_NAME: 'table',
  KEY_ONLY: 'key',
}

const parseAsShowMode = createParser({
  parse: (value: string): ShowMode | null => SHOW_MODE_BY_PARAM[value] ?? null,
  serialize: (value: ShowMode): string => PARAM_BY_SHOW_MODE[value],
})

/**
 * Memos go in as one compressed JSON blob rather than a comma-joined list:
 * their text is free-form and would be shredded by the array parser's split.
 */
const parseAsCompressedString = createParser({
  parse: (value: string): string =>
    decompressFromEncodedUriComponent(value) ?? '',

  serialize: (value: string): string =>
    value === '' ? '' : compressToEncodedUriComponent(value),
})

type UserEditingProviderValue = {
  showDiff?: boolean | undefined
  defaultShowMode?: ShowMode | undefined
}

type Props = PropsWithChildren & UserEditingProviderValue

export const UserEditingProvider: FC<Props> = ({
  children,
  showDiff: initialShowDiff = false,
  defaultShowMode = 'ALL_FIELDS',
}) => {
  const [activeTableName, _setActiveTableName] = useQueryState(
    'active',
    parseAsString.withDefault('').withOptions({ history: 'push' }),
  )

  const setActiveTableName: typeof _setActiveTableName = useCallback(
    (...args) => {
      location.hash = ''
      return _setActiveTableName(...args)
    },
    [_setActiveTableName],
  )

  const [focusedElementId, setFocusedElementId] = useState(
    typeof location === 'object'
      ? // location.hash starts with '#'; decode to match actual DOM id
        location.hash.slice(1)
      : '',
  )

  // update focusedElementId when hash changes
  useEffect(() => {
    const updateState = () => {
      const elementId = location.hash.slice(1)
      setFocusedElementId(elementId)
    }

    window.addEventListener('hashchange', updateState)
    return () => window.removeEventListener('hashchange', updateState)
  }, [])

  const [showMode, setShowMode] = useQueryState(
    'show',
    parseAsShowMode.withDefault(defaultShowMode).withOptions({
      history: 'push',
    }),
  )

  const [hiddenNodeIds, setHiddenNodeIds] = useQueryState(
    'hidden',
    parseAsCompressedStringArray.withDefault([]).withOptions({
      history: 'push',
    }),
  )

  // 'replace' rather than 'push': editing the view should not fill up the back
  // button the way toggling visibility does.
  const [tablePositions, setTablePositions] = useQueryState(
    'positions',
    parseAsCompressedStringArray.withDefault([]).withOptions({
      history: 'replace',
    }),
  )

  const [tableColors, setTableColors] = useQueryState(
    'colors',
    parseAsCompressedStringArray.withDefault([]).withOptions({
      history: 'replace',
    }),
  )

  const [memoEntries, setMemoEntries] = useQueryState(
    'memos',
    parseAsCompressedString.withDefault('').withOptions({
      history: 'replace',
    }),
  )

  const [groupEntries, setGroupEntries] = useQueryState(
    'groups',
    parseAsCompressedString.withDefault('').withOptions({
      history: 'replace',
    }),
  )

  // A view/navigation action, same family as `?show=` and `?hidden=` — not
  // editing, so it gets 'push' rather than 'replace'. The vocabulary is
  // `on|off` rather than a boolean so it reads like `?show=all|table|key`;
  // the context only ever exposes the resolved boolean below.
  const [showGroupsParam, setShowGroupsParam] = useQueryState(
    'showgroups',
    parseAsStringLiteral(['on', 'off']).withDefault('on').withOptions({
      history: 'push',
    }),
  )

  const showGroups = showGroupsParam === 'on'

  const setShowGroups: (showGroups: boolean | null) => void = useCallback(
    (value) => setShowGroupsParam(value === null ? null : value ? 'on' : 'off'),
    [setShowGroupsParam],
  )

  // Read-only by default so a shared link cannot be messed up by accident.
  // Accepts `?edit=1` as well as `?edit=true`.
  const [editParam] = useQueryState('edit', parseAsString.withDefault(''))
  const editMode = editParam === '1' || editParam === 'true'

  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [isPopstateInProgress, setIsPopstateInProgress] = useState(false)
  const [showDiff, setShowDiff] = useState(initialShowDiff)

  useEffect(() => {
    setShowDiff(initialShowDiff)
  }, [initialShowDiff])

  const toggleHiddenNodeId = useCallback(
    (nodeId: string) => {
      setHiddenNodeIds((prev) => {
        const newHiddenNodeIds = new Set(prev)

        if (newHiddenNodeIds.has(nodeId)) {
          newHiddenNodeIds.delete(nodeId)
        } else {
          newHiddenNodeIds.add(nodeId)
        }

        return Array.from(newHiddenNodeIds)
      })
    },
    [setHiddenNodeIds],
  )

  const calculateSelectionRange = useCallback(
    (lastSelectedId: string, currentNodeId: string, nodeIds: string[]) => {
      const lastIndex = nodeIds.indexOf(lastSelectedId)
      const currentIndex = nodeIds.indexOf(currentNodeId)

      if (lastIndex === -1 || currentIndex === -1) return null

      return {
        start: Math.min(lastIndex, currentIndex),
        end: Math.max(lastIndex, currentIndex),
      }
    },
    [],
  )

  const addNodesInRange = useCallback(
    (
      selectedIds: Set<string>,
      nodeIds: string[],
      start: number,
      end: number,
    ) => {
      for (let i = start; i <= end; i++) {
        const id = nodeIds[i]
        if (typeof id === 'string') {
          selectedIds.add(id)
        }
      }
    },
    [],
  )

  const handleShiftSelection = useCallback(
    (nodeId: string, nodeIds: string[], currentSelectedIds: Set<string>) => {
      const newSelectedIds = new Set(currentSelectedIds)

      if (newSelectedIds.size === 0) {
        newSelectedIds.add(nodeId)
        setSelectedNodeIds(newSelectedIds)
        return
      }

      const lastSelectedId = Array.from(newSelectedIds).pop()
      if (!lastSelectedId) return

      const range = calculateSelectionRange(lastSelectedId, nodeId, nodeIds)
      if (!range) return

      addNodesInRange(newSelectedIds, nodeIds, range.start, range.end)
      setSelectedNodeIds(newSelectedIds)
    },
    [calculateSelectionRange, addNodesInRange],
  )

  const handleCtrlSelection = useCallback(
    (nodeId: string, currentSelectedIds: Set<string>) => {
      const newSelectedIds = new Set(currentSelectedIds)

      if (newSelectedIds.has(nodeId)) {
        newSelectedIds.delete(nodeId)
      } else {
        newSelectedIds.add(nodeId)
      }

      setSelectedNodeIds(newSelectedIds)
    },
    [],
  )

  const handleSingleSelection = useCallback((nodeId: string) => {
    setSelectedNodeIds(new Set([nodeId]))
  }, [])

  const updateSelectedNodeIds = useCallback(
    (
      nodeId: string,
      isMultiSelect: 'ctrl' | 'shift' | 'single',
      nodes: TableNodeType[],
    ) => {
      const nodeIds = nodes.map((node) => node.id)

      if (isMultiSelect === 'shift') {
        handleShiftSelection(nodeId, nodeIds, selectedNodeIds)
      } else if (isMultiSelect === 'ctrl') {
        handleCtrlSelection(nodeId, selectedNodeIds)
      } else {
        handleSingleSelection(nodeId)
      }
    },
    [
      handleShiftSelection,
      handleCtrlSelection,
      handleSingleSelection,
      selectedNodeIds,
    ],
  )

  const resetSelectedNodeIds = useCallback(() => {
    setSelectedNodeIds(new Set())
  }, [])

  return (
    <UserEditingContext.Provider
      value={{
        // URL synchronized state
        activeTableName,
        setActiveTableName,
        focusedElementId,
        showMode,
        setShowMode,
        hiddenNodeIds,
        setHiddenNodeIds,
        toggleHiddenNodeId,
        tablePositions,
        setTablePositions,
        tableColors,
        setTableColors,
        memoEntries,
        setMemoEntries,
        groupEntries,
        setGroupEntries,
        showGroups,
        setShowGroups,
        editMode,
        // Local state
        selectedNodeIds,
        updateSelectedNodeIds,
        resetSelectedNodeIds,
        isPopstateInProgress,
        setIsPopstateInProgress,
        showDiff,
        setShowDiff,
      }}
    >
      {children}
    </UserEditingContext.Provider>
  )
}
