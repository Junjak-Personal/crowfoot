// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { describe, expect, it } from 'vitest'
import {
  applyDiff,
  deserializeDiff,
  diffRecords,
  isEmptyDiff,
  parseDiff,
  serializeDiff,
} from './recordDiff'

type Note = { id: string; text: string }

const note = (id: string, text = id): Note => ({ id, text })

const parseNote = (entry: unknown): Note | null => {
  if (typeof entry !== 'object' || entry === null) return null
  if (!('id' in entry) || typeof entry.id !== 'string') return null
  if (!('text' in entry) || typeof entry.text !== 'string') return null
  return { id: entry.id, text: entry.text }
}

const base = [note('a'), note('b'), note('c')]

describe('diffRecords', () => {
  it('is empty when nothing changed', () => {
    expect(isEmptyDiff(diffRecords(base, [...base]))).toBe(true)
  })

  it('carries only the record that changed', () => {
    const diff = diffRecords(base, [note('a'), note('b', 'edited'), note('c')])

    expect(Object.keys(diff.changed)).toEqual(['b'])
    expect(diff.removed).toEqual([])
  })

  it('carries a record the base never had', () => {
    const diff = diffRecords(base, [...base, note('d')])

    expect(Object.keys(diff.changed)).toEqual(['d'])
  })

  /** The thing a plain merge cannot express, and the reason for `removed`. */
  it('records a deletion as a tombstone', () => {
    const diff = diffRecords(base, [note('a'), note('c')])

    expect(diff.removed).toEqual(['b'])
    expect(diff.changed).toEqual({})
  })

  it('drops an entry that was edited back to what it shipped as', () => {
    const edited = diffRecords(base, [note('a'), note('b', 'edited')])
    const restored = diffRecords(base, [...base])

    expect(Object.keys(edited.changed)).toEqual(['b'])
    expect(isEmptyDiff(restored)).toBe(true)
  })
})

describe('applyDiff', () => {
  it('returns the base when there is no diff', () => {
    expect(applyDiff(base, null)).toEqual(base)
  })

  it('round-trips whatever diffRecords produced', () => {
    const next = [note('a', 'edited'), note('c'), note('d')]

    expect(applyDiff(base, diffRecords(base, next))).toEqual(next)
  })

  it('keeps an edited record in the place the base gave it', () => {
    const diff = diffRecords(base, [note('a'), note('b', 'edited'), note('c')])

    expect(applyDiff(base, diff).map((n) => n.id)).toEqual(['a', 'b', 'c'])
  })

  it('appends the ones the base never had', () => {
    const diff = diffRecords(base, [...base, note('z')])

    expect(applyDiff(base, diff).map((n) => n.id)).toEqual(['a', 'b', 'c', 'z'])
  })

  /**
   * A redeploy can drop a record the link still names. Applying has to survive
   * it — the count of what got skipped is what the version notice reports.
   */
  it('ignores a tombstone for something the base no longer has', () => {
    expect(applyDiff([note('a')], { changed: {}, removed: ['gone'] })).toEqual([
      note('a'),
    ])
  })

  it('never returns the array it was given', () => {
    const result = applyDiff(base, null)
    result.push(note('z'))

    expect(base).toHaveLength(3)
  })
})

describe('parseDiff', () => {
  it('degrades to no edits rather than throwing', () => {
    expect(isEmptyDiff(parseDiff(null, parseNote))).toBe(true)
    expect(isEmptyDiff(parseDiff('nonsense', parseNote))).toBe(true)
    expect(isEmptyDiff(parseDiff({ changed: 7 }, parseNote))).toBe(true)
  })

  it('drops a record whose id disagrees with the key it is filed under', () => {
    const diff = parseDiff(
      { changed: { a: note('b') }, removed: [] },
      parseNote,
    )

    expect(diff.changed).toEqual({})
  })

  it('drops a malformed record without losing the rest', () => {
    const diff = parseDiff(
      { changed: { a: note('a'), b: { id: 'b' } }, removed: [] },
      parseNote,
    )

    expect(Object.keys(diff.changed)).toEqual(['a'])
  })

  /**
   * `JSON.parse` makes `__proto__` a real own property, so a lookup for an id
   * that is absent must not hand back `Object.prototype`.
   */
  it('survives a payload keyed on __proto__', () => {
    const diff = deserializeDiff(
      '{"changed":{"__proto__":{"id":"__proto__","text":"x"}},"removed":[]}',
      parseNote,
    )

    expect(applyDiff(base, diff).map((n) => n.id)).toEqual([
      'a',
      'b',
      'c',
      '__proto__',
    ])
  })
})

describe('serializeDiff', () => {
  it('writes nothing at all when there is nothing to say', () => {
    expect(serializeDiff(diffRecords(base, [...base]))).toBe('')
  })

  it('round-trips through the query string', () => {
    const diff = diffRecords(base, [note('a', 'edited'), note('c')])

    expect(deserializeDiff(serializeDiff(diff), parseNote)).toEqual(diff)
  })

  it('reads an absent parameter as "the link said nothing"', () => {
    expect(deserializeDiff('', parseNote)).toBeNull()
  })

  it('reads a malformed parameter as no edits rather than failing', () => {
    expect(
      isEmptyDiff(
        deserializeDiff('not json', parseNote) ?? { changed: {}, removed: [] },
      ),
    ).toBe(true)
  })
})
