// Added in liam-custom; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
/**
 * Colour pool for tinting tables and memos.
 *
 * Every value is lifted from the design tokens in @liam-hq/ui
 * (styles/Dark/variables.css) rather than invented, so the ERD keeps looking
 * like the rest of the product. `--primary-accent` (green-400) is deliberately
 * absent: it means "highlighted/hovered" and must not double as a user colour.
 */
export const VIEW_COLORS = [
  { key: 'green', token: '--color-green-milk-200', value: '#5ec692' },
  { key: 'mint', token: '--color-green-milk-100', value: '#b0f9d4' },
  { key: 'teal', token: '--color-teal-600', value: '#87e2eb' },
  { key: 'sky', token: '--color-blue-milk-100', value: '#cce8f2' },
  { key: 'blue', token: '--color-blue-milk-200', value: '#97bdcb' },
  { key: 'steel', token: '--color-gray-400', value: '#5f6366' },
  { key: 'sand', token: '--color-yellow-milk-200', value: '#c3b476' },
  { key: 'yellow', token: '--color-yellow-milk-100', value: '#e7ddb3' },
  { key: 'gold', token: '--color-gold-300', value: '#ffbf36' },
  { key: 'orange', token: '--color-gold-600', value: '#dd6502' },
  { key: 'vermilion', token: '--color-vermilion-900', value: '#d55235' },
  { key: 'red', token: '--color-red-milk-200', value: '#ea928e' },
] as const

export type ViewColorKey = (typeof VIEW_COLORS)[number]['key']

const COLOR_VALUES = new Map<string, string>(
  VIEW_COLORS.map(({ key, value }) => [key, value]),
)

export const isViewColorKey = (value: unknown): value is ViewColorKey =>
  typeof value === 'string' && COLOR_VALUES.has(value)

/** Resolves a stored key to a CSS colour, or null for "no colour". */
export const resolveViewColor = (key: string | undefined): string | null =>
  key === undefined ? null : (COLOR_VALUES.get(key) ?? null)
