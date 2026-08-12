// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { aSchema, aTable } from '@crowfoot/schema'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Group } from '../group'
import type { Memo } from '../memo'
import { cacheBaseDocuments, readCachedBase } from './baseCache'
import {
  baseVersionOf,
  getBaseDocuments,
  getBaseVersion,
  isStale,
  registerBaseDocuments,
  staleReferences,
} from './baseVersion'

const documents = {
  schema: { tables: {} },
  layout: {},
  memos: [],
  groups: [],
}

describe('baseVersionOf', () => {
  it('is the same for the same documents', () => {
    expect(baseVersionOf([{ a: 1 }])).toBe(baseVersionOf([{ a: 1 }]))
  })

  it('changes when any one of them changes', () => {
    expect(baseVersionOf([{ a: 1 }, []])).not.toBe(
      baseVersionOf([{ a: 2 }, []]),
    )
    expect(baseVersionOf([{ a: 1 }, []])).not.toBe(
      baseVersionOf([{ a: 1 }, [1]]),
    )
  })

  /** It rides in every history entry, so it has to stay short. */
  it('is eight characters', () => {
    expect(baseVersionOf([{ tables: { users: {} } }])).toHaveLength(8)
  })
})

describe('registerBaseDocuments', () => {
  it('hashes what it was handed and keeps it for the cache', () => {
    registerBaseDocuments(documents)

    expect(getBaseVersion()).toHaveLength(8)
    expect(getBaseDocuments()).toEqual(documents)
  })

  it('reports a different version once a sidecar changes', () => {
    registerBaseDocuments(documents)
    const before = getBaseVersion()

    registerBaseDocuments({ ...documents, groups: [{ id: 'a' }] })

    expect(getBaseVersion()).not.toBe(before)
  })
})

const group = (id: string, tableNames: string[]): Group => ({
  id,
  name: id,
  tableNames,
})

const memo = (id: string): Memo => ({
  id,
  text: '',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
})

describe('staleReferences', () => {
  const schema = aSchema({ tables: { users: aTable({ name: 'users' }) } })

  const check = (
    groupDiff: Parameters<typeof staleReferences>[0]['groupDiff'],
    memoDiff: Parameters<typeof staleReferences>[0]['memoDiff'] = null,
    base: { groups?: Group[]; memos?: Memo[] } = {},
  ) =>
    staleReferences({
      schema,
      baseGroups: base.groups ?? [],
      baseMemos: base.memos ?? [],
      groupDiff,
      memoDiff,
    })

  it('finds nothing to report when the link still fits', () => {
    const stale = check({
      changed: { a: group('a', ['users']) },
      removed: [],
    })

    expect(isStale(stale)).toBe(false)
  })

  it('names the tables a group refers to that the schema has lost', () => {
    const stale = check({
      changed: { a: group('a', ['users', 'orders', 'payments']) },
      removed: [],
    })

    expect(stale.missingTables).toEqual(['orders', 'payments'])
    expect(isStale(stale)).toBe(true)
  })

  it('does not report the same missing table twice', () => {
    const stale = check({
      changed: {
        a: group('a', ['orders']),
        b: group('b', ['orders']),
      },
      removed: [],
    })

    expect(stale.missingTables).toEqual(['orders'])
  })

  /** A deletion that no longer deletes anything is an edit that did nothing. */
  it('counts a tombstone for something already gone', () => {
    const stale = check(
      { changed: {}, removed: ['vanished'] },
      { changed: {}, removed: ['also-vanished'] },
    )

    expect(stale.emptyTombstones).toBe(2)
  })

  it('does not count a tombstone that still has something to delete', () => {
    const stale = check(
      { changed: {}, removed: ['a'] },
      { changed: {}, removed: ['note'] },
      { groups: [group('a', ['users'])], memos: [memo('note')] },
    )

    expect(stale.emptyTombstones).toBe(0)
  })

  it('reports nothing when the link carries no edits at all', () => {
    expect(isStale(check(null))).toBe(false)
  })
})

describe('the cold base cache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps the documents a version was edited against', () => {
    cacheBaseDocuments('abc12345', documents)

    expect(readCachedBase('abc12345')).toEqual(documents)
  })

  it('answers nothing for a version it did not store', () => {
    cacheBaseDocuments('abc12345', documents)

    expect(readCachedBase('99999999')).toBeNull()
  })

  it('answers nothing when nothing was ever stored', () => {
    expect(readCachedBase('abc12345')).toBeNull()
  })

  /** The skip check is what keeps every edit after the first off the disk. */
  it('writes once for a version and skips after that', () => {
    cacheBaseDocuments('abc12345', documents)
    const first = localStorage.getItem('crowfoot:base:/')

    cacheBaseDocuments('abc12345', { ...documents, groups: ['changed'] })

    expect(localStorage.getItem('crowfoot:base:/')).toBe(first)
  })

  it('replaces the copy once the deploy moves on', () => {
    cacheBaseDocuments('abc12345', documents)
    cacheBaseDocuments('def67890', { ...documents, groups: ['new'] })

    expect(readCachedBase('abc12345')).toBeNull()
    expect(readCachedBase('def67890')?.groups).toEqual(['new'])
  })

  /**
   * Releases up to 0.3.0 kept a working copy of the diagram here. Nothing
   * reads those keys now, and the first write is the one moment this code runs
   * at all, so it is where they get cleared.
   *
   * ponytail: the quota retry below this is not covered — happy-dom's storage
   * cannot be made to refuse a write. It is a catch-and-continue whose failure
   * mode is the cache simply not existing, which every caller already handles.
   */
  it('clears the edit copies releases up to 0.3.0 left behind', () => {
    localStorage.setItem('crowfoot:groups', '[{"id":"old"}]')
    localStorage.setItem('liam:tableLayout', '{}')

    cacheBaseDocuments('abc12345', documents)

    expect(localStorage.getItem('crowfoot:groups')).toBeNull()
    expect(localStorage.getItem('liam:tableLayout')).toBeNull()
    expect(readCachedBase('abc12345')).toEqual(documents)
  })
})
