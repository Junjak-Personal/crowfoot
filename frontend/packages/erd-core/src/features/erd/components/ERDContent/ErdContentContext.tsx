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
   * A membership a group would have, drawn instead of the one it has, while
   * the pointer rests on the menu row that would do it.
   *
   * It is the *result*, not the change, so adding and removing are the same
   * shape here — and an empty one draws no box at all, which is what emptying
   * a group means. The box is derived from its members' bounds every render,
   * so nothing else has to know this exists.
   */
  groupPreview: { groupId: string; tableNames: string[] } | null
}

type ErdContentContextActions = {
  setLoading: (loading: boolean) => void
  setSelectedGroupId: (groupId: string | null) => void
  setGroupPreview: (
    preview: { groupId: string; tableNames: string[] } | null,
  ) => void
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
  },
  actions: {
    setLoading: () => {},
    setSelectedGroupId: () => {},
    setGroupPreview: () => {},
  },
})

export const useErdContentContext = () => useContext(ErdContentContext)

export const ErdContentProvider: FC<PropsWithChildren> = ({ children }) => {
  const [loading, setLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [groupPreview, setGroupPreview] = useState<{
    groupId: string
    tableNames: string[]
  } | null>(null)

  return (
    <ErdContentContext.Provider
      value={{
        state: { loading, selectedGroupId, groupPreview },
        actions: { setLoading, setSelectedGroupId, setGroupPreview },
      }}
    >
      {children}
    </ErdContentContext.Provider>
  )
}
