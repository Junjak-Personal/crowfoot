// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.

/**
 * The deployed documents a link's edits were written against, kept so the
 * viewer can still say what changed after they have been redeployed. Once that
 * happens the previous copies are gone from the server, and the browser that
 * made the edits is the only place they can still exist.
 *
 * Cold on purpose. Nothing here runs on a plain load:
 *
 *   load           no localStorage call at all
 *   first edit     one write
 *   later edits    skipped, via the small key below
 *   version differs  the only time the big one is read
 *
 * Two keys so the skip check does not have to parse a few hundred kilobytes:
 * the hash is a handful of bytes, the documents are not.
 *
 * Best-effort throughout. The version notice is driven by `?base=` against the
 * documents just fetched, so it works with no cache at all — this only makes
 * the message sharper, and a browser that refuses storage loses nothing else.
 */
export type BaseDocuments = {
  schema: unknown
  layout: unknown
  memos: unknown
  groups: unknown
}

type Cached = BaseDocuments & { version: string }

const key = (suffix: string) =>
  `crowfoot:base${suffix}:${typeof location === 'object' ? location.pathname : ''}`

const HASH_KEY = () => key('-hash')
const DOCUMENTS_KEY = () => key('')

/**
 * Edit copies written by releases up to 0.3.0, when browser storage held a
 * working copy of the diagram rather than a cache of what was deployed. They
 * are read by nothing now; clearing them keeps a stale copy from sitting in
 * everyone's browser forever, and makes room for the cache below.
 */
const ABANDONED_KEYS = [
  'crowfoot:groups',
  'crowfoot:memos',
  'crowfoot:tableLayout',
  'erdkit:groups',
  'erdkit:memos',
  'erdkit:tableLayout',
  'liam:groups',
  'liam:memos',
  'liam:tableLayout',
]

const forget = (keys: string[]): void => {
  for (const name of keys) {
    try {
      localStorage.removeItem(name)
    } catch {
      // Storage blocked entirely; nothing to clean up from here.
    }
  }
}

/**
 * Stores the documents this session was edited against, unless that has
 * already been done for this version.
 */
export const cacheBaseDocuments = (
  version: string,
  documents: BaseDocuments,
): void => {
  if (typeof localStorage === 'undefined' || version === '') return

  try {
    if (localStorage.getItem(HASH_KEY()) === version) return
  } catch {
    return
  }

  const payload = JSON.stringify({ version, ...documents } satisfies Cached)

  // The first write for a version is the one moment this code is reached at
  // all, which makes it the place to clear what earlier releases left behind.
  forget(ABANDONED_KEYS)

  try {
    localStorage.setItem(DOCUMENTS_KEY(), payload)
    localStorage.setItem(HASH_KEY(), version)
  } catch {
    // Out of room. Drop the previous copy — it is for a version nobody is
    // looking at any more — and try once more before giving up.
    forget([DOCUMENTS_KEY(), HASH_KEY()])
    try {
      localStorage.setItem(DOCUMENTS_KEY(), payload)
      localStorage.setItem(HASH_KEY(), version)
    } catch {
      // Genuinely no room, or storage is disabled. The notice works without it.
    }
  }
}

/**
 * The documents a link was made against, if this browser is the one that made
 * it and they have not been overwritten since. Only ever called once a version
 * mismatch is already known.
 */
export const readCachedBase = (version: string): BaseDocuments | null => {
  if (typeof localStorage === 'undefined' || version === '') return null

  try {
    if (localStorage.getItem(HASH_KEY()) !== version) return null

    const raw = localStorage.getItem(DOCUMENTS_KEY())
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    if (!('schema' in parsed) || !('groups' in parsed)) return null
    if (!('layout' in parsed) || !('memos' in parsed)) return null

    return {
      schema: parsed.schema,
      layout: parsed.layout,
      memos: parsed.memos,
      groups: parsed.groups,
    }
  } catch {
    return null
  }
}
