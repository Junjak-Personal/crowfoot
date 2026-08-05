// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { ArgumentError, type CliError, FileSystemError } from '../../errors.js'

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
  memos: unknown[] | null
  groups: unknown[] | null
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

  let parsedMemos: unknown[] | null = null
  if (memos) {
    const decoded: unknown = JSON.parse(decodeParam(memos))
    if (!Array.isArray(decoded))
      throw new ArgumentError('`memos` is not a list')
    parsedMemos = decoded
  }

  // Written raw, same as memos above — the CLI is not a sanitization
  // boundary, the viewer's parseGroups re-validates on load.
  let parsedGroups: unknown[] | null = null
  if (groups) {
    const decoded: unknown = JSON.parse(decodeParam(groups))
    if (!Array.isArray(decoded))
      throw new ArgumentError('`groups` is not a list')
    parsedGroups = decoded
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
      writeFileSync(
        join(resolvedOutDir, 'memos.json'),
        `${JSON.stringify(memos, null, 2)}\n`,
      )
      written.push(`memos.json (${memos.length} memos)`)
    }
    if (groups !== null) {
      writeFileSync(
        join(resolvedOutDir, 'groups.json'),
        `${JSON.stringify(groups, null, 2)}\n`,
      )
      written.push(`groups.json (${groups.length} groups)`)
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
