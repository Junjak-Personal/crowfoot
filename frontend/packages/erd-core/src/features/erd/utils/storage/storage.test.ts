// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { beforeEach, describe, expect, it } from 'vitest'
import { readStoredItem, removeStoredItem } from './storage'

const KEY = 'crowfoot:thing'
const RECENT = 'erdkit:thing'
const OLDEST = 'liam:thing'
// Newest first, mirroring the real call sites.
const LEGACY = [RECENT, OLDEST]

beforeEach(() => {
  localStorage.clear()
})

describe(readStoredItem, () => {
  it('returns the current value and leaves the old keys alone', () => {
    localStorage.setItem(KEY, 'current')
    localStorage.setItem(RECENT, 'recent')

    expect(readStoredItem(KEY, LEGACY)).toBe('current')
    // A browser that already migrated must never be dragged back to an old
    // value, so the current key wins outright rather than being merged.
    expect(localStorage.getItem(RECENT)).toBe('recent')
  })

  it('migrates the old value once, then drops the old key', () => {
    localStorage.setItem(OLDEST, 'old')

    expect(readStoredItem(KEY, LEGACY)).toBe('old')
    expect(localStorage.getItem(KEY)).toBe('old')
    expect(localStorage.getItem(OLDEST)).toBeNull()

    // Second read is served entirely by the current key.
    expect(readStoredItem(KEY, LEGACY)).toBe('old')
  })

  it('prefers the most recent old name when several are present', () => {
    localStorage.setItem(RECENT, 'recent')
    localStorage.setItem(OLDEST, 'old')

    expect(readStoredItem(KEY, LEGACY)).toBe('recent')
  })

  it('clears every old name it migrated past, not just the one it read', () => {
    localStorage.setItem(RECENT, 'recent')
    localStorage.setItem(OLDEST, 'old')

    readStoredItem(KEY, LEGACY)

    // Leaving the older name behind would let it resurface if the newer one
    // were ever cleared on its own.
    expect(localStorage.getItem(RECENT)).toBeNull()
    expect(localStorage.getItem(OLDEST)).toBeNull()
  })

  it('returns null when no key is set', () => {
    expect(readStoredItem(KEY, LEGACY)).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('migrates an empty string rather than treating it as absent', () => {
    localStorage.setItem(OLDEST, '')

    expect(readStoredItem(KEY, LEGACY)).toBe('')
    expect(localStorage.getItem(OLDEST)).toBeNull()
  })
})

describe(removeStoredItem, () => {
  it('clears every name so a reset is not undone by the migration', () => {
    localStorage.setItem(KEY, 'current')
    localStorage.setItem(RECENT, 'recent')
    localStorage.setItem(OLDEST, 'old')

    removeStoredItem(KEY, LEGACY)

    expect(localStorage.getItem(KEY)).toBeNull()
    expect(localStorage.getItem(RECENT)).toBeNull()
    expect(localStorage.getItem(OLDEST)).toBeNull()
    expect(readStoredItem(KEY, LEGACY)).toBeNull()
  })
})
