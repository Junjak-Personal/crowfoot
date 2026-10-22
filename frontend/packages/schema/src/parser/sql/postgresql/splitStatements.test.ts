// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { describe, expect, it } from 'vitest'
import { splitStatements } from './splitStatements.js'

const textsOf = (sql: string) => splitStatements(sql).map((s) => s.text.trim())

describe('splitStatements', () => {
  it('splits on the semicolons that end statements', () => {
    expect(
      textsOf('CREATE TABLE a (id INT); CREATE TABLE b (id INT);'),
    ).toEqual(['CREATE TABLE a (id INT);', 'CREATE TABLE b (id INT);'])
  })

  it('keeps a trailing statement that never got its semicolon', () => {
    expect(textsOf('SELECT 1;\nCREATE TABLE a (id INT)')).toEqual([
      'SELECT 1;',
      'CREATE TABLE a (id INT)',
    ])
  })

  it('reports where each statement starts, as an index into the input', () => {
    const sql = 'SELECT 1;\nSELECT 2;'
    const [first, second] = splitStatements(sql)

    expect(first?.start).toBe(0)
    expect(second?.start).toBe(sql.indexOf('SELECT 2'))
    expect(sql.slice(second?.start)).toContain('SELECT 2')
  })

  /** The whole point: a `;` that is data, not punctuation. */
  it('ignores a semicolon inside a string', () => {
    expect(textsOf(`INSERT INTO a VALUES ('x;y'); SELECT 2;`)).toEqual([
      `INSERT INTO a VALUES ('x;y');`,
      'SELECT 2;',
    ])
  })

  it('reads a doubled quote as an escaped one, not the end of the string', () => {
    expect(textsOf(`SELECT 'it''s; fine'; SELECT 2;`)).toEqual([
      `SELECT 'it''s; fine';`,
      'SELECT 2;',
    ])
  })

  it('ignores a semicolon inside a quoted identifier', () => {
    expect(textsOf('CREATE TABLE "odd;name" (id INT); SELECT 2;')).toEqual([
      'CREATE TABLE "odd;name" (id INT);',
      'SELECT 2;',
    ])
  })

  it('reads a backslash escape inside an E string', () => {
    expect(textsOf(`SELECT E'a\\'; b'; SELECT 2;`)).toEqual([
      `SELECT E'a\\'; b';`,
      'SELECT 2;',
    ])
  })

  /**
   * A function body is the common case — it is full of semicolons and is one
   * statement. Splitting it is how a file of migrations becomes nonsense.
   */
  it('keeps a dollar-quoted body whole', () => {
    const sql = [
      'CREATE FUNCTION f() RETURNS void AS $$',
      'BEGIN',
      '  PERFORM 1; PERFORM 2;',
      'END;',
      '$$ LANGUAGE plpgsql;',
      'CREATE TABLE a (id INT);',
    ].join('\n')

    expect(textsOf(sql)).toHaveLength(2)
    expect(textsOf(sql)[1]).toBe('CREATE TABLE a (id INT);')
  })

  it('matches a dollar quote by its tag, not by the dollars alone', () => {
    const sql = [
      'CREATE FUNCTION f() RETURNS void AS $body$',
      '  SELECT $$ inner ; $$;',
      '$body$ LANGUAGE sql;',
      'SELECT 2;',
    ].join('\n')

    expect(textsOf(sql)).toHaveLength(2)
    expect(textsOf(sql)[1]).toBe('SELECT 2;')
  })

  it('ignores a semicolon in a line comment, and leaves the comment behind', () => {
    expect(textsOf('SELECT 1; -- and; then\nSELECT 2;')).toEqual([
      'SELECT 1;',
      'SELECT 2;',
    ])
  })

  it('ignores a semicolon in a block comment', () => {
    expect(textsOf('SELECT 1 /* a; b */; SELECT 2;')).toEqual([
      'SELECT 1 /* a; b */;',
      'SELECT 2;',
    ])
  })

  /** Postgres nests them, unlike C. */
  it('closes a nested block comment at the right end', () => {
    expect(textsOf('SELECT 1 /* a /* b; */ c; */; SELECT 2;')).toEqual([
      'SELECT 1 /* a /* b; */ c; */;',
      'SELECT 2;',
    ])
  })

  it('finds nothing in input that is only comments and space', () => {
    expect(splitStatements('  -- nothing\n/* here */\n  ')).toEqual([])
  })

  it('finds nothing in empty input', () => {
    expect(splitStatements('')).toEqual([])
  })

  /**
   * Every byte of the input has to be inside a statement or between two of
   * them. A splitter that quietly dropped a region is the failure this replaces.
   */
  it('covers the input, leaving only whitespace and comments between', () => {
    const sql = [
      '-- header',
      'CREATE TABLE a (id INT);',
      '',
      "INSERT INTO a VALUES ('x;y');",
      'CREATE TABLE b (id INT)',
    ].join('\n')

    const statements = splitStatements(sql)
    let cursor = 0
    for (const statement of statements) {
      expect(sql.slice(cursor, statement.start).trim()).toMatch(
        /^(--[^\n]*|\s)*$/,
      )
      cursor = statement.start + statement.text.length
    }
    expect(sql.slice(cursor).trim()).toBe('')
  })
})
