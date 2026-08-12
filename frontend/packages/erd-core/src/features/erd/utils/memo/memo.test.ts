// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createMemo,
  DEFAULT_MEMO_FONT_SIZE,
  DEFAULT_MEMO_HEIGHT,
  DEFAULT_MEMO_WIDTH,
  deserializeMemos,
  duplicateMemo,
  getEffectiveMemos,
  MAX_MEMO_FONT_SIZE,
  MEMO_DUPLICATE_OFFSET,
  type Memo,
  MIN_MEMO_FONT_SIZE,
  parseMemos,
  parseMemosFromClipboard,
  placeMemos,
  serializeMemos,
  serializeMemosToClipboard,
  setBaseMemos,
  stepMemoFontSize,
} from './memo'

const memo = (id: string, text = 'note'): Memo => ({
  id,
  text,
  x: 10,
  y: 20,
  width: DEFAULT_MEMO_WIDTH,
  height: DEFAULT_MEMO_HEIGHT,
})

describe(parseMemos, () => {
  it('keeps well-formed memos', () => {
    expect(parseMemos([memo('a')])).toEqual([memo('a')])
  })

  it('fills in a default size', () => {
    expect(parseMemos([{ id: 'a', text: 'x', y: 2, x: 1 }])).toEqual([
      {
        id: 'a',
        text: 'x',
        x: 1,
        y: 2,
        width: DEFAULT_MEMO_WIDTH,
        height: DEFAULT_MEMO_HEIGHT,
      },
    ])
  })

  it('keeps an empty text, which is what a freshly created memo has', () => {
    expect(parseMemos([{ id: 'a', text: '', x: 0, y: 0 }])).toHaveLength(1)
  })

  it('drops malformed entries instead of throwing', () => {
    expect(
      parseMemos([
        null,
        'nope',
        { id: 'a' },
        { id: '', text: 'x', x: 0, y: 0 },
        { id: 'b', text: 'x', x: 'nope', y: 0 },
        { id: 'c', text: 'x', x: Number.NaN, y: 0 },
      ]),
    ).toEqual([])
  })

  it('returns an empty list for non-arrays', () => {
    expect(parseMemos(null)).toEqual([])
    expect(parseMemos({ id: 'a' })).toEqual([])
  })
})

describe('memos on top of memos.json', () => {
  beforeEach(() => {
    setBaseMemos([])
  })

  it('is memos.json when the link carries nothing', () => {
    setBaseMemos([memo('shipped')])

    expect(getEffectiveMemos()).toEqual([memo('shipped')])
  })

  it('carries only the memo that changed', () => {
    const base = [memo('shipped'), memo('other')]
    const next = [memo('shipped', 'edited'), memo('other')]

    expect(JSON.parse(serializeMemos(base, next))).toEqual({
      changed: { shipped: next[0] },
      removed: [],
    })
  })

  it('lets a redeployed memo through for anything the link did not touch', () => {
    const base = [memo('shipped'), memo('other')]
    const link = deserializeMemos(
      serializeMemos(base, [memo('shipped', 'edited'), memo('other')]),
    )

    expect(
      getEffectiveMemos(link, [memo('shipped'), memo('other', 'rewritten')]),
    ).toEqual([memo('shipped', 'edited'), memo('other', 'rewritten')])
  })

  it('expresses a deletion, which a plain merge could not', () => {
    const base = [memo('shipped'), memo('other')]
    const link = deserializeMemos(serializeMemos(base, [memo('other')]))

    expect(getEffectiveMemos(link, base)).toEqual([memo('other')])
  })

  it('says nothing at all once every edit is undone by hand', () => {
    const base = [memo('shipped')]

    expect(serializeMemos(base, [...base])).toBe('')
  })
})

describe(createMemo, () => {
  it('centres a new memo on the clicked point', () => {
    const created = createMemo('id', 500, 300)

    expect(created.x).toBe(500 - DEFAULT_MEMO_WIDTH / 2)
    expect(created.y).toBe(300 - DEFAULT_MEMO_HEIGHT / 2)
    expect(created.text).toBe('')
  })
})

describe(duplicateMemo, () => {
  const original: Memo = { ...memo('a'), color: 'gold', fontSize: 40 }

  it('offsets the copy so it does not hide behind the original', () => {
    const copy = duplicateMemo(original, 'b')

    expect(copy.x).toBe(original.x + MEMO_DUPLICATE_OFFSET)
    expect(copy.y).toBe(original.y + MEMO_DUPLICATE_OFFSET)
  })

  it('carries over everything but the id', () => {
    expect(duplicateMemo(original, 'b')).toEqual({
      ...original,
      id: 'b',
      x: original.x + MEMO_DUPLICATE_OFFSET,
      y: original.y + MEMO_DUPLICATE_OFFSET,
    })
  })
})

