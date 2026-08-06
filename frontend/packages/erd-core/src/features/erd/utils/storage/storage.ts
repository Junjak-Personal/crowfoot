// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.

/**
 * Browser storage for the fork's view state, with a one-shot move off the key
 * names used by earlier releases — section 6 of the License grants no
 * trademark rights, so the keys have been renamed twice: `liam:*` up to 0.4.0,
 * then `erdkit:*`, now `crowfoot:*`.
 *
 * A browser that still holds an older value keeps it: the first read copies
 * the newest match to the current key and deletes every old one, so the
 * fallback runs once per browser and never again. `legacyKeys` is ordered
 * newest-first, and once no live browser can still be carrying a name it can
 * be dropped from that list.
 *
 * Every call site already sits inside a try/catch that falls back to the
 * sidecar file shipped with the build, so nothing here has to be total.
 */
export const readStoredItem = (
  key: string,
  legacyKeys: string[],
): string | null => {
  if (typeof localStorage === 'undefined') return null

  const stored = localStorage.getItem(key)
  if (stored !== null) return stored

  const legacy = legacyKeys
    .map((legacyKey) => localStorage.getItem(legacyKey))
    .find((value) => value !== null)
  if (legacy === undefined || legacy === null) return null

  try {
    localStorage.setItem(key, legacy)
    for (const legacyKey of legacyKeys) localStorage.removeItem(legacyKey)
  } catch {
    // Storage full or blocked. The value is still returned below and the old
    // keys stay put, so the move is simply retried on the next read.
  }

  return legacy
}

/**
 * Clears every name. Dropping only the current one would let the migration
 * above resurrect an old value on the very next read, which is not what a
 * reset means.
 */
export const removeStoredItem = (key: string, legacyKeys: string[]): void => {
  if (typeof localStorage === 'undefined') return

  localStorage.removeItem(key)
  for (const legacyKey of legacyKeys) localStorage.removeItem(legacyKey)
}
