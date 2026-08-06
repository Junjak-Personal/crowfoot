import { describe, expect, it } from 'vitest'
import { aColumn, anEnum, aSchema, aTable } from '../../schema/index.js'
import { processor } from './index.js'

describe('liam processor', () => {
  it('should parse valid Liam Schema JSON correctly', async () => {
    const input = JSON.stringify({
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
            email: {
              name: 'email',
              type: 'varchar(255)',
              notNull: false,
              default: null,
              check: null,
              comment: 'User email address',
            },
          },
          indexes: {},
          constraints: {},
          comment: 'Users table',
        },
      },
      enums: {},
      extensions: {},
    })

    const { value, errors } = await processor(input)

    expect(errors).toEqual([])
    expect(value).toEqual(
      aSchema({
        tables: {
          users: aTable({
            name: 'users',
            columns: {
              id: aColumn({
                name: 'id',
                type: 'integer',
                notNull: true,
                comment: null,
              }),
              email: aColumn({
                name: 'email',
                type: 'varchar(255)',
                notNull: false,
                comment: 'User email address',
              }),
            },
            comment: 'Users table',
          }),
        },
      }),
    )
  })

  it('should handle schema with enums', async () => {
    const input = JSON.stringify({
      tables: {},
      enums: {
        status: {
          name: 'status',
          values: ['active', 'inactive'],
          comment: null,
        },
      },
      extensions: {},
    })

    const { value, errors } = await processor(input)

    expect(errors).toEqual([])
    expect(value.enums).toEqual({
      status: anEnum({
        name: 'status',
        values: ['active', 'inactive'],
        comment: null,
      }),
    })
  })

  it('should return error for invalid JSON', async () => {
    const input = 'invalid json{'

    const { value, errors } = await processor(input)

    expect(errors.length).toBeGreaterThan(0)
    expect(value).toEqual({ tables: {}, enums: {}, extensions: {} })
  })

  it('should return error for invalid schema structure', async () => {
    const input = JSON.stringify({
      tables: 'not an object',
      enums: {},
      extensions: {},
    })

    const { value, errors } = await processor(input)

    expect(errors.length).toBeGreaterThan(0)
    expect(value).toEqual({ tables: {}, enums: {}, extensions: {} })
  })
})
