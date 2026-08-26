// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { aColumn, aSchema, aTable } from '@crowfoot/schema/schema'
import { describe, expect, it } from 'vitest'
import { checkArrangement } from './check.js'
import { TABLE_WIDTH, tableHeight } from './geometry.js'

/**
 * A group's box is derived on every render and never stored, so its size is
 * only knowable in a browser — which is what made "the diagram is not broken"
 * a claim nobody could check without opening one.
 */
describe('checkArrangement', () => {
  /** One column, so every table is the same known height. */
  const schema = aSchema({
    tables: Object.fromEntries(
      ['a', 'b', 'c'].map((name) => [
        name,
        aTable({ name, columns: { id: aColumn({ name: 'id' }) } }),
      ]),
    ),
  })

  const HEIGHT = tableHeight(1)
  const PADDING = 24

  const group = (id: string, tableNames: string[]) => ({
    id,
    name: id,
    tableNames,
  })

  it('draws the box its members bound, padded on every side', () => {
    const { groups } = checkArrangement({
      schema,
      layout: { a: { x: 100, y: 100 }, b: { x: 100, y: 500 } },
      groups: [group('left', ['a', 'b'])],
    })

    expect(groups).toEqual([
      {
        id: 'left',
        name: 'left',
        placed: 2,
        x: 100 - PADDING,
        y: 100 - PADDING,
        width: TABLE_WIDTH + PADDING * 2,
        height: 500 + HEIGHT - 100 + PADDING * 2,
      },
    ])
  })

  it('says nothing about boxes that clear each other', () => {
    const { overlaps } = checkArrangement({
      schema,
      layout: { a: { x: 0, y: 0 }, b: { x: 1000, y: 0 } },
      groups: [group('left', ['a']), group('right', ['b'])],
    })

    expect(overlaps).toEqual([])
  })

  /** The failure that reads as a broken diagram, and the reason this exists. */
  it('names the pair that crosses, and by how much', () => {
    const { overlaps } = checkArrangement({
      schema,
      layout: { a: { x: 0, y: 0 }, b: { x: 300, y: 0 } },
      groups: [group('left', ['a']), group('right', ['b'])],
    })

    expect(overlaps).toEqual([
      {
        left: 'left',
        right: 'right',
        // Boxes run 0..388 and 276..664, so they share 112.
        byX: TABLE_WIDTH + PADDING * 2 - 300,
        byY: HEIGHT + PADDING * 2,
      },
    ])
  })

  /**
   * Touching is not crossing: two boxes exactly `MIN_GROUP_GAP` apart share an
   * edge and nothing else, which is the floor the layout is built to.
   */
  it('does not call a shared edge an overlap', () => {
    const { overlaps } = checkArrangement({
      schema,
      layout: { a: { x: 0, y: 0 }, b: { x: TABLE_WIDTH + PADDING * 2, y: 0 } },
      groups: [group('left', ['a']), group('right', ['b'])],
    })

    expect(overlaps).toEqual([])
  })

  it('names members the layout never positioned', () => {
    const { groups, unplaced } = checkArrangement({
      schema,
      layout: { a: { x: 0, y: 0 } },
      groups: [group('left', ['a', 'c'])],
    })

    expect(unplaced).toEqual(['c'])
    expect(groups[0]?.placed).toBe(1)
  })

  it('leaves out a group with nothing placed at all', () => {
    const { groups } = checkArrangement({
      schema,
      layout: { a: { x: 0, y: 0 } },
      groups: [group('left', ['a']), group('ghost', ['c'])],
    })

    expect(groups.map((box) => box.id)).toEqual(['left'])
  })
})
