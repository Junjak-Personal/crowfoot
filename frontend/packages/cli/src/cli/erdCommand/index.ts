import { supportedFormatSchema } from '@crowfoot/schema/parser'
import { Command } from 'commander'
import { actionRunner } from '../actionRunner.js'
import { arrangeCommand } from './arrangeCommand/index.js'
import { buildCommand } from './buildCommand/index.js'
import { fromLinkCommand } from './fromLinkCommand/index.js'
import { planCommand } from './planCommand/index.js'

const defaultDistDir = 'dist'

const erdCommand = new Command('erd').description('ERD commands')

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
  .action(
    actionRunner((options) =>
      buildCommand(options.input, options.outputDir, options.format, {
        json: options.json,
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
  .action(actionRunner((options) => planCommand(options.input)))

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
  .action(
    actionRunner((options) =>
      arrangeCommand(options.input, options.plan, options.outputDir),
    ),
  )

export { erdCommand }
