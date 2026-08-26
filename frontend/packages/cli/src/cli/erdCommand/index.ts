import { supportedFormatSchema } from '@crowfoot/schema/parser'
import { Command } from 'commander'
import { actionRunner } from '../actionRunner.js'
import { crowfootVersion } from '../version.js'
import { arrangeCommand } from './arrangeCommand/index.js'
import { buildCommand } from './buildCommand/index.js'
import { fromLinkCommand } from './fromLinkCommand/index.js'
import { planCommand } from './planCommand/index.js'

const defaultDistDir = 'dist'

// Set here as well as on `program`: this command is built on its own and added
// with `addCommand`, which does not carry the parent's settings down to it.
const erdCommand = new Command('erd')
  .description('ERD commands')
  .showHelpAfterError('(run with --help for usage)')

erdCommand
  .command('build')
  .description('Build ERD html assets')
  .option(
    '--input <path|url>',
    'Path (supports glob patterns) or URL to the schema file(s)',
  )
  .option(
    '--format <format>',
    `Format of the input file (${supportedFormatSchema.options.join('|')})`,
  )
  .option(
    '--output-dir <path>',
    'Output directory for generated files',
    defaultDistDir,
  )
  .option('--json', 'Print what was read as JSON on stdout')
  .option('--strict', 'Exit 1 if anything was read but not represented')
  .addHelpText(
    'after',
    `
Examples:
  $ crowfoot erd build --input schema.sql --format postgres
  $ crowfoot erd build --input 'db/migrations/*.sql' --format postgres
  $ crowfoot erd build --input https://example.com/schema.sql --format postgres

  Report what was read, and refuse to pass over anything it could not:
  $ crowfoot erd build --input schema.sql --json > report.json
  $ crowfoot erd build --input schema.sql --json --strict

--format is worked out from the file name when it is left out.

--json writes the report to stdout and everything else to stderr, so
redirecting it gives a file rather than a transcript. It counts tables,
columns, constraints, indexes, enums and extensions, and lists \`unparsed\`:
clauses that were read and could not be represented, by table and column.
--strict turns a non-empty \`unparsed\` into exit 1.

The output is a static site — serve it over HTTP, \`file://\` will not work.
\`schema.json\` records what it was built from: \`jq .meta\` on it names every
source file with its sha256, the version that read them, and when.
`,
  )
  .action(
    actionRunner((options) =>
      buildCommand(options.input, options.outputDir, options.format, {
        json: options.json,
        strict: options.strict,
        crowfootVersion,
      }),
    ),
  )

erdCommand
  .command('from-link')
  .description(
    'Write layout.json / memos.json / groups.json from a shared ?edit=1 link',
  )
  .option('--input <url>', 'The shared ERD URL (quote it — it contains &)')
  .option(
    '--output-dir <path>',
    'Output directory for generated files',
    defaultDistDir,
  )
  .addHelpText(
    'after',
    `
Example:
  $ crowfoot erd from-link --input '<the ?edit=1 URL>' --output-dir dist

An arrangement made in edit mode lives in the URL, which makes it shareable but
not permanent. This writes it back out as the sidecar files the viewer loads on
every visit. Quote the URL — it contains &. Only the files the link actually
carries are written, so a link with no memos leaves an existing memos.json alone.
`,
  )
  .action(
    actionRunner((options) =>
      fromLinkCommand(options.input, options.outputDir),
    ),
  )

erdCommand
  .command('plan')
  .description(
    'Print a grouping plan with every table already in it, to edit and pass to `arrange`',
  )
  .option('--input <path>', 'Path to the schema.json that `erd build` wrote')
  .option(
    '--update <path>',
    'Bring an existing plan back in step with the schema instead of starting one',
  )
  .addHelpText(
    'after',
    `
Examples:
  $ crowfoot erd plan --input dist/schema.json > plan.json
  $ crowfoot erd arrange --input dist/schema.json --plan plan.json

  After the schema changes, bring the plan back in step:
  $ crowfoot erd plan --input dist/schema.json --update plan.json > next.json

The plan comes out with every table name already in it, so nothing has to be
typed by hand and no table can be misspelled. Edit the group names and which
tables belong to which, add memos, then hand it to \`arrange\`.

--update keeps every grouping decision already made. Tables the schema no
longer has are dropped, groups they empty go with them, and tables it has
gained are put in a group named "unassigned" for the next edit to place. A plan
naming a table that is gone stops \`arrange\` outright, which is what this is
for once hand-editing the JSON stops being realistic.

There are no coordinates anywhere in a plan — that is the point. Notes go to
stderr, so \`> plan.json\` gets only the plan.
`,
  )
  .action(actionRunner((options) => planCommand(options.input, options.update)))

erdCommand
  .command('arrange')
  .description(
    'Write layout.json / groups.json / memos.json from a plan, working out every position',
  )
  .option('--input <path>', 'Path to the schema.json that `erd build` wrote')
  .option('--plan <path>', 'Path to the plan (see `erd plan`)')
  .option(
    '--output-dir <path>',
    'Output directory for generated files',
    defaultDistDir,
  )
  .addHelpText(
    'after',
    `
Example:
  $ crowfoot erd arrange --input dist/schema.json --plan plan.json --output-dir dist

Works out every position from the plan and writes the sidecar files next to
schema.json, where the viewer looks for them. See \`crowfoot erd plan --help\`
for where a plan comes from.
`,
  )
  .action(
    actionRunner((options) =>
      arrangeCommand(options.input, options.plan, options.outputDir),
    ),
  )

export { erdCommand }
