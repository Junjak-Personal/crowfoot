// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { ArgumentError, type CliError, FileSystemError } from '../../errors.js'

/**
 * What a link says about a set of records, since 0.4.0: only the ones it
 * changed, plus the ids it deleted. Mirrors erd-core's `RecordDiff`.
 */
type RecordDiff = {
  changed: Record<string, { id?: unknown }>
  removed: string[]
}

const isRecordDiff = (value: unknown): value is RecordDiff =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  'changed' in value &&
  typeof value.changed === 'object' &&
  value.changed !== null

/**
 * Base + diff, in the order `applyDiff` produces: the base's order is kept and
 * anything new is appended. Written out here rather than shared with erd-core
 * because this binary must not pull the viewer — and it is twelve lines.
 */
const applyRecordDiff = (base: unknown[], diff: RecordDiff): unknown[] => {
  const removed = new Set(diff.removed)
  const changed = new Map(
    Object.entries(diff.changed).map(([id, record]) => [id, record]),
  )

  const idOf = (record: unknown): string =>
    typeof record === 'object' && record !== null && 'id' in record
      ? String(record.id)
      : ''

  const kept = base
    .filter((record) => !removed.has(idOf(record)))
    .map((record) => changed.get(idOf(record)) ?? record)

  const inBase = new Set(base.map(idOf))
  const added = Object.entries(diff.changed)
    .filter(([id]) => !inBase.has(id) && !removed.has(id))
    .map(([, record]) => record)

  return [...kept, ...added]
}

/**
 * The deployed file a link's diff is measured against.
 *
 * A link carries only what it changed, so reproducing the whole file needs the
 * one that was on screen when the link was made. In the documented workflow
 * that is the file already sitting in `--output-dir` — the build wrote it, or
 * a previous `from-link` did. Missing means the link was made against nothing,
 * which is the case for a fresh build.
 */
