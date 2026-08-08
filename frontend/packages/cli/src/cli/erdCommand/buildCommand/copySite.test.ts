import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copySite } from './copySite.js'

describe('copySite', () => {
  let root: string
  let source: string
  let outDir: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'crowfoot-copy-site-'))
    source = join(root, 'html')
    outDir = join(root, 'dist')

    mkdirSync(join(source, 'assets'), { recursive: true })
    writeFileSync(join(source, 'index.html'), 'new index')
    writeFileSync(join(source, 'assets', 'index-new.js'), 'new bundle')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('drops the bundles a previous build left behind', () => {
    mkdirSync(join(outDir, 'assets'), { recursive: true })
    writeFileSync(join(outDir, 'assets', 'index-old.js'), 'stale bundle')

    copySite(source, outDir)

    expect(readdirSync(join(outDir, 'assets'))).toEqual(['index-new.js'])
  })

  it('keeps the schema and the sidecars deployed next to it', () => {
    mkdirSync(outDir, { recursive: true })
    for (const name of [
      'schema.json',
      'layout.json',
      'memos.json',
      'groups.json',
    ]) {
      writeFileSync(join(outDir, name), `${name} contents`)
    }

    copySite(source, outDir)

    expect(readdirSync(outDir).sort()).toEqual([
      'assets',
      'groups.json',
      'index.html',
      'layout.json',
      'memos.json',
      'schema.json',
    ])
    expect(readFileSync(join(outDir, 'layout.json'), 'utf8')).toBe(
      'layout.json contents',
    )
  })

  it('writes into a directory that is not there yet', () => {
    copySite(source, outDir)

    expect(readFileSync(join(outDir, 'index.html'), 'utf8')).toBe('new index')
  })
})
