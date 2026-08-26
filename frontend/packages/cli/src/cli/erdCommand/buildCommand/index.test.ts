// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { describe, expect, it } from 'vitest'
import { ArgumentError } from '../../errors.js'
import { buildCommand } from './index.js'

describe('buildCommand', () => {
  /**
   * `from-link`, `plan` and `arrange` all say this. `build` used to run on into
   * `glob` and throw a raw V8 trace instead — at whoever left off the one flag
   * the command cannot work without, which is the likeliest way to get it wrong.
   */
  it('says which flag is missing rather than throwing', async () => {
    const errors = await buildCommand('', 'dist', undefined, {
      crowfootVersion: '0.0.0-test',
    })

    expect(errors).toEqual([new ArgumentError('--input is required')])
  })
})
