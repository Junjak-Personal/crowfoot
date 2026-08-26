import { existsSync } from 'node:fs'
import path, { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SupportedFormat } from '@crowfoot/schema/parser'
import { blueBright } from 'yoctocolors'
import { type CliError, FileSystemError } from '../../errors.js'
import { runPreprocess } from '../runPreprocess.js'
import { copySite } from './copySite.js'
import { buildReport } from './report.js'

type Options = {
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
  format?: SupportedFormat,
  { json = false }: Options = {},
): Promise<CliError[]> => {
  const resolvedOutDir = resolve(outDir)
  const note = json ? console.error : console.info

  // generate schema.json
  const { schema, errors: preprocessErrors } = await runPreprocess(
    inputPath,
    resolvedOutDir,
    format,
  )
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
    // The report describes the schema.json that was just written, so it is
    // printed only once everything that writes into the directory has run.
    if (json && schema !== null) {
      process.stdout.write(`${JSON.stringify(buildReport(schema), null, 2)}\n`)
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
