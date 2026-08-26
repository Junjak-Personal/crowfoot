// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node, XYPosition } from '@xyflow/react'
import { NON_RELATED_TABLE_GROUP_NODE_ID } from '../../constants'

type Params = {
  /** What React Flow is showing. */
  current: Node[]
  /** What the schema says it should be showing, from `convertSchemaToNodes`. */
  incoming: Node[]
  /**
   * Where a table that was not on the canvas a moment ago should appear, or
   * `null` when nothing pins it and only the automatic layout can say.
   */
  place: (tableId: string) => XYPosition | null
}

type ReconcileResult = {
  nodes: Node[]
  /** Tables whose handles may have changed — see the note on the export. */
  touched: string[]
  /**
   * Tables that arrived with nowhere to go. The caller has to lay the diagram
   * out, or they all pile up wherever the fallback put them.
   */
  unplaced: string[]
}

const ORIGIN: XYPosition = { x: 0, y: 0 }

const isTable = (node: Node): boolean => node.type === 'table'

const isNonRelatedGroup = (node: Node): boolean =>
  node.id === NON_RELATED_TABLE_GROUP_NODE_ID

const positionOf = (nodes: Node[], id: string | undefined): XYPosition =>
  (id === undefined ? undefined : nodes.find((node) => node.id === id))
    ?.position ?? ORIGIN

/**
 * `convertSchemaToNodes` rebuilds this record every time it runs, so comparing
 * it by reference would call every table that is the target of a foreign key
 * changed on every edit — on a schema where one table is referenced by a
 * hundred others, that is the whole diagram re-rendering to add one column.
 */
const sameCardinalities = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false

  const left = Object.entries(a)
  if (left.length !== Object.keys(b).length) return false

  const right: Record<string, unknown> = { ...b }
  return left.every(([column, cardinality]) => right[column] === cardinality)
}

/**
 * Whether the schema still describes this node exactly as it is. `data.table`
 * can be compared by reference because `applySchemaEdits` hands back the very
 * objects it was given for tables it did not touch.
 */
const isUnchanged = (node: Node, next: Node): boolean =>
  node.parentId === next.parentId &&
  node.data['table'] === next.data['table'] &&
  node.data['sourceColumnName'] === next.data['sourceColumnName'] &&
  sameCardinalities(
    node.data['targetColumnCardinalities'],
    next.data['targetColumnCardinalities'],
  )

/**
 * A table with no relationships is parented to the non-related group box, and
 * React Flow measures a child's position **relative to its parent**. Gaining or
 * losing a foreign key therefore changes which frame the coordinates are in —
 * without this correction a table jumps by the group's offset the moment it is
 * connected to something.
 */
const reframe = (
  node: Node,
  next: Node,
  current: Node[],
  incoming: Node[],
): XYPosition => {
  if (node.parentId === next.parentId) return node.position

  const out = positionOf(current, node.parentId)
  const into = positionOf(incoming, next.parentId)

  return {
    x: node.position.x + out.x - into.x,
    y: node.position.y + out.y - into.y,
  }
}

const merge = (
  node: Node,
  next: Node,
  current: Node[],
  incoming: Node[],
): Node => {
  // `parentId` is dropped rather than set to `undefined`: the group box goes
  // away entirely once every table has a relationship, and a node left pointing
  // at a parent that is no longer in the list breaks React Flow.
  //
  // `width`/`height` go too. The automatic layout writes both onto every node
  // it places (`convertElkNodesToNodes`), and React Flow honours them instead
  // of measuring — so a table given another column would render the row while
  // its box stayed the old size, and never report the growth that
  // `settleOverlaps` waits for. Dropping them hands measurement back.
  const {
    parentId: _former,
    width: _staleWidth,
    height: _staleHeight,
    ...carried
  } = node

  return {
    ...carried,
    // `data.color` is put there by the layout pass, not by the schema, so the
    // two are merged rather than replaced. Every key `convertSchemaToNodes`
    // produces is always present — set to `undefined` when it has no value — so
    // a foreign key being removed still clears the old cardinalities.
    data: { ...node.data, ...next.data },
    ...(next.parentId === undefined ? {} : { parentId: next.parentId }),
    position: reframe(node, next, current, incoming),
  }
}

/**
 * Brings the canvas in step with a schema that changed underneath it, without
 * throwing away what the canvas knows.
 *
 * Everything React Flow owns and the schema does not — where a table sits, what
 * is selected, how big a node measured, whether it is hidden — is carried over;
 * only the schema-derived `data` is replaced. Memos and user-authored group
 * boxes are not touched at all.
 *
 * **`nodes` is `current` itself when nothing changed.** The caller drives this
 * from an effect, so a fresh array on every call would loop forever.
 *
 * `touched` names the tables whose schema-derived data was replaced or that
 * arrived. Their column rows carry React Flow's handles, and React Flow does
 * not notice handles appearing on a node it has already mounted — the caller
 * has to hand these to `updateNodeInternals` or the new relationship has an
 * edge with nowhere to attach.
 */
export const reconcileTableNodes = ({
  current,
  incoming,
  place,
}: Params): ReconcileResult => {
  const unclaimed = new Map(
    incoming.filter(isTable).map((node) => [node.id, node]),
  )
  const incomingGroup = incoming.find(isNonRelatedGroup)

  const touched: string[] = []
  const unplaced: string[] = []
  let changed = false
  const kept: Node[] = []

  for (const node of current) {
    if (isNonRelatedGroup(node)) {
      if (incomingGroup) kept.push(node)
      else changed = true
      continue
    }

    if (!isTable(node)) {
      kept.push(node)
      continue
    }

    const next = unclaimed.get(node.id)
    if (!next) {
      changed = true
      continue
    }

    unclaimed.delete(node.id)
    if (isUnchanged(node, next)) {
      kept.push(node)
      continue
    }

    changed = true
    touched.push(node.id)
    kept.push(merge(node, next, current, incoming))
  }

  const added = Array.from(unclaimed.values(), (node) => {
    touched.push(node.id)

    const position = place(node.id)
    if (position !== null) {
      // Out of the container that gathers relationship-less tables, because
      // the position is a canvas coordinate and a parented node's is not:
      // React Flow reads it relative to the parent, so an absolute one landed
      // the table a whole container's offset away from where it was pinned.
      //
      // The container is for tables nobody has placed. Once one has been, it
      // has nothing left to say about it.
      const { parentId: _placed, ...free } = node
      return { ...free, position }
    }

    unplaced.push(node.id)
    return node
  })
  const groupIsNew =
    incomingGroup !== undefined && !current.some(isNonRelatedGroup)

  if (added.length > 0 || groupIsNew) changed = true
  if (!changed) return { nodes: current, touched: [], unplaced: [] }

  // React Flow requires a parent to appear before its children.
  const nodes = groupIsNew
    ? [incomingGroup, ...kept, ...added]
    : [...kept, ...added]

  return { nodes, touched, unplaced }
}
