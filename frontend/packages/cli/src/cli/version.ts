// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { createRequire } from 'node:module'

/**
 * The published version, read once.
 *
 * `../../package.json` resolves to the same manifest from `src/cli/` and from
 * the bundle at `dist-cli/bin/cli.js`, which is the only reason this can be a
 * module of its own: rollup flattens every source file into that one bundle,
 * so a path written from a deeper directory — `erdCommand/`, say — resolves
 * correctly against the source tree and not at all against the build.
 */
const require = createRequire(import.meta.url)
const { version } = require('../../package.json')

export const crowfootVersion: string = version
