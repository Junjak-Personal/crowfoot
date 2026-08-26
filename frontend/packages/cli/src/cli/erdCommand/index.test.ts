import { describe, expect, it, vi } from 'vitest'
import { program } from '../../index.js'
import { buildCommand } from './buildCommand/index.js'

// Function to set up mocks
function setupMocks() {
  vi.mock('./buildCommand', () => ({
    buildCommand: vi.fn().mockImplementation(() => Promise.resolve([])),
  }))
}

setupMocks()

describe('program', () => {
  describe('commands', () => {
    it.each([['schemarb'], ['postgres']])(
      'should call buildCommand with correct arguments for format %s',
      (format) => {
        const inputFile = './fixtures/input.schema.rb'

        program.parse(
          ['erd', 'build', '--input', inputFile, '--format', format],
          {
            from: 'user',
          },
        )

        expect(buildCommand).toHaveBeenCalledWith(
          inputFile,
          expect.stringContaining('dist'),
          format,
          { json: undefined, crowfootVersion: expect.any(String) },
        )
      },
    )

    it('should use custom output directory when --output-dir is specified', () => {
      const inputFile = './fixtures/input.schema.rb'
      const format = 'schemarb'
      const customOutputDir = 'custom-output'

      program.parse(
        [
          'erd',
          'build',
          '--input',
          inputFile,
          '--format',
          format,
          '--output-dir',
          customOutputDir,
        ],
        {
          from: 'user',
        },
      )

      expect(buildCommand).toHaveBeenCalledWith(
        inputFile,
        customOutputDir,
        format,
        { json: undefined, crowfootVersion: expect.any(String) },
      )
    })

    it('passes --json through', () => {
      program.parse(
        ['erd', 'build', '--input', './fixtures/input.schema.rb', '--json'],
        { from: 'user' },
      )

      expect(buildCommand).toHaveBeenCalledWith(
        './fixtures/input.schema.rb',
        expect.stringContaining('dist'),
        undefined,
        { json: true, crowfootVersion: expect.any(String) },
      )
    })
  })
})
