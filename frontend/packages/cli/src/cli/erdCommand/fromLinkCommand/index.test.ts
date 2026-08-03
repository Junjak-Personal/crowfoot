// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { describe, expect, it } from 'vitest'
import { parseLink } from './index.js'

// Produced by the same deflate → base64 → URL-safe pipeline the browser uses.
const POSITIONS = 'eJxLtEqyMrTSNdIpyEnMzLMyNLAyMgAAO0gFeQ' // a:b:1:-2,plain:10:20
const COLORS = 'eJwryEnMzLMqSU3M0cnPy6lMzs_JL7LKL0rMS08FAJUjCrg' // plain:teal,onlycolor:orange
const MEMOS =
  'eJwFwbENgDAQBMFeNr7EQHStIDJb_AdkL2GE6J2Z_SU75mqIGrMwkYiJm3jwIu7sFXgVMfKMwtt3_NZhEF4' // [{id:m1,…}]

const link = (query: string) => `https://erd.example/?edit=1&${query}`

describe('parseLink', () => {
  it('splits a position entry from the right so a table name may contain ":"', () => {
    const { layout } = parseLink(link(`positions=${POSITIONS}`))

    expect(layout).toEqual({
      'a:b': { x: 1, y: -2 },
      plain: { x: 10, y: 20 },
    })
  })

  it('keeps the position of a table that was also recoloured', () => {
    const { layout } = parseLink(
      link(`positions=${POSITIONS}&colors=${COLORS}`),
    )

    expect(layout?.plain).toEqual({ x: 10, y: 20, color: 'teal' })
  })

  it('places a colour-only table at the origin rather than dropping it', () => {
    const { layout } = parseLink(link(`colors=${COLORS}`))

    expect(layout?.onlycolor).toEqual({ x: 0, y: 0, color: 'orange' })
  })

  it('decodes memos as the list memos.json expects', () => {
    const { memos } = parseLink(link(`memos=${MEMOS}`))

    expect(memos).toEqual([
      { id: 'm1', text: 'hi', x: 1, y: 2, width: 3, height: 4 },
    ])
  })

  // An absent param must stay null: the caller writes only the files the link
  // carries, so `{}` never overwrites a good layout.json.
  it('reports an absent param as null rather than empty', () => {
    expect(parseLink(link(`positions=${POSITIONS}`))).toEqual({
      layout: { 'a:b': { x: 1, y: -2 }, plain: { x: 10, y: 20 } },
      memos: null,
    })
    expect(parseLink(link('show=all'))).toEqual({ layout: null, memos: null })
  })

  it('rejects a value that is not a URL', () => {
    expect(() => parseLink('not a url')).toThrowError(/Not a URL/)
  })
})
