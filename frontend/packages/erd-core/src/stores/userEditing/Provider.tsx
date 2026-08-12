// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
'use client'

import {
  createParser,
  type Options,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import {
  type FC,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { TableNodeType } from '../../features/erd/types'
import {
  cacheBaseDocuments,
  getBaseDocuments,
  getBaseVersion,
} from '../../features/erd/utils/baseVersion'
import type { ShowMode } from '../../schemas'
import { compressToEncodedUriComponent } from '../../utils/compressToEncodedUriComponent'
import { decompressFromEncodedUriComponent } from '../../utils/decompressFromEncodedUriComponent'
import { type EditWrite, UserEditingContext } from './context'

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
  const [tablePositions, _setTablePositions] = useQueryState(
    'positions',
    parseAsCompressedStringArray.withDefault([]).withOptions({
      history: 'replace',
    }),
  )

  const [tableColors, _setTableColors] = useQueryState(
    'colors',
    parseAsCompressedStringArray.withDefault([]).withOptions({
      history: 'replace',
    }),
  )

  const [memoEntries, _setMemoEntries] = useQueryState(
    'memos',
    parseAsCompressedString.withDefault('').withOptions({
      history: 'replace',
    }),
  )

  const [groupEntries, _setGroupEntries] = useQueryState(
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
  //
  // 'push' like the other mode parameters: the back button should leave edit
  // mode, and nothing here writes on every drag the way the editing parameters
  // below do, so the history stack stays readable.
  const [editParam, setEditParam] = useQueryState(
    'edit',
    parseAsString.withDefault('').withOptions({ history: 'push' }),
  )
  const editMode = editParam === '1' || editParam === 'true'

  const setEditMode: (editMode: boolean) => void = useCallback(
    (value) => {
      setEditParam(value ? '1' : null)
    },
    [setEditParam],
  )

  const [schemaEdits, _setSchemaEdits] = useQueryState(
    'schemaedits',
    parseAsCompressedString.withDefault('').withOptions({
      history: 'replace',
    }),
  )

  /**
   * Which deployed documents these edits were written against.
   *
   * Every edit parameter above carries only the difference from what the build
   * shipped, so a link is only meaningful next to the documents it was made
   * from. Stamping happens here rather than at the five commit sites because
   * "any edit write also records the version it was made against" is one rule,
   * and five copies of it is four chances to forget.
   *
   * It is never rewritten on load: a mismatch is reported, and the next edit
   * stamps the current version on its way out.
   */
  const [baseVersionParam, setBaseVersionParam] = useQueryState(
    'base',
    parseAsString.withDefault('').withOptions({ history: 'replace' }),
  )

  /**
   * Wraps an edit setter so it stamps the version, and so it lands in the back
   * button in the right place.
   *
   * A finished edit is a history entry, because the back button is how an edit
   * is undone. A `transient` one is not: memo text is written on every
   * keystroke, and a history entry per character would take forty presses to
   * get back across one sentence. Those write over the current entry and the
   * gesture pushes once when it ends.
   */
  const stamped = useCallback(
    <T,>(set: (value: T, options?: Options) => unknown) =>
      (value: T, { transient = false }: EditWrite = {}) => {
        const history = transient ? 'replace' : 'push'
        const version = getBaseVersion()

        if (version !== '') {
          setBaseVersionParam(version, { history })
          // The first edit is also when the documents it was made against
          // become worth keeping — see `cacheBaseDocuments`. Subsequent edits
          // cost one small `getItem`.
          const documents = getBaseDocuments()
          if (documents) cacheBaseDocuments(version, documents)
        }

        return set(value, { history })
      },
    [setBaseVersionParam],
  )

  const setTablePositions = useMemo(
    () => stamped(_setTablePositions),
    [stamped, _setTablePositions],
  )
  const setTableColors = useMemo(
    () => stamped(_setTableColors),
    [stamped, _setTableColors],
  )
  const setMemoEntries = useMemo(
    () => stamped(_setMemoEntries),
    [stamped, _setMemoEntries],
  )
  const setGroupEntries = useMemo(
    () => stamped(_setGroupEntries),
    [stamped, _setGroupEntries],
  )
  const setSchemaEdits = useMemo(
    () => stamped(_setSchemaEdits),
    [stamped, _setSchemaEdits],
  )

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
        setEditMode,
        schemaEdits,
        setSchemaEdits,
        baseVersionParam,
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
