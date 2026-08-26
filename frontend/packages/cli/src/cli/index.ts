// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import { Command } from 'commander'
import { erdCommand } from './erdCommand/index.js'
import { initCommand } from './initCommand/index.js'
import { crowfootVersion } from './version.js'

const program = new Command()

program
  .name('crowfoot')
  .description(
    'CLI tool for building ER diagram viewers.\n' +
      'A fork of Liam ERD (Apache-2.0, ROUTE06, Inc.) — https://github.com/liam-hq/liam',
  )
  .version(crowfootVersion)
program.addCommand(erdCommand)
program.addCommand(initCommand)
export { program }
