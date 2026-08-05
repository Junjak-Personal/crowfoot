// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { beforeEach, describe, expect, it } from 'vitest'
import { readStoredItem, removeStoredItem } from './storage'

const KEY = 'erdkit:thing'
const LEGACY = 'liam:thing'

beforeEach(() => {
  localStorage.clear()
})

describe(readStoredItem, () => {
  it('returns the current value and leaves the old key alone', () => {
    localStorage.setItem(KEY, 'current')
    localStorage.setItem(LEGACY, 'old')

    expect(readStoredItem(KEY, LEGACY)).toBe('current')
    // A browser that already migrated must never be dragged back to the old
    // value, so the new key wins outright rather than being merged.
    expect(localStorage.getItem(LEGACY)).toBe('old')
  })

  it('migrates the old value once, then drops the old key', () => {
    localStorage.setItem(LEGACY, 'old')

    expect(readStoredItem(KEY, LEGACY)).toBe('old')
    expect(localStorage.getItem(KEY)).toBe('old')
    expect(localStorage.getItem(LEGACY)).toBeNull()

    // Second read is served entirely by the new key.
    expect(readStoredItem(KEY, LEGACY)).toBe('old')
  })

  it('returns null when neither key is set', () => {
    expect(readStoredItem(KEY, LEGACY)).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('migrates an empty string rather than treating it as absent', () => {
    localStorage.setItem(LEGACY, '')

    expect(readStoredItem(KEY, LEGACY)).toBe('')
    expect(localStorage.getItem(LEGACY)).toBeNull()
  })
})

describe(removeStoredItem, () => {
  it('clears both names so a reset is not undone by the migration', () => {
    localStorage.setItem(KEY, 'current')
    localStorage.setItem(LEGACY, 'old')

    removeStoredItem(KEY, LEGACY)

    expect(localStorage.getItem(KEY)).toBeNull()
    expect(localStorage.getItem(LEGACY)).toBeNull()
    expect(readStoredItem(KEY, LEGACY)).toBeNull()
  })
})
