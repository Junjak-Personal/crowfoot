// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { actionRunner } from './actionRunner.js'
import { ArgumentError, WarningError } from './errors.js'

/**
 * `process.exit` would take the test runner with it, and the message is what
 * these are about — the exit code is asserted by the fact that it was reached.
 */
const runWith = async (fn: () => Promise<Error[]>) => {
  const exit = vi
    .spyOn(process, 'exit')
    .mockImplementation((() => undefined) as never)
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})

  await actionRunner(fn)(undefined)

  return {
    exited: exit.mock.calls.length > 0,
    errors: error.mock.calls.flat().join('\n'),
    warnings: warn.mock.calls.flat().join('\n'),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe(actionRunner, () => {
  it('prints an error a command returned', async () => {
    const { exited, errors } = await runWith(async () => [
      new ArgumentError('--plan is required'),
    ])

    expect(errors).toContain('ERROR: --plan is required')
    expect(exited).toBe(true)
  })

  /**
   * `erd arrange` throws all of its input checks rather than returning them.
   * Before this, that reached the user as a raw stack trace.
   */
  it('prints an error a command threw, the same way', async () => {
    const { exited, errors } = await runWith(async () => {
      throw new ArgumentError('The plan puts "users" in two groups')
    })

    expect(errors).toContain('ERROR: The plan puts "users" in two groups')
    expect(exited).toBe(true)
  })

  it('prints a thrown warning as a warning', async () => {
    const { warnings } = await runWith(async () => {
      throw new WarningError('one table could not be placed')
    })

    expect(warnings).toContain('WARN: one table could not be placed')
  })

  /** A defect in this tool, not in what was passed to it. */
  it('lets an error that is not a CLI error keep its stack trace', async () => {
    await expect(
      runWith(async () => {
        throw new TypeError('cannot read properties of undefined')
      }),
    ).rejects.toThrow(TypeError)
  })

  it('says nothing and does not exit when a command reports no error', async () => {
    const { exited, errors } = await runWith(async () => [])

    expect(errors).toBe('')
    expect(exited).toBe(false)
  })
})
