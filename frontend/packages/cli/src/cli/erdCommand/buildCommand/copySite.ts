// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Writes the built viewer into `outDir`, replacing the one already there.
 *
 * `assets/` is emptied first because everything in it is content-hashed: a
 * rebuild writes `index-<newhash>.js` and leaves `index-<oldhash>.js` sitting
 * next to it forever. Nothing serves the stale copy — `index.html` names the new
 * one — but it is megabytes per rebuild, and a deploy that syncs without
 * `--delete` carries every one of them.
 *
 * Only `assets/`. The rest of `outDir` belongs to whoever deployed it:
 * `schema.json` is written by the preprocess step, and `layout.json`,
 * `memos.json` and `groups.json` are theirs to put there — the documented way to
 * make an arrangement permanent is to drop those three next to `schema.json`.
 * Clearing the whole directory would delete exactly the files the docs tell
 * people to keep.
 */
export const copySite = (fromDir: string, outDir: string): void => {
  mkdirSync(outDir, { recursive: true })
  rmSync(join(outDir, 'assets'), { recursive: true, force: true })
  cpSync(fromDir, outDir, { recursive: true })
}