const readBase = (outDir: string, fileName: string): unknown[] => {
  const path = join(outDir, fileName)
  if (!existsSync(path)) return []

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Inverse of erd-core's `compressToEncodedUriComponent`: deflate, base64,
 * then URL-safe. erd-core uses pako because it runs in the browser; here
 * `node:zlib` reads the same bytes.
 */
const decodeParam = (value: string): string => {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  return inflateSync(Buffer.from(base64, 'base64')).toString('utf8')
}

type TableEntry = { x: number; y: number; color?: string }

/**
 * `name:x:y`, split from the right — a table name may itself contain ':'.
 * Same rule as erd-core's `deserializeTableLayout`; keep the two in step.
 */
const parsePositions = (raw: string): Record<string, TableEntry> => {
  const layout: Record<string, TableEntry> = {}

  for (const entry of raw.split(',')) {
    const yAt = entry.lastIndexOf(':')
    if (yAt <= 0) continue
    const xAt = entry.lastIndexOf(':', yAt - 1)
    if (xAt <= 0) continue

    const x = Number(entry.slice(xAt + 1, yAt))
    const y = Number(entry.slice(yAt + 1))
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue

    layout[entry.slice(0, xAt)] = { x, y }
  }

  return layout
}

/**
 * `name:colorkey`, also split from the right. A table can be recoloured
 * without ever having been moved, so an unknown name starts at the origin.
 * The palette is not validated here — the viewer drops unknown keys on load,
 * and duplicating the key list would just let it drift.
 */
const applyColors = (
  layout: Record<string, TableEntry>,
  raw: string,
): Record<string, TableEntry> => {
  for (const entry of raw.split(',')) {
    const at = entry.lastIndexOf(':')
    if (at <= 0) continue

    const name = entry.slice(0, at)
    layout[name] = {
      ...(layout[name] ?? { x: 0, y: 0 }),
      color: entry.slice(at + 1),
    }
  }

  return layout
}

type LinkContents = {
  layout: Record<string, TableEntry> | null
  memos: RecordDiff | null
  groups: RecordDiff | null
}

/** Absent params stay `null`: "the link said nothing" is not "the link is empty". */
export const parseLink = (url: string): LinkContents => {
  let params: URLSearchParams
  try {
    params = new URL(url).searchParams
  } catch {
    throw new ArgumentError(`Not a URL: ${url}`)
  }

  const positions = params.get('positions')
  const colors = params.get('colors')
  const memos = params.get('memos')
  const groups = params.get('groups')

  let layout: Record<string, TableEntry> | null = null
  if (positions) layout = parsePositions(decodeParam(positions))
  if (colors) layout = applyColors(layout ?? {}, decodeParam(colors))

  // Applied raw against the deployed file — the CLI is not a sanitization
  // boundary, the viewer's parseMemos / parseGroups re-validate on load.
  //
  // A list here is a link from 0.3.0 or earlier, which carried the whole set
  // and replaced the file. Those are rejected rather than guessed at: reading
  // one as a diff would silently drop every record it does not name.
  let parsedMemos: RecordDiff | null = null
  if (memos) {
    const decoded: unknown = JSON.parse(decodeParam(memos))
    if (!isRecordDiff(decoded)) {
      throw new ArgumentError(
        '`memos` is not in the 0.4.0 shape. A link made by 0.3.0 or earlier carries the whole set; read it with that version of the CLI.',
      )
    }
    parsedMemos = { changed: decoded.changed, removed: decoded.removed ?? [] }
  }

  let parsedGroups: RecordDiff | null = null
  if (groups) {
    const decoded: unknown = JSON.parse(decodeParam(groups))
    if (!isRecordDiff(decoded)) {
      throw new ArgumentError(
        '`groups` is not in the 0.4.0 shape. A link made by 0.3.0 or earlier carries the whole set; read it with that version of the CLI.',
      )
    }
    parsedGroups = { changed: decoded.changed, removed: decoded.removed ?? [] }
  }

  return { layout, memos: parsedMemos, groups: parsedGroups }
}

export const fromLinkCommand = async (
  url: string,
  outDir: string,
): Promise<CliError[]> => {
  if (!url) return [new ArgumentError('--input is required')]

  let contents: LinkContents
  try {
    contents = parseLink(url)
  } catch (error) {
    if (error instanceof ArgumentError) return [error]
    return [new ArgumentError(`Could not read the link: ${error}`)]
  }

  const { layout, memos, groups } = contents
  if (layout === null && memos === null && groups === null) {
    return [
      new ArgumentError(
        'The link carries no `positions`, `colors`, `memos` or `groups`. Open the ERD with `?edit=1`, arrange it, then copy the URL.',
      ),
    ]
  }

  // Only the files the link actually carries are written: an absent param must
  // not overwrite a good layout.json with `{}`.
  const written: string[] = []
  const resolvedOutDir = resolve(outDir)

  try {
    mkdirSync(resolvedOutDir, { recursive: true })
    if (layout !== null) {
      writeFileSync(
        join(resolvedOutDir, 'layout.json'),
        `${JSON.stringify(layout, null, 2)}\n`,
      )
      written.push(`layout.json (${Object.keys(layout).length} tables)`)
    }
    if (memos !== null) {
      const next = applyRecordDiff(
        readBase(resolvedOutDir, 'memos.json'),
        memos,
      )
      writeFileSync(
        join(resolvedOutDir, 'memos.json'),
        `${JSON.stringify(next, null, 2)}\n`,
      )
      written.push(`memos.json (${next.length} memos)`)
    }
    if (groups !== null) {
      const next = applyRecordDiff(
        readBase(resolvedOutDir, 'groups.json'),
        groups,
      )
      writeFileSync(
        join(resolvedOutDir, 'groups.json'),
        `${JSON.stringify(next, null, 2)}\n`,
      )
      written.push(`groups.json (${next.length} groups)`)
    }
  } catch (error) {
    return [new FileSystemError(`Error writing files: ${error}`)]
  }

  console.info(`
Wrote ${written.join(' and ')} to \`${outDir}/\`.
The viewer loads them from the directory it loads \`schema.json\` from, so they
survive a rebuild only if you keep them there or commit them to your source.
`)

  return []
}
