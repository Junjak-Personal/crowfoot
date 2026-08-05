// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.

/**
 * Browser storage for the fork's view state, with a one-shot move off the
 * `liam:*` key names used up to 0.4.0 — section 6 of the License grants no
 * trademark rights, so the fork's keys are `erdkit:*`.
 *
 * A browser that still holds an old value keeps it: the first read copies it
 * to the new key and deletes the old one, so the fallback runs once per
 * browser and never again. Once no live browser can still be carrying the
 * old names, both `legacyKey` arguments and this fallback can be deleted.
 *
 * Every call site already sits inside a try/catch that falls back to the
 * sidecar file shipped with the build, so nothing here has to be total.
 */
export const readStoredItem = (
  key: string,
  legacyKey: string,
): string | null => {
  if (typeof localStorage === 'undefined') return null

  const stored = localStorage.getItem(key)
  if (stored !== null) return stored

  const legacy = localStorage.getItem(legacyKey)
  if (legacy === null) return null

  try {
    localStorage.setItem(key, legacy)
    localStorage.removeItem(legacyKey)
  } catch {
    // Storage full or blocked. The value is still returned below and the old
    // key stays put, so the move is simply retried on the next read.
  }

  return legacy
}

/**
 * Clears both names. Dropping only the new one would let the migration above
 * resurrect the old value on the very next read, which is not what a reset
 * means.
 */
export const removeStoredItem = (key: string, legacyKey: string): void => {
  if (typeof localStorage === 'undefined') return

  localStorage.removeItem(key)
  localStorage.removeItem(legacyKey)
}
