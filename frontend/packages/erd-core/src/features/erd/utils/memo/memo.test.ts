// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearStoredMemos,
  createMemo,
  DEFAULT_MEMO_FONT_SIZE,
  DEFAULT_MEMO_HEIGHT,
  DEFAULT_MEMO_WIDTH,
  dumpMemos,
  getEffectiveMemos,
  loadStoredMemos,
  MAX_MEMO_FONT_SIZE,
  type Memo,
  MIN_MEMO_FONT_SIZE,
  parseMemos,
  saveStoredMemos,
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

describe('memo persistence', () => {
  beforeEach(() => {
    clearStoredMemos()
    setBaseMemos([])
  })

  it('falls back to memos.json when nothing is stored', () => {
    setBaseMemos([memo('shipped')])

    expect(getEffectiveMemos()).toEqual([memo('shipped')])
  })

  it('lets local edits replace memos.json entirely', () => {
    setBaseMemos([memo('shipped'), memo('other')])
    // A wholesale replace is what makes deletion expressible.
    saveStoredMemos([memo('shipped', 'edited')])

    expect(getEffectiveMemos()).toEqual([memo('shipped', 'edited')])
  })

  it('treats an empty local list as a real edit, not as absent', () => {
    setBaseMemos([memo('shipped')])
    saveStoredMemos([])

    expect(getEffectiveMemos()).toEqual([])
  })

  it('restores memos.json once local edits are cleared', () => {
    setBaseMemos([memo('shipped')])
    saveStoredMemos([memo('local')])
    clearStoredMemos()

    expect(loadStoredMemos()).toBeNull()
    expect(getEffectiveMemos()).toEqual([memo('shipped')])
  })

  it('dumps what is on screen so memos.json can be regenerated', () => {
    setBaseMemos([memo('shipped')])
    saveStoredMemos([memo('shipped', 'edited'), memo('added')])

    expect(dumpMemos()).toEqual([memo('shipped', 'edited'), memo('added')])
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

describe(stepMemoFontSize, () => {
  const base = memo('a')

  it('starts from the default when no size is set', () => {
    expect(stepMemoFontSize(base, 1)).toBe(DEFAULT_MEMO_FONT_SIZE + 2)
    expect(stepMemoFontSize(base, -1)).toBe(DEFAULT_MEMO_FONT_SIZE - 2)
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
