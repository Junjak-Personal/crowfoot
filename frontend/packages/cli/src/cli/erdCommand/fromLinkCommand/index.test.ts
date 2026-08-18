// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

/** The same deflate → base64 → URL-safe pipeline, for links built in a test. */
const encode = (raw: string) =>
  deflateSync(Buffer.from(raw, 'utf8'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

describe('parseLink', () => {
  it('splits a position entry from the right so a table name may contain ":"', () => {
    const { positions } = parseLink(link(`positions=${POSITIONS}`))

    expect(positions).toEqual({
      'a:b': { x: 1, y: -2 },
      plain: { x: 10, y: 20 },
    })
  })

  /**
   * Kept apart rather than folded together, so that a table the link only
   * recoloured carries no position — an invented (0, 0) here would overwrite
   * the deployed one on merge.
   */
  it('reads colours as their own map, not as positions', () => {
    const { positions, colors } = parseLink(
      link(`positions=${POSITIONS}&colors=${COLORS}`),
    )

    expect(positions).toEqual({
      'a:b': { x: 1, y: -2 },
      plain: { x: 10, y: 20 },
    })
    expect(colors).toEqual({ plain: 'teal', onlycolor: 'orange' })
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
      positions: { 'a:b': { x: 1, y: -2 }, plain: { x: 10, y: 20 } },
      colors: null,
      memos: null,
      groups: null,
    })
    expect(parseLink(link('show=all'))).toEqual({
      positions: null,
      colors: null,
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

  const layoutIn = (
    dir: string,
  ): Record<string, { x: number; y: number; color?: string }> =>
    JSON.parse(readFileSync(join(dir, 'layout.json'), 'utf8'))

  /** 86 deployed tables, the size the loss was found at. */
  const deployed = Object.fromEntries(
    Array.from({ length: 86 }, (_, index) => [
      `t${index}`,
      { x: index, y: index * 2 },
    ]),
  )

  /** What a person who dragged 33 of them, and added 3 tables, would share. */
  const draggedLink = link(
    `positions=${encode(
      [
        ...Array.from(
          { length: 33 },
          (_, index) => `t${index}:${1000 + index}:${2000 + index}`,
        ),
        'fresh1:1:1',
        'fresh2:2:2',
        'fresh3:3:3',
      ].join(','),
    )}`,
  )

  /**
   * A link carries only the tables that were touched. Writing it out on its
   * own dropped every other table's position without a word, and the viewer
   * then auto-laid those tables out — 56 of 86 in the report this fixes.
   */
  it('keeps the deployed position of every table a link never moved', async () => {
    writeFileSync(
      join(outDir, 'layout.json'),
      JSON.stringify(deployed, null, 2),
    )

    await fromLinkCommand(draggedLink, outDir)

    const written = layoutIn(outDir)
    expect(Object.keys(written)).toHaveLength(89)
    expect(
      Object.fromEntries(
        Object.entries(written).filter(
          ([name]) => name.startsWith('t') && Number(name.slice(1)) >= 33,
        ),
      ),
    ).toEqual(
      Object.fromEntries(
        Object.entries(deployed).filter(
          ([name]) => Number(name.slice(1)) >= 33,
        ),
      ),
    )
  })

  it('moves the tables the link did move, and adds the ones it introduced', async () => {
    writeFileSync(
      join(outDir, 'layout.json'),
      JSON.stringify(deployed, null, 2),
    )

    await fromLinkCommand(draggedLink, outDir)

    const written = layoutIn(outDir)
    expect(written.t0).toEqual({ x: 1000, y: 2000 })
    expect(written.fresh1).toEqual({ x: 1, y: 1 })
  })

  /**
   * The count is the only thing on screen. `(33 tables)` read exactly like a
   * job well done while 56 positions were being deleted.
   */
  it('says how many tables it kept, updated and added', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    writeFileSync(
      join(outDir, 'layout.json'),
      JSON.stringify(deployed, null, 2),
    )

    await fromLinkCommand(draggedLink, outDir)

    expect(info.mock.calls.join('\n')).toContain(
      'layout.json (89 tables: 53 kept, 33 updated, 3 added)',
    )
    info.mockRestore()
  })

  it('says so when there was no deployed layout.json to merge into', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    await fromLinkCommand(link(`positions=${POSITIONS}`), outDir)

    expect(layoutIn(outDir)).toEqual({
      'a:b': { x: 1, y: -2 },
      plain: { x: 10, y: 20 },
    })
    expect(info.mock.calls.join('\n')).toContain('there was no layout.json in')
    info.mockRestore()
  })

  it('keeps the colour of a table the link only moved', async () => {
    writeFileSync(
      join(outDir, 'layout.json'),
      JSON.stringify({ plain: { x: 1, y: 2, color: 'sky' } }),
    )

    await fromLinkCommand(link(`positions=${POSITIONS}`), outDir)

    expect(layoutIn(outDir).plain).toEqual({ x: 10, y: 20, color: 'sky' })
  })

  /**
   * The other half of "per field, not per entry": a table can be recoloured
   * without ever being dragged, and the link then says nothing about where it
   * is. Reading that as a position is how it would end up at the origin.
   */
  it('keeps the position of a table the link only recoloured', async () => {
    writeFileSync(
      join(outDir, 'layout.json'),
      JSON.stringify({ onlycolor: { x: 900, y: 900 } }),
    )

    await fromLinkCommand(link(`colors=${COLORS}`), outDir)

    expect(layoutIn(outDir).onlycolor).toEqual({
      x: 900,
      y: 900,
      color: 'orange',
    })
  })

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

  /** The same three paths as groups — kept, replaced in place, tombstoned. */
  it('applies a memo diff to the deployed memos', async () => {
    writeFileSync(
      join(outDir, 'memos.json'),
      JSON.stringify([
        { id: 'untouched', text: 'Untouched' },
        { id: 'gone', text: 'Gone' },
        { id: 'm1', text: 'Before' },
      ]),
    )

    await fromLinkCommand(link(`memos=${MEMOS}`), outDir)

    expect(
      JSON.parse(readFileSync(join(outDir, 'memos.json'), 'utf8')),
    ).toEqual([
      { id: 'untouched', text: 'Untouched' },
      { id: 'm1', text: 'hi', x: 1, y: 2, width: 3, height: 4 },
    ])
  })

  it('does not touch a file the link says nothing about', async () => {
    writeFileSync(join(outDir, 'memos.json'), '[{"id":"kept"}]')

    await fromLinkCommand(link(`groups=${GROUPS}`), outDir)

    expect(readFileSync(join(outDir, 'memos.json'), 'utf8')).toBe(
      '[{"id":"kept"}]',
    )
  })
})
