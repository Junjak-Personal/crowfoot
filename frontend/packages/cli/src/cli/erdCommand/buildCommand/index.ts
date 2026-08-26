import { existsSync } from 'node:fs'
import path, { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SupportedFormat } from '@crowfoot/schema/parser'
import { blueBright } from 'yoctocolors'
import { ArgumentError, type CliError, FileSystemError } from '../../errors.js'
import { runPreprocess } from '../runPreprocess.js'
import { copySite } from './copySite.js'
import { reportOutcome } from './report.js'

type Options = {
  /** Stamped into `schema.json`'s `meta`, so a built file names the tool that wrote it. */
  crowfootVersion: string
  /**
   * Fail the build when anything was read but not representable.
   *
   * Off by default: a dropped DEFAULT is worth knowing about and is not worth
   * refusing to draw a diagram over. On, it is the difference between a
   * pipeline that reports the loss and one that carries on past it.
   */
  strict?: boolean | undefined
  /**
   * Print what was read as JSON on stdout instead of the usage note.
   *
   * Everything meant for a person goes to stderr while this is on, so
   * `erd build --json > report.json` gets only the report — the same split
   * `erd plan` already uses.
   */
  json?: boolean | undefined
}

export const buildCommand = async (
  inputPath: string,
  outDir: string,
  format: SupportedFormat | undefined,
  { json = false, strict = false, crowfootVersion }: Options,
): Promise<CliError[]> => {
  // Said the way `from-link`, `plan` and `arrange` say it. Without this the
  // path ran on into `glob`, which threw a raw V8 trace at whoever left the
  // flag off — the most likely way to get this command wrong.
  if (!inputPath) return [new ArgumentError('--input is required')]

  const resolvedOutDir = resolve(outDir)
  const note = json ? console.error : console.info

  // generate schema.json
  const {
    schema,
    unparsed,
    errors: preprocessErrors,
  } = await runPreprocess(inputPath, resolvedOutDir, format, crowfootVersion)
  if (preprocessErrors.length > 0) {
    // In the future, we want to allow dist to be generated and the process to complete successfully with a warning message, even if there are minor errors.
    // see also: actionRunner.ts
    return preprocessErrors
  }

  // generate index.html
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const cliHtmlPath = resolve(__dirname, '../html')
  const errors: CliError[] = []

  // Check if the source directory exists
  if (!existsSync(cliHtmlPath)) {
    errors.push(
      new FileSystemError(`The directory '${cliHtmlPath}' does not exist.`),
    )
    return errors
  }

  try {
    copySite(cliHtmlPath, resolvedOutDir)
  } catch (error) {
    errors.push(new FileSystemError(`Error processing files: ${error}`))
  }

  if (errors.length === 0) {
    // Reported only once everything that writes into the directory has run:
    // the numbers describe the `schema.json` that is now on disk.
    if (schema !== null) {
      const refused = reportOutcome({ schema, unparsed, json, strict })
      if (refused.length > 0) return refused
    }

    // For absolute paths, display the absolute path
    // For relative paths, display the relative path from the current directory
    let displayOutDir = resolvedOutDir
    if (!path.isAbsolute(outDir)) {
      displayOutDir = relative(process.cwd(), resolvedOutDir) || resolvedOutDir
    }
    note(`
ERD has been generated successfully in the \`${displayOutDir}/\` directory.
Note: You cannot open this file directly using \`file://\`.
Please serve the \`${displayOutDir}/\` directory with an HTTP server and access it via \`http://\`.
Example:
    ${blueBright(`$ npx serve ${displayOutDir}/`)}
    ${blueBright('or')}
    ${blueBright(`$ npx http-server -c-1 ${displayOutDir}/`)}
`)
  }
  return errors
}
