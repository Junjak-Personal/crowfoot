// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { parse } from '@crowfoot/schema/parser'
import { describe, expect, it } from 'vitest'
import { buildReport } from './report.js'

/**
 * The point of the report is that nobody has to count `schema.json` by hand to
 * find out whether the build read what was handed to it — so these assert the
 * counts against SQL whose contents can be read off the fixture, not against a
 * second traversal of the same object, which would only prove the traversal
 * agrees with itself.
 */
describe('buildReport', () => {
  const reportOf = async (sql: string) => {
    const { value, errors, unparsed } = await parse(sql, 'postgres')
    expect(errors).toEqual([])
    return buildReport(value, unparsed)
  }

  it('counts what the schema holds', async () => {
    expect(
      await reportOf(/* sql */ `
        CREATE EXTENSION "uuid-ossp";
        CREATE TYPE user_status AS ENUM ('active', 'banned');

        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          email TEXT UNIQUE,
          age INTEGER CHECK (age >= 0)
        );

        CREATE TABLE posts (
          id BIGSERIAL PRIMARY KEY,
          author_id BIGINT REFERENCES users (id),
          title TEXT
        );

        CREATE INDEX posts_title_idx ON posts (title);
      `),
    ).toEqual({
      tables: 2,
      columns: 6,
      constraints: { primaryKey: 2, foreignKey: 1, unique: 1, check: 1 },
      indexes: 1,
      enums: 1,
      extensions: 1,
      unparsed: [],
    })
  })

  /** Zero is a statement about the schema, so it has to be said, not omitted. */
  it('reports zero rather than leaving the count out', async () => {
    expect(
      await reportOf(/* sql */ `
        CREATE TABLE notes (
          id BIGSERIAL PRIMARY KEY
        );
      `),
    ).toEqual({
      tables: 1,
      columns: 1,
      constraints: { primaryKey: 1, foreignKey: 0, unique: 0, check: 0 },
      indexes: 0,
      enums: 0,
      extensions: 0,
      unparsed: [],
    })
  })
})
