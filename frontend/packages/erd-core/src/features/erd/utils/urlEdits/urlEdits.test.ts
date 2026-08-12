// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { beforeEach, describe, expect, it } from 'vitest'
import { compressToEncodedUriComponent } from '../../../../utils/compressToEncodedUriComponent'
import { readEditParam, readEditParamList, readPlainParam } from './urlEdits'

const at = (search: string) => {
  history.replaceState(null, '', `/${search}`)
}

beforeEach(() => {
  at('')
})

/**
 * These read `location.search` rather than the store because the address bar
 * is already correct inside a `popstate` handler while the store's copy is a
 * render behind — rebuilding the canvas from the store there restored the
 * state being navigated away from.
 */
describe('reading the edit parameters straight from the address bar', () => {
  it('decompresses a parameter', () => {
    at(`?groups=${compressToEncodedUriComponent('{"changed":{}}')}`)

    expect(readEditParam('groups')).toBe('{"changed":{}}')
  })

  it('reads an absent parameter as empty', () => {
    expect(readEditParam('groups')).toBe('')
    expect(readEditParamList('positions')).toEqual([])
    expect(readPlainParam('active')).toBe('')
  })

  it('splits the comma-joined lists', () => {
    at(`?positions=${compressToEncodedUriComponent('users:1:2,posts:3:4')}`)

    expect(readEditParamList('positions')).toEqual(['users:1:2', 'posts:3:4'])
  })

  it('reads a plain parameter without decompressing it', () => {
    at('?active=users')

    expect(readPlainParam('active')).toBe('users')
  })

  it('reads a corrupt parameter as empty rather than throwing', () => {
    at('?groups=not-compressed')

    expect(readEditParam('groups')).toBe('')
  })
})
