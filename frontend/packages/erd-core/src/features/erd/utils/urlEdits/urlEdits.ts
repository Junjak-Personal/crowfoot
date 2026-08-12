// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { decompressFromEncodedUriComponent } from '../../../../utils/decompressFromEncodedUriComponent'

/**
 * Reading and clearing the edit parameters from outside React.
 *
 * The console helpers the docs describe (`crowfootGroups.dump()` and friends)
 * run before any provider is in scope, so they read the query string directly.
 * Everything inside the app reads the same values through the store.
 */
export const readEditParam = (name: string): string => {
  if (typeof location !== 'object') return ''

  const raw = new URLSearchParams(location.search).get(name)
  if (raw === null) return ''

  try {
    return decompressFromEncodedUriComponent(raw) ?? ''
  } catch {
    // A hand-edited or truncated value throws out of the decompressor. This
    // runs on every popstate, so letting that escape would take the canvas
    // down on a back press rather than degrading to "the link said nothing".
    return ''
  }
}

/** The comma-joined compressed parameters — `positions`, `colors`, `hidden`. */
export const readEditParamList = (name: string): string[] => {
  const value = readEditParam(name)
  return value === '' ? [] : value.split(',').filter(Boolean)
}

/** A plain, uncompressed parameter. */
export const readPlainParam = (name: string): string =>
  typeof location === 'object'
    ? (new URLSearchParams(location.search).get(name) ?? '')
    : ''

/**
 * Drops edit parameters from the address bar and reloads, which is what
 * "reset" means now that a browser-local working copy no longer exists: the
 * link is the edit, so taking it out of the link takes it back.
 */
export const clearEditParams = (names: string[]): void => {
  if (typeof location !== 'object') return

  const url = new URL(location.href)
  for (const name of names) url.searchParams.delete(name)

  location.replace(url.toString())
}
