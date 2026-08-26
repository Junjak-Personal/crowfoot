import { red, yellow } from 'yoctocolors'
import { CliError, CriticalError, WarningError } from './errors.js'
import { TroubleshootingUrl } from './urls.js'

function actionErrorHandler(error: Error) {
  if (error instanceof CriticalError) {
    console.error(red(`ERROR: ${error.message}`))
    return
  }

  if (error instanceof WarningError) {
    console.warn(yellow(`WARN: ${error.message}`))
    return
  }
}

/**
 * stderr, like the messages above it: `--json` puts a machine-readable report
 * on stdout, and a failure must not append prose to it.
 */
function printTroubleshootingUrl() {
  console.error(`For more information, see ${TroubleshootingUrl}`)
}

/**
 * A command reports a bad input either way — some return it, some throw it —
 * and both have to reach the same message.
 *
 * `erd arrange` throws every one of its checks (`readSchema`, `readPlan`, and
 * the plan validation inside `arrange`), so before this a plan naming a table
 * twice printed a raw V8 stack trace with `throw new ArgumentError` at the top
 * of it. The message was already written for a person to read; nothing was
 * reading it out.
 *
 * Only a `CliError` is caught. Anything else is a defect in this tool rather
 * than in what was passed to it, and a stack trace is the right output for
 * that — swallowing it would hide the one case where the trace is the point.
 */
const collectErrors = async <T>(
  fn: (args: T) => Promise<Error[]>,
  args: T,
): Promise<Error[]> => {
  try {
    return await fn(args)
  } catch (error) {
    if (!(error instanceof CliError)) throw error
    return [error]
  }
}

export function actionRunner<T>(fn: (args: T) => Promise<Error[]>) {
  return async (args: T) => {
    const errors = await collectErrors(fn, args)
    if (errors.length > 0) {
      errors.forEach(actionErrorHandler)
      printTroubleshootingUrl()

      // Currently, to align with the behavior of `buildCommand`, the process exits with status 1 if there is at least one error.
      // In the future, we want to allow dist to be generated and the process to complete successfully with a warning message, even if there are minor errors.
      // In that case, the process should exit with status 1 only if there is at least one `CriticalError`.
      process.exit(1)
    }
  }
}
