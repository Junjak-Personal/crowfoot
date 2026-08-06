import { supportedFormatSchema } from '@crowfoot/schema/parser'
import { Command } from 'commander'
import { actionRunner } from '../actionRunner.js'
import { buildCommand } from './buildCommand/index.js'
import { fromLinkCommand } from './fromLinkCommand/index.js'

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
  .action(
    actionRunner((options) =>
      buildCommand(options.input, options.outputDir, options.format),
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

export { erdCommand }
