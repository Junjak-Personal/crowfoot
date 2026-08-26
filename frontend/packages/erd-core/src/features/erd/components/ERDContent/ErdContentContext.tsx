import {
  createContext,
  type FC,
  type PropsWithChildren,
  useContext,
  useState,
} from 'react'

type ErdContentContextState = {
  loading: boolean
  /**
   * The group the canvas has selected, or null when the selection is tables.
   *
   * Selecting a group and selecting the tables inside it used to be the same
   * act: the header put every member into React Flow's selection, so nothing
   * on screen — and nothing in the code — could tell "this group" from "these
   * five tables", and a command had no way to know which one was meant. They
   * are two states now, and at most one of them is ever set: this, or React
   * Flow's own `node.selected`.
   */
  selectedGroupId: string | null
  /**
   * The membership each group would have, drawn instead of the one it has,
   * while the pointer rests on the menu row that would do it. Keyed by group
   * id; a group absent from the record is drawn as it stands.
   *
   * It is the *result*, not the change, so moving and removing are the same
   * shape here — and an empty one draws no box at all, which is what emptying
   * a group means. Several groups at once because a move takes tables out of
   * one group as it puts them in another. The box is derived from its members'
   * bounds every render, so nothing else has to know this exists.
   */
  groupPreview: Record<string, string[]> | null
  /**
   * Every table some group claims.
   *
   * Zoomed out far enough a group draws for its members and they are hidden,
   * and a table cannot work that out for itself: a group is a sibling node, not
   * an ancestor, so neither the DOM nor the CSS puts one inside the other. This
   * is the one thing that has to be handed down.
   */
  groupedTables: ReadonlySet<string>
}

type ErdContentContextActions = {
  setLoading: (loading: boolean) => void
  setSelectedGroupId: (groupId: string | null) => void
  setGroupPreview: (preview: Record<string, string[]> | null) => void
  setGroupedTables: (tables: ReadonlySet<string>) => void
}

type ErdContentConextValue = {
  state: ErdContentContextState
  actions: ErdContentContextActions
}

const ErdContentContext = createContext<ErdContentConextValue>({
  state: {
    loading: true,
    selectedGroupId: null,
    groupPreview: null,
    groupedTables: new Set<string>(),
  },
  actions: {
    setLoading: () => {},
    setSelectedGroupId: () => {},
    setGroupPreview: () => {},
    setGroupedTables: () => {},
  },
})

export const useErdContentContext = () => useContext(ErdContentContext)

export const ErdContentProvider: FC<PropsWithChildren> = ({ children }) => {
  const [loading, setLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [groupPreview, setGroupPreview] = useState<Record<
    string,
    string[]
  > | null>(null)
  const [groupedTables, setGroupedTables] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  )

  return (
    <ErdContentContext.Provider
      value={{
        state: { loading, selectedGroupId, groupPreview, groupedTables },
        actions: {
          setLoading,
          setSelectedGroupId,
          setGroupPreview,
          setGroupedTables,
        },
      }}
    >
      {children}
    </ErdContentContext.Provider>
  )
}
