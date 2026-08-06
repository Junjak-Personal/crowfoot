#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageJsonPath = path.join(__dirname, '..', 'package.json')
const backupPath = path.join(__dirname, '..', 'package.json.backup')

const action = process.argv[2]

if (action === 'pre') {
  // Check if backup already exists to prevent accidental overwrites
  if (fs.existsSync(backupPath)) {
    console.error('Error: package.json.backup already exists.')
    console.error(
      'Please restore or remove the existing backup before proceeding:',
    )
    console.error(`  Restore: node ${path.basename(__filename)} post`)
    console.error(`  Remove: rm ${backupPath}`)
    process.exit(1)
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

  fs.writeFileSync(backupPath, JSON.stringify(packageJson, null, 2))

  if (packageJson.dependencies) {
    const filteredDeps = {}
    for (const [dep, version] of Object.entries(packageJson.dependencies)) {
      if (typeof version === 'string' && !version.startsWith('workspace:')) {
        filteredDeps[dep] = version
      }
    }
    packageJson.dependencies = filteredDeps
  }

  if (packageJson.devDependencies) {
    const filteredDevDeps = {}
    for (const [dep, version] of Object.entries(packageJson.devDependencies)) {
      if (typeof version === 'string' && !version.startsWith('workspace:')) {
        filteredDevDeps[dep] = version
      }
    }
    packageJson.devDependencies = filteredDevDeps
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
} else if (action === 'post') {
  if (fs.existsSync(backupPath)) {
    const backup = fs.readFileSync(backupPath, 'utf8')
    fs.writeFileSync(packageJsonPath, backup)
    fs.unlinkSync(backupPath)
  }
} else {
  console.error('Usage: node pack-cli.js [pre|post]')
  process.exit(1)
}
