// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.

/**
 * What a link carries on top of the documents the build shipped.
 *
 * The same bargain `?schemaedits=` makes, for the id-keyed lists — groups and
 * memos. Whole records, not an operation log: an edit is "this id now looks
 * like that", so there is no op ordering to replay, no way for two edits to
 * conflict, and no migration to write when a new field appears on the record.
 *
 * Before this, a link carried the *entire* set and replaced what shipped —
 * which meant redeploying `groups.json` could never reach anyone holding a
 * link. The reason given for that was sound as far as it went: a plain merge
 * cannot express a deletion. A tombstone can, and that is what `removed` is.
 */
export type RecordDiff<T> = {
  /** Records inserted or replaced wholesale, keyed by id. */
  changed: Record<string, T>
  /** Ids dropped from the base. */
  removed: string[]
}

type Identified = { id: string }

const emptyDiff = <T>(): RecordDiff<T> => ({ changed: {}, removed: [] })

export const isEmptyDiff = <T>(diff: RecordDiff<T>): boolean =>
  diff.removed.length === 0 && Object.keys(diff.changed).length === 0

/**
 * A record parsed straight out of JSON can own a `__proto__` key, and reading
 * `changed[id]` for an id that is *absent* hands back `Object.prototype`
 * instead of undefined. Everything below looks records up through a `Map`,
 * which has no such hole.
 */
const mapOf = <T extends Identified>(records: readonly T[]): Map<string, T> =>
  new Map(records.map((record) => [record.id, record]))

/**
 * Base + diff. Base order is preserved so an edited record keeps its place in
 * every list; records the viewer added are appended.
 */
export const applyDiff = <T extends Identified>(
  base: readonly T[],
  diff: RecordDiff<T> | null,
): T[] => {
  if (!diff || isEmptyDiff(diff)) return [...base]

  const removed = new Set(diff.removed)
  const changed = mapOf(Object.values(diff.changed))
  const inBase = new Set(base.map((record) => record.id))

  const existing = base
    .filter((record) => !removed.has(record.id))
    .map((record) => changed.get(record.id) ?? record)

  const added = Object.values(diff.changed).filter(
    (record) => !inBase.has(record.id) && !removed.has(record.id),
  )

  return [...existing, ...added]
}

/**
 * The inverse: what has to be stored so `applyDiff(base, …)` reproduces
 * `next`. Called on every commit, so a link never accumulates entries for
 * records that were edited back to the shape they shipped with.
 *
 * ponytail: structural comparison is `JSON.stringify`, which is order
 * sensitive. Both sides are built by spreading the original, so key order
 * holds; the worst a false "changed" can do is put one redundant record in the
 * URL, never lose or corrupt an edit.
 */
export const diffRecords = <T extends Identified>(
  base: readonly T[],
  next: readonly T[],
): RecordDiff<T> => {
  const original = mapOf(base)
  const kept = new Set(next.map((record) => record.id))

  const changed = next.filter((record) => {
    const before = original.get(record.id)
    return !before || JSON.stringify(before) !== JSON.stringify(record)
  })

  return {
    changed: Object.fromEntries(changed.map((record) => [record.id, record])),
    removed: base.map((record) => record.id).filter((id) => !kept.has(id)),
  }
}

/**
 * Total — never throws, mirroring `parseGroups` and `parseSchemaEdits`. A
 * malformed parameter must degrade to "no edits", never take the whole ERD
 * down with it.
 *
 * The key a record is filed under is authoritative: a payload whose `id`
 * disagrees with its key would apply to one record and render as another.
 */
export const parseDiff = <T extends Identified>(
  value: unknown,
  parseRecord: (entry: unknown) => T | null,
): RecordDiff<T> => {
  if (typeof value !== 'object' || value === null) return emptyDiff<T>()

  const rawChanged =
    'changed' in value && typeof value.changed === 'object' && value.changed
      ? value.changed
      : {}

  const changed = Object.entries(rawChanged).flatMap(([id, entry]) => {
    const record = parseRecord(entry)
    if (!record || record.id !== id) return []
    return [[id, record] as const]
  })

  const removed =
    'removed' in value && Array.isArray(value.removed)
      ? value.removed.filter((id): id is string => typeof id === 'string')
      : []

  return { changed: Object.fromEntries(changed), removed }
}

export const serializeDiff = <T>(diff: RecordDiff<T>): string =>
  isEmptyDiff(diff) ? '' : JSON.stringify(diff)

export const deserializeDiff = <T extends Identified>(
  raw: string,
  parseRecord: (entry: unknown) => T | null,
): RecordDiff<T> | null => {
  if (raw === '') return null

  try {
    return parseDiff(JSON.parse(raw), parseRecord)
  } catch {
    return null
  }
}
