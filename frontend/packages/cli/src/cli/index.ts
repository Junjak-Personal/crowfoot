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
  // The package ships no documentation of its own — `files` carries the build
  // and the licences and nothing else — so for anyone working in another
  // repository, and for an agent especially, this is the manual.
  .addHelpText(
    'after',
    `
Quick start:
  $ crowfoot erd build --input schema.sql --format postgres
  $ npx serve dist/

  crowfoot init walks through picking a format and prints the command.

The output is a static site that reads ./schema.json over HTTP, so \`file://\`
will not open it. Every asset path is relative, so it can be mounted at a
sub-path without rebuilding.

Formats: postgres (.sql), schemarb (schema.rb), prisma, drizzle, tbls, liam.
MySQL, SQLite and BigQuery have no direct parser — export through tbls, or
pg_dump to PostgreSQL, and feed the result in.

Run \`crowfoot erd build --help\` for what a build reports about itself, and
\`crowfoot erd plan --help\` for arranging a diagram from a repository.
`,
  )
  .showHelpAfterError('(run with --help for usage)')
program.addCommand(erdCommand)
program.addCommand(initCommand)
export { program }
