import { describe, expect, it } from 'vitest'
import { sanitizePgDumpMetaCommands } from './parser.js'

describe(sanitizePgDumpMetaCommands, () => {
  it('replaces \\restrict meta commands with spaces without changing length', () => {
    const sql = '\\restrict token\nCREATE TABLE foo (id integer);\n'
    const sanitized = sanitizePgDumpMetaCommands(sql)

    expect(sanitized.length).toBe(sql.length)
    const lines = sanitized.split('\n')
    const firstLine = lines[0]
    const secondLine = lines[1]
    expect(firstLine).toBeDefined()
    expect(firstLine?.trim()).toBe('')
    expect(secondLine).toBeDefined()
    expect(secondLine?.startsWith('CREATE TABLE')).toBe(true)
  })

  it('replaces \\restrict commands with spaces while preserving carriage returns', () => {
    const sql = '\\restrict token\r\nCREATE TABLE foo (id integer);\r\n'
    const sanitized = sanitizePgDumpMetaCommands(sql)

    expect(sanitized.length).toBe(sql.length)
    const firstLine = sanitized.split('\n')[0]
    expect(firstLine).toBeDefined()
    expect(firstLine?.endsWith('\r')).toBe(true)
    expect(firstLine?.trim()).toBe('')
  })

  it('replaces \\unrestrict meta commands', () => {
    const sql = '\\unrestrict token\nSELECT 1;'
    const sanitized = sanitizePgDumpMetaCommands(sql)

    expect(sanitized.length).toBe(sql.length)
    const firstLine = sanitized.split('\n')[0]
    expect(firstLine).toBeDefined()
    expect(firstLine?.trim()).toBe('')
  })
})
