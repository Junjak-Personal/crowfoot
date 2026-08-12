// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Schema } from '@crowfoot/schema'
import type { RecordDiff } from '../../../../utils/recordDiff'
import type { Group } from '../group'
import type { Memo } from '../memo'
import type { BaseDocuments } from './baseCache'

/**
 * Which deployed documents a link's edits were written against.
 *
 * A link carries only the difference from `schema.json`, `layout.json`,
 * `groups.json` and `memos.json`, which is what lets a redeploy reach everyone
 * holding one. The other side of that bargain is that a redeploy can move the
 * ground under an old link — a group can name a table the schema no longer
 * has, a tombstone can point at something already gone. This is how the viewer
 * notices and says so, rather than quietly applying an edit to a document it
 * was never meant for.
 *
 * FNV-1a rather than a real digest: this is a staleness hint, not a security
 * boundary, and it rides in every history entry, so it has to be short.
 */
const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

const fnv1a = (text: string): number => {
  let hash = FNV_OFFSET
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return hash >>> 0
}

/**
 * The build's git hash would be wrong in both directions — it changes on
 * releases that touch none of these, and would not change if only a sidecar
 * were redeployed. The documents themselves are the thing edits are relative
 * to, so they are what is hashed.
 */
export const baseVersionOf = (documents: unknown[]): string =>
  fnv1a(JSON.stringify(documents)).toString(16).padStart(8, '0')

let baseVersion = ''
let baseDocuments: BaseDocuments | null = null

/**
 * Called once by the host app with what it fetched. Order matters — the
 * documents are hashed as an array, so the same four in a different order
 * would look like a different deploy.
 */
export const registerBaseDocuments = (documents: BaseDocuments): void => {
  baseDocuments = documents
  baseVersion = baseVersionOf([
    documents.schema,
    documents.layout,
    documents.memos,
    documents.groups,
  ])
}

export const getBaseVersion = (): string => baseVersion

export const getBaseDocuments = (): BaseDocuments | null => baseDocuments

/**
 * What a link refers to that the deployed documents no longer have.
 *
 * "The version is different" on its own gets ignored; what makes the notice
 * worth reading is which of your edits could not be applied. Everything here
 * is skipped silently by `applyDiff` — this only counts it.
 */
export type StaleReferences = {
  /** Tables named by a group in the link that the schema no longer has. */
  missingTables: string[]
  /** Ids the link deletes that are not in the deployed documents anyway. */
  emptyTombstones: number
}

export const isStale = (stale: StaleReferences): boolean =>
  stale.missingTables.length > 0 || stale.emptyTombstones > 0

export const staleReferences = ({
  schema,
  baseGroups,
  baseMemos,
  groupDiff,
  memoDiff,
}: {
  schema: Schema
  baseGroups: Group[]
  baseMemos: Memo[]
  groupDiff: RecordDiff<Group> | null
  memoDiff: RecordDiff<Memo> | null
}): StaleReferences => {
  const tables = new Set(Object.keys(schema.tables))
  const named = new Set<string>()

  for (const group of Object.values(groupDiff?.changed ?? {})) {
    for (const table of group.tableNames) {
      if (!tables.has(table)) named.add(table)
    }
  }

  const groupIds = new Set(baseGroups.map((group) => group.id))
  const memoIds = new Set(baseMemos.map((memo) => memo.id))

  const emptyTombstones =
    (groupDiff?.removed ?? []).filter((id) => !groupIds.has(id)).length +
    (memoDiff?.removed ?? []).filter((id) => !memoIds.has(id)).length

  return { missingTables: Array.from(named).sort(), emptyTombstones }
}
