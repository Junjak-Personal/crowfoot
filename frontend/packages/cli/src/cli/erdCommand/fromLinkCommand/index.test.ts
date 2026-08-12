// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fromLinkCommand, parseLink } from './index.js'

// Produced by the same deflate → base64 → URL-safe pipeline the browser uses.
const POSITIONS = 'eJxLtEqyMrTSNdIpyEnMzLMyNLAyMgAAO0gFeQ' // a:b:1:-2,plain:10:20
const COLORS = 'eJwryEnMzLMqSU3M0cnPy6lMzs_JL7LKL0rMS08FAJUjCrg' // plain:teal,onlycolor:orange
// { changed: { m1: {…} }, removed: ['gone'] }
const MEMOS =
  'eJwVzDsKgDAQANG7TL2Nn2qvIhZilmwKDUjQiOTukmZ41Xzsvp3RAvpxDL0poJ1CsVpQPCFUdBBedBSeFIqjk-CWohd0bk247Mh3Py3EfBpr-wEauBw7'
// { changed: { g1: {…} }, removed: ['dropped'] }
const GROUPS =
  'eJw9jDsKgDAQBe_y6jS2OYQXCBaru0TBfNgEQULuLtvYPIZheAPHSTkKww_ExfZieEOHTEngUelNknuDQ6f9lpWSNPiAoixq-i-2OR1UUnnsMYC11CqMbX78FiMG'
// [{id:g1,name:old}] — the whole set, as 0.3.0 and earlier wrote it.
const LEGACY_GROUPS = 'eJyLrlbKTFGyUko3VNJRykvMTVWyUsrPSVGqjQUAZC8Hpg'

const link = (query: string) => `https://erd.example/?edit=1&${query}`

describe('parseLink', () => {
  it('splits a position entry from the right so a table name may contain ":"', () => {
    const { layout } = parseLink(link(`positions=${POSITIONS}`))

    expect(layout).toEqual({
      'a:b': { x: 1, y: -2 },
      plain: { x: 10, y: 20 },
    })
  })

  it('keeps the position of a table that was also recoloured', () => {
    const { layout } = parseLink(
      link(`positions=${POSITIONS}&colors=${COLORS}`),
    )

    expect(layout?.plain).toEqual({ x: 10, y: 20, color: 'teal' })
  })

  it('places a colour-only table at the origin rather than dropping it', () => {
    const { layout } = parseLink(link(`colors=${COLORS}`))

    expect(layout?.onlycolor).toEqual({ x: 0, y: 0, color: 'orange' })
  })

  it('decodes the memos a link changed, and the ones it deleted', () => {
    const { memos } = parseLink(link(`memos=${MEMOS}`))

    expect(memos).toEqual({
      changed: {
        m1: { id: 'm1', text: 'hi', x: 1, y: 2, width: 3, height: 4 },
      },
      removed: ['gone'],
    })
  })

  // Applied raw against the deployed file — the CLI is not a sanitization
  // boundary, the viewer's parseGroups re-validates on load.
  it('decodes the groups a link changed, and the ones it deleted', () => {
    const { groups } = parseLink(link(`groups=${GROUPS}`))

    expect(groups).toEqual({
      changed: {
        g1: { id: 'g1', name: 'payments', tableNames: ['orders', 'payments'] },
      },
      removed: ['dropped'],
    })
  })

  /**
   * Reading one as a diff would silently drop every record it does not name,
   * which is exactly the sort of quiet wrong answer this refuses to give.
   */
  it('refuses a link from before the format changed rather than misreading it', () => {
    expect(() => parseLink(link(`groups=${LEGACY_GROUPS}`))).toThrowError(
      /not in the 0\.4\.0 shape/,
    )
  })

  // An absent param must stay null: the caller writes only the files the link
  // carries, so `{}` never overwrites a good layout.json.
  it('reports an absent param as null rather than empty', () => {
    expect(parseLink(link(`positions=${POSITIONS}`))).toEqual({
      layout: { 'a:b': { x: 1, y: -2 }, plain: { x: 10, y: 20 } },
      memos: null,
      groups: null,
    })
    expect(parseLink(link('show=all'))).toEqual({
      layout: null,
      memos: null,
      groups: null,
    })
  })

  it('rejects a value that is not a URL', () => {
    expect(() => parseLink('not a url')).toThrowError(/Not a URL/)
  })
})

describe('fromLinkCommand', () => {
  let outDir: string

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'crowfoot-from-link-'))
  })

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true })
  })

  const groupsIn = (dir: string): { id: string; name?: string }[] =>
    JSON.parse(readFileSync(join(dir, 'groups.json'), 'utf8'))

  /**
   * The whole reason a link is a diff: what it does not mention has to survive
   * it. Rewriting `groups.json` from the link alone would delete every group
   * the person who made it never touched.
   */
  it('leaves the deployed groups a link never mentions alone', async () => {
    writeFileSync(
      join(outDir, 'groups.json'),
      JSON.stringify([
        { id: 'untouched', name: 'Untouched', tableNames: ['a'] },
        { id: 'dropped', name: 'Dropped', tableNames: ['b'] },
      ]),
    )

    await fromLinkCommand(link(`groups=${GROUPS}`), outDir)

    expect(groupsIn(outDir).map((group) => group.id)).toEqual([
      'untouched',
      'g1',
    ])
  })

  it('replaces a deployed group the link changed, in place', async () => {
    writeFileSync(
      join(outDir, 'groups.json'),
      JSON.stringify([
        { id: 'g1', name: 'Before', tableNames: ['a'] },
        { id: 'after', name: 'After', tableNames: ['b'] },
      ]),
    )

    await fromLinkCommand(link(`groups=${GROUPS}`), outDir)

    expect(groupsIn(outDir).map((group) => group.name)).toEqual([
      'payments',
      'After',
    ])
  })

  it('writes what the link carries when nothing is deployed yet', async () => {
    await fromLinkCommand(link(`groups=${GROUPS}`), outDir)

    expect(groupsIn(outDir).map((group) => group.id)).toEqual(['g1'])
  })

  it('does not touch a file the link says nothing about', async () => {
    writeFileSync(join(outDir, 'memos.json'), '[{"id":"kept"}]')

    await fromLinkCommand(link(`groups=${GROUPS}`), outDir)

    expect(readFileSync(join(outDir, 'memos.json'), 'utf8')).toBe(
      '[{"id":"kept"}]',
    )
  })
})
