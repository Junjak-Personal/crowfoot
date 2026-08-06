// biome-ignore lint/correctness/noNodejsModules: this file is only used in tests
import fs from 'node:fs'
// biome-ignore lint/correctness/noNodejsModules: this file is only used in tests
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from './index.js'

describe(parse, () => {
  it('should parse schema.rb to JSON correctly', async () => {
    const schemaText = fs.readFileSync(
      path.resolve(__dirname, './schemarb/input/schema1.in.rb'),
      'utf-8',
    )

    const { value } = await parse(schemaText, 'schemarb')
    expect(value).toMatchSnapshot()
  })

  it('should parse postgresql to JSON correctly', async () => {
    const schemaText = fs.readFileSync(
      path.resolve(__dirname, './sql/input/postgresql_schema1.in.sql'),
      'utf-8',
    )

    const { value } = await parse(schemaText, 'postgres')
    expect(value).toMatchSnapshot()
  })

  it('should parse liam schema JSON correctly', async () => {
    const schemaJson = JSON.stringify({
      tables: {
        users: {
          name: 'users',
          columns: {
            id: {
              name: 'id',
              type: 'integer',
              notNull: true,
              default: null,
              check: null,
              comment: null,
            },
          },
          indexes: {},
          constraints: {},
          comment: null,
        },
      },
      enums: {},
      extensions: {},
    })

    const { value, errors } = await parse(schemaJson, 'liam')
    expect(errors).toEqual([])
    expect(value.tables['users']).toBeDefined()
  })
})
