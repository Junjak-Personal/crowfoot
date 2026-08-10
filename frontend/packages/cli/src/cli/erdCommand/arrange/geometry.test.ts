import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  arrangeTables,
  GROUP_BOX_PADDING,
  MIN_GROUP_GAP,
  memoHeight,
  memoLineCapacity,
  TABLE_WIDTH,
  tableHeight,
} from './geometry.js'

/**
 * The geometry here is a copy of the viewer's. It has to be: the CLI is a node
 * binary and importing erd-core would pull React and a pile of CSS modules into
 * it. A copy drifts, so this is the thing that notices.
 *
 * The source is read as text rather than imported, for the same reason. If the
 * file moves this fails, which is the correct outcome — the constant it guards
 * would have moved with it.
 */
describe('constants shared with the viewer', () => {
  it('uses the group box padding erd-core actually applies', () => {
    const groupNode = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../../erd-core/src/features/erd/utils/group/groupNode.ts',
    )
    const declared = readFileSync(groupNode, 'utf8').match(
      /GROUP_BOX_PADDING = (\d+)/,
    )

    expect(declared?.[1]).toBeDefined()
    expect(Number(declared?.[1])).toBe(GROUP_BOX_PADDING)
  })
})

describe('tableHeight', () => {
  it('is a header plus one row per column', () => {
    expect(tableHeight(0)).toBe(52)
    expect(tableHeight(1)).toBe(86)
    expect(tableHeight(10)).toBe(392)
  })
})

const heightOf = () => 100

const boxesOf = (layout: Record<string, { x: number; y: number }>) =>
  Object.entries(layout).map(([table, point]) => ({
    table,
    left: point.x,
    right: point.x + TABLE_WIDTH,
    top: point.y,
    bottom: point.y + heightOf(),
  }))

const overlaps = (layout: Record<string, { x: number; y: number }>) => {
  const boxes = boxesOf(layout)
  const hits: string[] = []

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      if (!a || !b) continue
      if (
        a.left < b.right &&
        b.left < a.right &&
        a.top < b.bottom &&
        b.top < a.bottom
      ) {
        hits.push(`${a.table}/${b.table}`)
      }
    }
  }

  return hits
}

describe('arrangeTables', () => {
  it('stacks a small group into one column', () => {
    const { layout } = arrangeTables({
      groups: [{ tables: ['a', 'b', 'c'] }],
      ungrouped: [],
      heightOf,
      originX: 0,
    })

    expect(layout).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 0, y: 140 },
      c: { x: 0, y: 280 },
    })
  })

  it('splits a larger group across two columns', () => {
    const { layout } = arrangeTables({
      groups: [{ tables: ['a', 'b', 'c', 'd'] }],
      ungrouped: [],
      heightOf,
      originX: 0,
    })

    expect(layout['b']?.x).toBe(TABLE_WIDTH + 40)
    expect(layout['c']?.y).toBe(140)
    expect(layout['d']).toEqual({ x: TABLE_WIDTH + 40, y: 140 })
  })

  it('widens a big block instead of stacking it into a ribbon', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => `t${i}`)
    const { layout } = arrangeTables({
      groups: [{ tables: twenty }],
      ungrouped: [],
      heightOf,
      originX: 0,
    })

    const columns = new Set(twenty.map((t) => layout[t]?.x))
    const depth = Math.max(...twenty.map((t) => layout[t]?.y ?? 0))

    expect(columns.size).toBe(4)
    // Four columns of five, not two of ten.
    expect(depth).toBe(4 * 140)
  })

  it('keeps small blocks narrow', () => {
    const { layout } = arrangeTables({
      groups: [{ tables: ['a', 'b', 'c'] }],
      ungrouped: [],
      heightOf,
      originX: 0,
    })

    expect(new Set(['a', 'b', 'c'].map((t) => layout[t]?.x)).size).toBe(1)
  })

  it('fills the shortest column, so a block of uneven tables comes out level', () => {
    const tall = (table: string) => (table === 'big' ? 1000 : 100)
    const { layout } = arrangeTables({
      groups: [{ tables: ['big', 'a', 'b', 'c'] }],
      ungrouped: [],
      heightOf: tall,
      originX: 0,
    })

    // `big` takes one column; the three short ones stack in the other.
    expect(layout['a']?.x).not.toBe(layout['big']?.x)
    expect(layout['c']?.x).toBe(layout['a']?.x)
  })

  it('leaves neighbouring groups far enough apart that their boxes clear', () => {
    const { layout } = arrangeTables({
      groups: [{ tables: ['a'] }, { tables: ['b'] }],
      ungrouped: [],
      heightOf,
      originX: 0,
    })

    const gap = (layout['b']?.x ?? 0) - ((layout['a']?.x ?? 0) + TABLE_WIDTH)
    expect(gap).toBeGreaterThanOrEqual(MIN_GROUP_GAP)
  })

  it('places tables the plan left out as a block of their own', () => {
    const { layout } = arrangeTables({
      groups: [{ tables: ['a'] }],
      ungrouped: ['loose'],
      heightOf,
      originX: 0,
    })

    expect(layout['loose']).toBeDefined()
    expect(layout['loose']?.x).toBeGreaterThan(layout['a']?.x ?? 0)
  })

  it('never overlaps two tables, whatever the shape of the plan', () => {
    const { layout } = arrangeTables({
      groups: [
        { tables: ['a'] },
        { tables: ['b', 'c'] },
        { tables: ['d', 'e', 'f', 'g', 'h'] },
        { tables: [] },
      ],
      ungrouped: ['i', 'j'],
      heightOf,
      originX: 1000,
    })

    expect(overlaps(layout)).toEqual([])
    expect(Object.keys(layout)).toHaveLength(10)
  })

  it('reports the span of what it placed', () => {
    const { span } = arrangeTables({
      groups: [{ tables: ['a'] }],
      ungrouped: [],
      heightOf,
      originX: 500,
    })

    expect(span).toEqual({ left: 500, right: 500 + TABLE_WIDTH })
  })

  it('has an empty span when there is nothing to place', () => {
    const { layout, span } = arrangeTables({
      groups: [],
      ungrouped: [],
      heightOf,
      originX: 0,
    })

    expect(layout).toEqual({})
    expect(span).toEqual({ left: 0, right: 0 })
  })
})

describe('memoHeight', () => {
  it('counts the lines the text was written with', () => {
    // 3 lines at font size 32: 3 * 32 * 1.55 = 148.8 -> 149, plus breathing.
    expect(memoHeight('one\ntwo\nthree', 1560, 32)).toBe(149 + 64)
  })

  it('counts the lines a long one will wrap onto, not the one it was written as', () => {
    const capacity = memoLineCapacity(1560, 32)

    expect(memoHeight('x'.repeat(capacity * 3), 1560, 32)).toBe(
      memoHeight('a\nb\nc', 1560, 32),
    )
  })

  it('gives an empty memo a line rather than no height', () => {
    expect(memoHeight('', 1560, 32)).toBeGreaterThan(64)
  })

  it('needs more room as the font grows', () => {
    expect(memoHeight('a\nb', 1560, 40)).toBeGreaterThan(
      memoHeight('a\nb', 1560, 32),
    )
  })
})