describe(placeMemos, () => {
  const ids = () => {
    let n = 0
    return () => `new-${n++}`
  }

  it('centres a lone copy on the paste point, as a new memo is centred', () => {
    const placed = placeMemos([memo('a')], ids(), 500, 300)[0]

    expect(placed?.x).toBe(500 - DEFAULT_MEMO_WIDTH / 2)
    expect(placed?.y).toBe(300 - DEFAULT_MEMO_HEIGHT / 2)
    expect(placed?.id).toBe('new-0')
  })

  it('centres a group on the point without changing its shape', () => {
    const left: Memo = { ...memo('a'), x: 0, y: 0 }
    const right: Memo = { ...memo('b'), x: 400, y: 100 }

    const [first, second] = placeMemos([left, right], ids(), 0, 0)

    // The gap between the two is what has to survive a paste.
    expect((second?.x ?? 0) - (first?.x ?? 0)).toBe(400)
    expect((second?.y ?? 0) - (first?.y ?? 0)).toBe(100)

    // ...centred on the point: the group's bounding box straddles it.
    const width = 400 + DEFAULT_MEMO_WIDTH
    expect(first?.x).toBe(-width / 2)
  })

  it('returns nothing for an empty paste', () => {
    expect(placeMemos([], ids(), 0, 0)).toEqual([])
  })
})

describe('clipboard round trip', () => {
  it('restores memos copied in another tab', () => {
    const originals: Memo[] = [
      { ...memo('a', 'copied'), color: 'teal' },
      memo('b', 'and another'),
    ]

    expect(
      parseMemosFromClipboard(serializeMemosToClipboard(originals)),
    ).toEqual(originals)
  })

  it('refuses text that is not a memo, so an ordinary paste is left alone', () => {
    expect(parseMemosFromClipboard('just some text')).toEqual([])
    expect(parseMemosFromClipboard('{"x":1}')).toEqual([])
    // Well-formed JSON under the wrong key is still not ours.
    expect(
      parseMemosFromClipboard('{"memo":[{"id":"a","text":"","x":0,"y":0}]}'),
    ).toEqual([])
  })

  it('drops malformed entries out of a marked payload', () => {
    expect(parseMemosFromClipboard('{"crowfoot.memo":[{"id":"a"}]}')).toEqual(
      [],
    )
  })
})

describe(stepMemoFontSize, () => {
  const base = memo('a')

  it('starts from the default when no size is set', () => {
    expect(stepMemoFontSize(base, 1)).toBe(DEFAULT_MEMO_FONT_SIZE + 2)
    expect(stepMemoFontSize(base, -1)).toBe(DEFAULT_MEMO_FONT_SIZE - 2)
  })

  it('takes bigger steps as the font grows', () => {
    expect(stepMemoFontSize({ ...base, fontSize: 20 }, 1)).toBe(22)
    expect(stepMemoFontSize({ ...base, fontSize: 30 }, 1)).toBe(34)
    expect(stepMemoFontSize({ ...base, fontSize: 60 }, 1)).toBe(68)
  })

  it('undoes itself across a band boundary', () => {
    for (const size of [24, 48]) {
      const down = stepMemoFontSize({ ...base, fontSize: size }, -1)

      expect(stepMemoFontSize({ ...base, fontSize: down }, 1)).toBe(size)
    }
  })

  it('clamps at both ends', () => {
    expect(stepMemoFontSize({ ...base, fontSize: MAX_MEMO_FONT_SIZE }, 1)).toBe(
      MAX_MEMO_FONT_SIZE,
    )
    expect(
      stepMemoFontSize({ ...base, fontSize: MIN_MEMO_FONT_SIZE }, -1),
    ).toBe(MIN_MEMO_FONT_SIZE)
  })

  it('clamps an out-of-range size coming from memos.json', () => {
    expect(
      parseMemos([{ id: 'a', text: '', x: 0, y: 0, fontSize: 999 }])[0]
        ?.fontSize,
    ).toBe(MAX_MEMO_FONT_SIZE)
    expect(
      parseMemos([{ id: 'a', text: '', x: 0, y: 0, fontSize: 1 }])[0]?.fontSize,
    ).toBe(MIN_MEMO_FONT_SIZE)
  })

  it('ignores a non-numeric size', () => {
    expect(
      parseMemos([{ id: 'a', text: '', x: 0, y: 0, fontSize: 'big' }])[0]
        ?.fontSize,
    ).toBeUndefined()
  })
})
