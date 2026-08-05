// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import { createRequire } from 'node:module'
import { Command } from 'commander'
import { erdCommand } from './erdCommand/index.js'
import { initCommand } from './initCommand/index.js'

const program = new Command()

const require = createRequire(import.meta.url)
const { version } = require('../../package.json')

program
  .name('erdkit')
  .description(
    'CLI tool for building ER diagram viewers.\n' +
      'A fork of Liam ERD (Apache-2.0, ROUTE06, Inc.) — https://github.com/liam-hq/liam',
  )
  .version(version)
program.addCommand(erdCommand)
program.addCommand(initCommand)
export { program }
