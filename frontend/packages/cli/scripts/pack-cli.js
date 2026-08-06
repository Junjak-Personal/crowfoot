#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageDir = path.join(__dirname, '..')
const repoRoot = path.join(packageDir, '..', '..', '..')
const packageJsonPath = path.join(packageDir, 'package.json')

// Apache-2.0 §4(a) and §4(d): the tarball must carry both. Copied in at pack
// time so they cannot drift from the repo-root originals.
const licenseFiles = ['LICENSE', 'NOTICE']

const action = process.argv[2]

if (action === 'pre') {
  // `npm publish` reads the manifest it uploads BEFORE prepack runs, so a
  // `workspace:*` runtime dep cannot be stripped here — it reaches the registry
  // and every `npx crowfoot` then dies with EUNSUPPORTEDPROTOCOL, even though the
  // tarball itself looks clean. Fail loudly instead. erd-core and schema are
  // inlined into cli.js by rollup, so they belong in devDependencies.
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const workspaceDeps = Object.entries(packageJson.dependencies ?? {}).filter(
    ([, version]) => String(version).startsWith('workspace:'),
  )

  if (workspaceDeps.length > 0) {
    console.error(
      'Error: `dependencies` contains workspace protocol entries, which the',
    )
    console.error('published manifest cannot express:')
    for (const [dep, version] of workspaceDeps) {
      console.error(`  ${dep}: ${version}`)
    }
    console.error(
      'Move them to devDependencies (they are bundled by rollup) or publish them.',
    )
    process.exit(1)
  }

  for (const file of licenseFiles) {
    fs.copyFileSync(path.join(repoRoot, file), path.join(packageDir, file))
  }
} else if (action === 'post') {
  for (const file of licenseFiles) {
    fs.rmSync(path.join(packageDir, file), { force: true })
  }
} else {
  console.error('Usage: node pack-cli.js [pre|post]')
  process.exit(1)
}
