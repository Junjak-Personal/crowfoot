// Added in liam-custom; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { isViewColorKey, type ViewColorKey } from '../viewColor'

export type Memo = {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  color?: ViewColorKey | undefined
  fontSize?: number | undefined
}

const STORAGE_KEY = 'liam:memos'

export const DEFAULT_MEMO_WIDTH = 220
export const DEFAULT_MEMO_HEIGHT = 120
export const MIN_MEMO_WIDTH = 100
export const MIN_MEMO_HEIGHT = 60

export const DEFAULT_MEMO_FONT_SIZE = 13
export const MIN_MEMO_FONT_SIZE = 10
export const MAX_MEMO_FONT_SIZE = 28
const FONT_SIZE_STEP = 2

/** Keeps a typed-in size inside the supported range. */
export const clampMemoFontSize = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_MEMO_FONT_SIZE

  return Math.min(
    MAX_MEMO_FONT_SIZE,
    Math.max(MIN_MEMO_FONT_SIZE, Math.round(value)),
  )
}

/** Bumps a memo's font size, clamped to the supported range. */
export const stepMemoFontSize = (memo: Memo, direction: 1 | -1): number =>
  clampMemoFontSize(
    (memo.fontSize ?? DEFAULT_MEMO_FONT_SIZE) + direction * FONT_SIZE_STEP,
  )

/** Memos shipped with the build (memos.json), set by the host app. */
let baseMemos: Memo[] = []

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** Size is optional in memos.json; a missing or bad value falls back. */
const readSize = (entry: object): { width: number; height: number } => ({
  width:
    'width' in entry && isNumber(entry.width)
      ? entry.width
      : DEFAULT_MEMO_WIDTH,
  height:
    'height' in entry && isNumber(entry.height)
      ? entry.height
      : DEFAULT_MEMO_HEIGHT,
})

const readColor = (entry: object): ViewColorKey | undefined =>
  'color' in entry && isViewColorKey(entry.color) ? entry.color : undefined

const readFontSize = (entry: object): number | undefined => {
  if (!('fontSize' in entry) || !isNumber(entry.fontSize)) return undefined

  return Math.min(
    MAX_MEMO_FONT_SIZE,
    Math.max(MIN_MEMO_FONT_SIZE, entry.fontSize),
  )
}

const parseMemo = (entry: unknown): Memo | null => {
  if (typeof entry !== 'object' || entry === null) return null
  if (!('id' in entry) || !('text' in entry)) return null
  if (!('x' in entry) || !('y' in entry)) return null
  if (typeof entry.id !== 'string' || entry.id === '') return null
  if (typeof entry.text !== 'string') return null
  if (!isNumber(entry.x) || !isNumber(entry.y)) return null

  return {
    id: entry.id,
    text: entry.text,
    x: entry.x,
    y: entry.y,
    ...readSize(entry),
    color: readColor(entry),
    fontSize: readFontSize(entry),
  }
}

export const parseMemos = (value: unknown): Memo[] => {
  if (!Array.isArray(value)) return []
  const entries: unknown[] = value

  return entries.map(parseMemo).filter((memo): memo is Memo => memo !== null)
}

export const setBaseMemos = (memos: Memo[]): void => {
  baseMemos = memos
}

/**
 * Local edits replace memos.json wholesale rather than merging into it.
 * Merging would make deletions impossible to express, and memos are few
 * enough that a full working copy costs nothing.
 */
export const loadStoredMemos = (): Memo[] | null => {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return parseMemos(JSON.parse(raw))
  } catch {
    return null
  }
}

export const saveStoredMemos = (memos: Memo[]): void => {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos))
  } catch {
    // Storage full or blocked; edits just won't survive a reload.
  }
}

export const clearStoredMemos = (): void => {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Best-effort reset only.
  }
}

/**
 * Memos travel in the URL as JSON rather than a compact field list: the text
 * is free-form and would need escaping anyway, and the value is compressed
 * before it reaches the query string.
 */
export const serializeMemos = (memos: Memo[]): string => JSON.stringify(memos)

export const deserializeMemos = (raw: string): Memo[] | null => {
  if (raw === '') return null

  try {
    return parseMemos(JSON.parse(raw))
  } catch {
    return null
  }
}

/**
 * A shared link wins, then the local working copy, then what shipped with the
 * build. `null` from the link means "the link said nothing", which is not the
 * same as a link that deliberately carries no memos.
 */
export const getEffectiveMemos = (urlMemos: Memo[] | null = null): Memo[] =>
  urlMemos ?? loadStoredMemos() ?? baseMemos

/** Snapshot for committing as memos.json. */
export const dumpMemos = (): Memo[] => getEffectiveMemos()

export const createMemo = (id: string, x: number, y: number): Memo => ({
  id,
  text: '',
  // Drop the memo centred on the double-clicked point rather than hanging
  // off its top-left corner.
  x: x - DEFAULT_MEMO_WIDTH / 2,
  y: y - DEFAULT_MEMO_HEIGHT / 2,
  width: DEFAULT_MEMO_WIDTH,
  height: DEFAULT_MEMO_HEIGHT,
})
