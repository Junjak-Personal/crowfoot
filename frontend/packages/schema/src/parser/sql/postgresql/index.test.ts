import { describe, expect, it } from 'vitest'
import type { Table } from '../../../schema/index.js'
import { aColumn, aSchema, aTable } from '../../../schema/index.js'
import { createParserTestCases } from '../../__tests__/index.js'
import { processor } from './index.js'

describe(processor, () => {
  const userTable = (override?: Partial<Table>) =>
    aSchema({
      tables: {
        users: aTable({
          name: 'users',
          columns: {
            id: aColumn({
              name: 'id',
              type: 'bigserial',
              notNull: true,
            }),
            ...override?.columns,
          },
          indexes: {
            ...override?.indexes,
          },
          comment: override?.comment ?? null,
          constraints: {
            ...override?.constraints,
            users_pkey: {
              name: 'users_pkey',
              type: 'PRIMARY KEY',
              columnNames: ['id'],
            },
          },
        }),
      },
    })
  const parserTestCases = createParserTestCases(userTable)

  describe('should parse CREATE TABLE statement correctly', () => {
    it('table comment', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY
        );
        COMMENT ON TABLE users IS 'store our users.';
      `)

      expect(value).toEqual(parserTestCases['table comment'])
    })

    it('column commnet', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          description TEXT
        );
        COMMENT ON COLUMN users.description IS 'this is description';
      `)

      expect(value).toEqual(parserTestCases['column comment'])
    })

    it('not null', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL
        );
      `)

      expect(value).toEqual(parserTestCases['not null'])
    })

    it('nullable', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          description TEXT
        );
      `)

      expect(value).toEqual(parserTestCases.nullable)
    })

    it('default value as string', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          description TEXT DEFAULT 'user''s description'
        );
      `)

      expect(value).toEqual(parserTestCases['default value as string'])
    })

    it('default value as integer', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          age INTEGER DEFAULT 30
        );
      `)

      expect(value).toEqual(parserTestCases['default value as integer'])
    })

    it('default value as boolean', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          active BOOLEAN DEFAULT TRUE
        );
      `)

      expect(value).toEqual(parserTestCases['default value as boolean'])
    })

    /**
     * Every case here used to come back null, which reads as "this column has
     * no default" — a wrong statement about the schema rather than a missing
     * one. Between them they were most of the DEFAULT clauses in the schemas
     * this was measured against.
     */
    describe('default values', () => {
      const defaultsOf = async (columns: string) => {
        const { value } = await processor(/* sql */ `
          CREATE TABLE users (
            id BIGSERIAL PRIMARY KEY,
            ${columns}
          );
        `)

        return Object.fromEntries(
          Object.values(value.tables['users']?.columns ?? {}).map((column) => [
            column.name,
            column.default,
          ]),
        )
      }

      it('keeps a falsy default instead of reading it as absent', async () => {
        expect(
          await defaultsOf(`
            active BOOLEAN DEFAULT FALSE,
            score INTEGER DEFAULT 0,
            note TEXT DEFAULT ''
          `),
        ).toMatchObject({ active: false, score: 0, note: '' })
      })

      it('reads a negative integer as itself rather than as zero', async () => {
        expect(
          await defaultsOf(`
            rank INTEGER DEFAULT -1,
            offset_days INTEGER DEFAULT -30
          `),
        ).toMatchObject({ rank: -1, offset_days: -30 })
      })

      it('reads a decimal default', async () => {
        expect(await defaultsOf('ratio NUMERIC DEFAULT 0.5')).toMatchObject({
          ratio: 0.5,
        })
      })

      it('records the call a function default makes', async () => {
        expect(
          await defaultsOf(`
            created_at TIMESTAMP DEFAULT now(),
            token UUID DEFAULT gen_random_uuid(),
            seq INTEGER DEFAULT nextval('users_seq'::regclass)
          `),
        ).toMatchObject({
          created_at: 'now()',
          token: 'gen_random_uuid()',
          seq: "nextval('users_seq')",
        })
      })

      it('records a keyword function under its keyword', async () => {
        expect(
          await defaultsOf('created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
        ).toMatchObject({ created_at: 'CURRENT_TIMESTAMP' })
      })

      it('takes the value out of a cast and leaves the cast behind', async () => {
        expect(
          await defaultsOf(`
            kind VARCHAR(10) DEFAULT 'manual'::character varying,
            payload JSONB DEFAULT '{}'::jsonb
          `),
        ).toMatchObject({ kind: 'manual', payload: '{}' })
      })

      it('leaves an expression it cannot represent null rather than guessing', async () => {
        expect(
          await defaultsOf("label TEXT DEFAULT ('a' || 'b')"),
        ).toMatchObject({ label: null })
      })

      /**
       * `ARRAY[]::uuid[]` and `'{}'` are the same default written two ways, and
       * pg_dump writes the first. Reading only the second made a plain dump of
       * a schema with an array column fail `--strict` — the check meant to
       * catch a real loss firing on a default that was never lost.
       */
      it('reads an ARRAY constructor as the array literal it stands for', async () => {
        expect(
          await defaultsOf(`
            mentions UUID[] DEFAULT ARRAY[]::uuid[],
            roles TEXT[] DEFAULT ARRAY['admin', 'user']
          `),
        ).toMatchObject({ mentions: '{}', roles: '{admin,user}' })
      })

      /** An element that would otherwise end the literal early. */
      it('quotes an array element that carries a comma', async () => {
        expect(
          await defaultsOf("labels TEXT[] DEFAULT ARRAY['a,b', 'c']"),
        ).toMatchObject({ labels: '{"a,b",c}' })
      })
    })

    /**
     * A DEFAULT the parser cannot represent comes back `null`, which is what a
     * column with *no* default looks like — a wrong statement about the schema
     * rather than a missing one, and nothing counting the output can tell the
     * two apart. `unparsed` is where it says so.
     */
    describe('unparsed defaults', () => {
      const unparsedOf = async (columns: string) => {
        const { unparsed, errors } = await processor(/* sql */ `
          CREATE TABLE users (
            id BIGSERIAL PRIMARY KEY,
            ${columns}
          );
        `)
        expect(errors).toEqual([])
        return unparsed
      }

      it('names the column and quotes the clause it could not read', async () => {
        expect(await unparsedOf("label TEXT DEFAULT ('a' || 'b')")).toEqual([
          {
            table: 'users',
            column: 'label',
            clause: 'DEFAULT',
            raw: "('a' || 'b')",
          },
        ])
      })

      /**
       * The check has to be quiet on what a plain pg_dump contains, or it gets
       * switched off — and a check nobody runs catches nothing.
       */
      it('says nothing about an ARRAY default, which it can read', async () => {
        expect(
          await unparsedOf('mentions UUID[] DEFAULT ARRAY[]::uuid[]'),
        ).toEqual([])
      })

      /** A comma inside the literal does not end the expression. */
      it('reads to the end of the expression, not the first comma', async () => {
        expect(
          await unparsedOf(`
            label TEXT DEFAULT ('a' || ','),
            note TEXT
          `),
        ).toEqual([
          {
            table: 'users',
            column: 'label',
            clause: 'DEFAULT',
            raw: "('a' || ',')",
          },
        ])
      })

      it('says nothing when every default was read', async () => {
        expect(
          await unparsedOf(`
            active BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT now(),
            plain TEXT
          `),
        ).toEqual([])
      })
    })

    /**
     * The parser reads a schema, it does not replay one: only `CREATE` and
     * `ADD CONSTRAINT` reach the diagram. Fed a migration that *changes* an
     * earlier statement, it drew the schema as it was before the change and
     * said nothing — the table count was right, every column it listed was
     * real, and the ones the migration had added, dropped or renamed were
     * simply not there. Nothing counting the output could find it.
     *
     * These are named instead. What the parser cannot apply, it has to admit.
     */
    describe('unapplied changes', () => {
      const unappliedOf = async (sql: string) => {
        const { unparsed } = await processor(sql)
        return unparsed.map((entry) => entry.raw)
      }

      const base = /* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL,
          goner TEXT
        );
      `

      it('names a change to a table it never read', async () => {
        expect(
          await unappliedOf(`
            ${base}
            ALTER TABLE absent ADD COLUMN nickname TEXT;
            ALTER TABLE absent DROP COLUMN goner;
          `),
        ).toEqual([
          'ALTER TABLE absent ADD COLUMN nickname TEXT',
          'ALTER TABLE absent DROP COLUMN goner',
        ])
      })

      /**
       * Without `IF EXISTS`, a target that is not there means the schema is not
       * the one this statement was written against — something earlier was
       * missed, and the diagram should not pretend otherwise.
       */
      it('names a DROP or RENAME of something it never drew', async () => {
        expect(
          await unappliedOf(`
            ${base}
            DROP TABLE absent;
            DROP INDEX ix_absent;
            ALTER TABLE absent RENAME TO other;
            ALTER TABLE users RENAME COLUMN absent TO other;
          `),
        ).toEqual([
          'DROP TABLE absent',
          'DROP INDEX ix_absent',
          'ALTER TABLE absent RENAME TO other',
          'ALTER TABLE users RENAME COLUMN absent TO other',
        ])
      })

      it('says nothing about ADD CONSTRAINT, which it does apply', async () => {
        expect(
          await unappliedOf(`
            ${base}
            CREATE TABLE posts (id BIGSERIAL PRIMARY KEY, author_id BIGINT);
            ALTER TABLE posts
              ADD CONSTRAINT posts_author_fkey
              FOREIGN KEY (author_id) REFERENCES users (id);
          `),
        ).toEqual([])
      })

      /**
       * A check that fires on a plain `pg_dump` gets switched off, and a check
       * nobody runs catches nothing. None of this changes the diagram.
       */
      it('says nothing about what pg_dump wraps a schema in', async () => {
        expect(
          await unappliedOf(`
            SET statement_timeout = 0;
            SET client_encoding = 'UTF8';
            SELECT pg_catalog.set_config('search_path', '', false);
            CREATE SCHEMA app;
            ${base}
            ALTER TABLE users ALTER COLUMN id
              ADD GENERATED BY DEFAULT AS IDENTITY (SEQUENCE NAME users_id_seq);
            COMMENT ON TABLE users IS 'people';
            COMMENT ON COLUMN users.email IS 'their address';
          `),
        ).toEqual([])
      })

      /**
       * A statement begins, as postgres measures it, just past the previous
       * semicolon — so everything written between the two comes with it. On the
       * first statement of a migration that is the file's whole header.
       */
      it('quotes the statement without the comments in front of it', async () => {
        expect(
          await unappliedOf(`
            -- 010_drop_absent.sql
            -- Moved to user_word_state.

            /* one more, in the other shape */
            DROP TABLE absent;
          `),
        ).toEqual(['DROP TABLE absent'])
      })

      /**
       * A `DO` body is a string to the parser — the statements inside it are
       * never seen, so DDL in there is applied to a database and not to this
       * schema. The demo hid an enum in one for its whole life.
       *
       * Reported on what the body says, which is a guess: a block that only
       * moves data around is the common case and saying so every time is the
       * noise that gets a check switched off.
       */
      it('names a DO block that mentions DDL it cannot see inside', async () => {
        expect(
          await unappliedOf(`
            ${base}
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mood') THEN
                CREATE TYPE mood AS ENUM ('ok');
              END IF;
            END $$;
          `),
        ).toEqual([expect.stringContaining('CREATE TYPE mood AS ENUM')])
      })

      it('says nothing about a DO block that only moves data', async () => {
        expect(
          await unappliedOf(`
            ${base}
            DO $$ BEGIN UPDATE users SET email = lower(email); END $$;
          `),
        ).toEqual([])
      })

      it('says nothing about objects it never draws', async () => {
        expect(
          await unappliedOf(`
            ${base}
            CREATE SEQUENCE users_seq;
            CREATE VIEW active_users AS SELECT id FROM users;
            CREATE POLICY users_own ON users FOR SELECT USING (true);
            GRANT SELECT ON users TO PUBLIC;
            DROP VIEW active_users;
          `),
        ).toEqual([])
      })
    })

    /**
     * A migration folder is a history, and most projects have no final-state
     * file to offer instead — getting one means standing up a database, which
     * is the thing this tool exists so you do not have to do.
     *
     * So the statements are applied in order rather than refused: not executed,
     * which would need a database, but replayed against the schema being built.
     * What cannot be applied is still named (see "unapplied changes") — the
     * report is the backstop now, not the whole answer.
     */
    describe('replaying changes', () => {
      const replay = async (sql: string) => {
        const { value, unparsed } = await processor(sql)
        return { schema: value, unapplied: unparsed.map((u) => u.raw) }
      }

      const users = /* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          goner TEXT
        );
      `

      it('adds a column to a table an earlier statement created', async () => {
        const { schema, unapplied } = await replay(`
          ${users}
          ALTER TABLE users ADD COLUMN nickname TEXT;
        `)

        expect(Object.keys(schema.tables['users']?.columns ?? {})).toContain(
          'nickname',
        )
        expect(unapplied).toEqual([])
      })

      it('drops a column', async () => {
        const { schema } = await replay(`
          ${users}
          ALTER TABLE users DROP COLUMN goner;
        `)

        expect(Object.keys(schema.tables['users']?.columns ?? {})).toEqual([
          'id',
          'email',
        ])
      })

      /**
       * Postgres drops whatever depends on the column, and an index over two
       * columns depends on both — it does not quietly become an index over the
       * one that is left. Getting this wrong leaves an index in the diagram
       * that the database does not have.
       */
      it('takes a multi-column index and constraint with the column they name', async () => {
        const { schema } = await replay(`
          CREATE TABLE words (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT,
            mastered BOOLEAN
          );
          CREATE INDEX ix_words_mastered ON words (user_id, mastered);
          CREATE INDEX ix_words_user ON words (user_id);
          ALTER TABLE words ADD CONSTRAINT words_user_mastered_key UNIQUE (user_id, mastered);
          ALTER TABLE words DROP COLUMN mastered;
        `)

        const table = schema.tables['words']
        expect(Object.keys(table?.indexes ?? {})).toEqual(['ix_words_user'])
        expect(Object.keys(table?.constraints ?? {})).toEqual(['words_pkey'])
      })

      /**
       * A CHECK depends on the column its expression names, and postgres drops
       * it with the column. It has no column list — the expression is all
       * there is — so a drop that only clears constraints by their columns
       * leaves a CHECK on a column that is gone.
       */
      it('takes a CHECK naming the column with it', async () => {
        const { schema } = await replay(`
          CREATE TABLE words (
            id BIGSERIAL PRIMARY KEY,
            priority SMALLINT CONSTRAINT priority_check CHECK (priority BETWEEN 1 AND 3),
            term TEXT CONSTRAINT term_check CHECK (char_length(term) <= 200)
          );
          ALTER TABLE words DROP COLUMN priority;
        `)

        expect(Object.keys(schema.tables['words']?.constraints ?? {})).toEqual([
          'words_pkey',
          'term_check',
        ])
      })

      /**
       * `priority` is not `priority_filter`. Matching the name anywhere in the
       * text would take the second CHECK down with the first.
       */
      it('keeps a CHECK on a column whose name merely starts the same', async () => {
        const { schema } = await replay(`
          CREATE TABLE quiz (
            id BIGSERIAL PRIMARY KEY,
            priority SMALLINT CONSTRAINT priority_check CHECK (priority > 0),
            priority_filter SMALLINT CONSTRAINT filter_check CHECK (priority_filter > 0)
          );
          ALTER TABLE quiz DROP COLUMN priority;
        `)

        expect(Object.keys(schema.tables['quiz']?.constraints ?? {})).toEqual([
          'quiz_pkey',
          'filter_check',
        ])
      })

      /** A column name inside a string literal is text, not a reference. */
      it('keeps a CHECK that only names the column inside a literal', async () => {
        const { schema } = await replay(`
          CREATE TABLE jobs (
            id BIGSERIAL PRIMARY KEY,
            priority SMALLINT,
            state TEXT CONSTRAINT state_check CHECK (state <> 'priority')
          );
          ALTER TABLE jobs DROP COLUMN priority;
        `)

        expect(Object.keys(schema.tables['jobs']?.constraints ?? {})).toEqual([
          'jobs_pkey',
          'state_check',
        ])
      })

      it('follows a renamed column into the indexes and constraints naming it', async () => {
        const { schema } = await replay(`
          ${users}
          CREATE INDEX ix_users_email ON users (email);
          ALTER TABLE users RENAME COLUMN email TO login;
        `)

        const table = schema.tables['users']
        expect(Object.keys(table?.columns ?? {})).toEqual([
          'id',
          'login',
          'goner',
        ])
        expect(table?.columns['login']?.name).toBe('login')
        expect(table?.indexes['ix_users_email']?.columns).toEqual(['login'])
        const unique = table?.constraints['users_email_key']
        expect(unique?.type).toBe('UNIQUE')
        expect(unique && 'columnNames' in unique && unique.columnNames).toEqual(
          ['login'],
        )
      })

      it('follows a renamed column into another table pointing at it', async () => {
        const { schema } = await replay(`
          ${users}
          CREATE TABLE posts (
            id BIGSERIAL PRIMARY KEY,
            author_id BIGINT REFERENCES users(id)
          );
          ALTER TABLE users RENAME COLUMN id TO user_id;
        `)

        const fk = Object.values(
          schema.tables['posts']?.constraints ?? {},
        ).find((c) => c.type === 'FOREIGN KEY')
        expect(fk && 'targetColumnNames' in fk && fk.targetColumnNames).toEqual(
          ['user_id'],
        )
      })

      it('follows a renamed table into another table pointing at it', async () => {
        const { schema } = await replay(`
          ${users}
          CREATE TABLE posts (
            id BIGSERIAL PRIMARY KEY,
            author_id BIGINT REFERENCES users(id)
          );
          ALTER TABLE users RENAME TO accounts;
        `)

        expect(Object.keys(schema.tables)).toEqual(['accounts', 'posts'])
        expect(schema.tables['accounts']?.name).toBe('accounts')

        const fk = Object.values(
          schema.tables['posts']?.constraints ?? {},
        ).find((c) => c.type === 'FOREIGN KEY')
        expect(fk && 'targetTableName' in fk && fk.targetTableName).toBe(
          'accounts',
        )
      })

      it('drops a table', async () => {
        const { schema } = await replay(`
          ${users}
          CREATE TABLE scratch (id BIGSERIAL PRIMARY KEY);
          DROP TABLE scratch;
        `)

        expect(Object.keys(schema.tables)).toEqual(['users'])
      })

      it('drops and renames an index', async () => {
        const { schema } = await replay(`
          ${users}
          CREATE INDEX ix_users_email ON users (email);
          CREATE INDEX ix_users_goner ON users (goner);
          ALTER INDEX ix_users_email RENAME TO ix_users_login;
          DROP INDEX ix_users_goner;
        `)

        expect(Object.keys(schema.tables['users']?.indexes ?? {})).toEqual([
          'ix_users_login',
        ])
        expect(schema.tables['users']?.indexes['ix_users_login']?.name).toBe(
          'ix_users_login',
        )
      })

      it('drops a constraint', async () => {
        const { schema } = await replay(`
          ${users}
          ALTER TABLE users DROP CONSTRAINT users_email_key;
        `)

        expect(
          Object.keys(schema.tables['users']?.constraints ?? {}),
        ).not.toContain('users_email_key')
      })

      it('changes a column type, its nullability and its default', async () => {
        const { schema } = await replay(`
          ${users}
          ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(320);
          ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
          ALTER TABLE users ALTER COLUMN goner SET NOT NULL;
          ALTER TABLE users ALTER COLUMN goner SET DEFAULT 'x';
        `)

        // `varchar`, not `varchar(320)`: the length goes the same way it does
        // in a CREATE TABLE, and a column has to mean the same thing however it
        // got its type.
        const columns = schema.tables['users']?.columns
        expect(columns?.['email']?.type).toBe('varchar')
        expect(columns?.['email']?.notNull).toBe(false)
        expect(columns?.['goner']?.notNull).toBe(true)
        expect(columns?.['goner']?.default).toBe('x')
      })

      it('adds a value to an enum', async () => {
        const { schema } = await replay(`
          CREATE TYPE mood AS ENUM ('ok');
          ALTER TYPE mood ADD VALUE 'sad';
        `)

        expect(schema.enums['mood']?.values).toEqual(['ok', 'sad'])
      })

      /** `IF EXISTS` is how a migration says "this may already be gone". */
      it('passes over an IF EXISTS drop of something that is not there', async () => {
        const { schema, unapplied } = await replay(`
          ${users}
          ALTER TABLE users DROP COLUMN IF EXISTS never_existed;
          DROP INDEX IF EXISTS ix_nothing;
          DROP TABLE IF EXISTS nothing;
        `)

        expect(Object.keys(schema.tables)).toEqual(['users'])
        expect(unapplied).toEqual([])
      })

      /**
       * The whole point, end to end: the schema a history leaves behind is the
       * schema its final state describes.
       */
      it('ends where the history left the database', async () => {
        const { schema, unapplied } = await replay(`
          CREATE TABLE words (id BIGSERIAL PRIMARY KEY, term TEXT);
          ALTER TABLE words ADD COLUMN mastered BOOLEAN NOT NULL DEFAULT FALSE;
          ALTER TABLE words ADD COLUMN priority SMALLINT;
          ALTER TABLE words DROP COLUMN IF EXISTS mastered;
          ALTER TABLE words RENAME COLUMN term TO headword;
        `)

        expect(Object.keys(schema.tables['words']?.columns ?? {})).toEqual([
          'id',
          'headword',
          'priority',
        ])
        expect(unapplied).toEqual([])
      })
    })

    /**
     * An array used to come back as its element type: `text[]` read as `text`.
     * Nothing downstream could catch it — the column count was right, and the
     * deparser has always been able to write the suffix back out — so the only
     * signal was reading the DDL by hand. Postgres carries the dimensions in
     * `arrayBounds` and nowhere else.
     */
    describe('array types', () => {
      const typesOf = async (columns: string) => {
        const { value } = await processor(/* sql */ `
          CREATE TABLE users (
            id BIGSERIAL PRIMARY KEY,
            ${columns}
          );
        `)

        return Object.fromEntries(
          Object.values(value.tables['users']?.columns ?? {}).map((column) => [
            column.name,
            column.type,
          ]),
        )
      }

      it('keeps the array suffix, one pair per dimension', async () => {
        expect(
          await typesOf(`
            available_locales TEXT[],
            grid INTEGER[][],
            plain TEXT
          `),
        ).toMatchObject({
          available_locales: 'text[]',
          grid: 'int4[][]',
          plain: 'text',
        })
      })

      it('keeps the suffix on a schema-qualified type', async () => {
        expect(await typesOf('roles public.user_status[]')).toMatchObject({
          roles: 'user_status[]',
        })
      })
    })

    it('unique', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          mention TEXT UNIQUE
        );
      `)

      expect(value).toEqual(
        userTable({
          columns: {
            mention: aColumn({
              name: 'mention',
              type: 'text',
            }),
          },
          constraints: {
            users_mention_key: {
              name: 'users_mention_key',
              type: 'UNIQUE',
              columnNames: ['mention'],
            },
          },
        }),
      )
    })

    it('index (unique: false)', async () => {
      const indexName = 'index_users_on_id_and_email'
      const { value } = await processor(/* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          email VARCHAR(255)
        );

        CREATE INDEX index_users_on_id_and_email ON public.users USING btree (id, email);
      `)

      expect(value).toEqual(
        parserTestCases['index (unique: false)'](indexName, 'btree'),
      )
    })

    it('index (unique: true)', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          email VARCHAR(255)
        );

        CREATE UNIQUE INDEX index_users_on_email ON public.users USING btree (email);
      `)

      expect(value).toEqual(parserTestCases['index (unique: true)']('btree'))
    })

    it('table-level primary key constraint with named constraint', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE bar (
          bar_id int,
          name text NOT NULL,
          CONSTRAINT bar_primary_key PRIMARY KEY (bar_id)
        );
      `)

      expect(value.tables['bar']?.constraints).toEqual({
        bar_primary_key: {
          name: 'bar_primary_key',
          type: 'PRIMARY KEY',
          columnNames: ['bar_id'],
        },
      })
    })

    it('table-level primary key constraint without named constraint', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE foo_bar (
          foo_id int,
          bar_id int,
          PRIMARY KEY (foo_id, bar_id)
        );
      `)

      expect(value.tables['foo_bar']?.constraints).toEqual({
        foo_bar_pkey: {
          name: 'foo_bar_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['foo_id', 'bar_id'],
        },
      })
    })

    it('table-level single column primary key constraint', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE baz (
          baz_id int,
          name text,
          PRIMARY KEY (baz_id)
        );
      `)

      expect(value.tables['baz']?.constraints).toEqual({
        baz_pkey: {
          name: 'baz_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['baz_id'],
        },
      })
    })

    it('foreign key constraint in CREATE TABLE', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE posts (
          id BIGSERIAL PRIMARY KEY,
          user_id INT,
          CONSTRAINT fk_posts_user_id FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `)

      expect(value.tables['posts']?.constraints).toEqual({
        posts_pkey: {
          name: 'posts_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['id'],
        },
        fk_posts_user_id: {
          name: 'fk_posts_user_id',
          type: 'FOREIGN KEY',
          columnNames: ['user_id'],
          targetTableName: 'users',
          targetColumnNames: ['id'],
          updateConstraint: 'NO_ACTION',
          deleteConstraint: 'NO_ACTION',
        },
      })
    })

    it('foreign key with omit key name', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE posts (
          id BIGSERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id)
        );
      `)

      // TODO: This test demonstrates the current behavior where we use defaultRelationshipName
      // instead of PostgreSQL's standard naming convention.
      //
      // Current behavior: 'users_id_to_posts_user_id' (using defaultRelationshipName)
      // Ideal behavior: 'posts_user_id_fkey' (PostgreSQL standard)
      //
      // PostgreSQL automatically generates constraint names in the format:
      // <table>_<column>_fkey when no explicit name is provided.
      //
      // We should consider migrating to PostgreSQL's standard naming convention
      // in a future major version to better reflect actual database behavior.
      expect(value.tables['posts']?.constraints).toEqual({
        posts_pkey: {
          name: 'posts_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['id'],
        },
        users_id_to_posts_user_id: {
          name: 'users_id_to_posts_user_id',
          type: 'FOREIGN KEY',
          columnNames: ['user_id'],
          targetColumnNames: ['id'],
          targetTableName: 'users',
          updateConstraint: 'NO_ACTION',
          deleteConstraint: 'NO_ACTION',
        },
      })
    })

    it('foreign key constraint (one-to-one)', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE posts (
          id BIGSERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) UNIQUE
        );
      `)

      expect(value.tables['posts']?.constraints).toEqual({
        posts_pkey: {
          name: 'posts_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['id'],
        },
        posts_user_id_key: {
          name: 'posts_user_id_key',
          type: 'UNIQUE',
          columnNames: ['user_id'],
        },
        users_id_to_posts_user_id: {
          name: 'users_id_to_posts_user_id',
          type: 'FOREIGN KEY',
          columnNames: ['user_id'],
          targetColumnNames: ['id'],
          targetTableName: 'users',
          updateConstraint: 'NO_ACTION',
          deleteConstraint: 'NO_ACTION',
        },
      })
    })

    it('check constraint (anonymous)', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE products (
            id SERIAL PRIMARY KEY,
            name text,
            price numeric CHECK (price > 0)
        );
      `)

      expect(value.tables['products']?.constraints).toEqual({
        products_pkey: {
          name: 'products_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['id'],
        },
        price_check: {
          name: 'price_check',
          type: 'CHECK',
          detail: 'price > 0',
        },
      })
    })

    it('check constraint (table-level)', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE "design_sessions" (
            "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
            "project_id" "uuid",
            "organization_id" "uuid" NOT NULL,
            CONSTRAINT "design_sessions_project_or_org_check" CHECK ((("project_id" IS NOT NULL) OR ("organization_id" IS NOT NULL)))
        );
      `)

      expect(value.tables['design_sessions']?.constraints).toEqual({
        design_sessions_project_or_org_check: {
          name: 'design_sessions_project_or_org_check',
          type: 'CHECK',
          detail:
            '(("project_id" IS NOT NULL) OR ("organization_id" IS NOT NULL))',
        },
      })
    })

    it('check constraint (multiple conditions)', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE employees (
            id SERIAL PRIMARY KEY,
            age INT CHECK (age >= 18 AND age <= 120),
            salary NUMERIC CHECK (salary > 0)
        );
      `)

      expect(value.tables['employees']?.constraints).toEqual({
        employees_pkey: {
          name: 'employees_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['id'],
        },
        age_check: {
          name: 'age_check',
          type: 'CHECK',
          detail: 'age >= 18 AND age <= 120',
        },
        salary_check: {
          name: 'salary_check',
          type: 'CHECK',
          detail: 'salary > 0',
        },
      })
    })

    it('parses CHECK constraints when multibyte characters precede the constraint', async () => {
      // eslint-disable-next-line no-non-english/no-non-english-characters
      const sampleSql = /* sql */ `
        COMMENT ON TABLE "public"."homes" IS '標準 public schema';

        CREATE TABLE "public"."home_members" (
          "id" uuid,
          "role" text NOT NULL,
          "メモ" text,
          CONSTRAINT "home_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::text, 'member'::text])))
        );

        CREATE TABLE "public"."user_auth_providers" (
          "id" uuid,
          "provider" text NOT NULL,
          "表示名" text,
          CONSTRAINT "user_auth_providers_provider_check" CHECK ((("provider")::text = ANY (ARRAY[('apple'::character varying)::text, ('google'::character varying)::text, ('anonymous'::character varying)::text])))
        );
      `

      const { value, errors } = await processor(sampleSql)

      expect(errors).toEqual([])
      const homeMembersCheck =
        value.tables['home_members']?.constraints?.['home_members_role_check']
      const authProvidersCheck =
        value.tables['user_auth_providers']?.constraints?.[
          'user_auth_providers_provider_check'
        ]

      expect(homeMembersCheck?.type).toBe('CHECK')
      expect(authProvidersCheck?.type).toBe('CHECK')

      if (homeMembersCheck?.type === 'CHECK') {
        expect(homeMembersCheck.detail).toMatchInlineSnapshot(
          `"("role" = ANY (ARRAY['owner'::text, 'member'::text]))"`,
        )
      }
      if (authProvidersCheck?.type === 'CHECK') {
        expect(authProvidersCheck.detail).toMatchInlineSnapshot(
          `"(("provider")::text = ANY (ARRAY[('apple'::character varying)::text, ('google'::character varying)::text, ('anonymous'::character varying)::text]))"`,
        )
      }
    })

    it('table-level unique constraint', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE user_roles (
          user_id INT NOT NULL,
          role_id INT NOT NULL,
          CONSTRAINT unique_user_role UNIQUE (user_id, role_id)
        );
      `)

      expect(value.tables['user_roles']?.constraints).toEqual({
        unique_user_role: {
          name: 'unique_user_role',
          type: 'UNIQUE',
          columnNames: ['user_id', 'role_id'],
        },
      })
    })
  })

  describe('should parse ALTER TABLE statement correctly', () => {
    it('foreign key constraint (one-to-many)', async () => {
      const keyName = 'fk_posts_user_id'
      const { value } = await processor(/* sql */ `
        CREATE TABLE posts (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL
        );

        ALTER TABLE posts
        ADD CONSTRAINT ${keyName} FOREIGN KEY (user_id) REFERENCES users(id);
      `)

      expect(value.tables['posts']?.constraints).toEqual({
        posts_pkey: {
          name: 'posts_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['id'],
        },
        fk_posts_user_id: {
          name: 'fk_posts_user_id',
          type: 'FOREIGN KEY',
          columnNames: ['user_id'],
          targetTableName: 'users',
          targetColumnNames: ['id'],
          updateConstraint: 'NO_ACTION',
          deleteConstraint: 'NO_ACTION',
        },
      })
    })

    it('foreign key constraint (one-to-one)', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE posts (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL UNIQUE
        );

        ALTER TABLE posts
        ADD CONSTRAINT users_id_to_posts_user_id FOREIGN KEY (user_id) REFERENCES users(id);
      `)

      expect(value.tables['posts']?.constraints).toEqual({
        posts_pkey: {
          name: 'posts_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['id'],
        },
        posts_user_id_key: {
          name: 'posts_user_id_key',
          type: 'UNIQUE',
          columnNames: ['user_id'],
        },
        users_id_to_posts_user_id: {
          name: 'users_id_to_posts_user_id',
          type: 'FOREIGN KEY',
          columnNames: ['user_id'],
          targetTableName: 'users',
          targetColumnNames: ['id'],
          updateConstraint: 'NO_ACTION',
          deleteConstraint: 'NO_ACTION',
        },
      })
    })

    it('foreign key with action', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE posts (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL
        );

        ALTER TABLE posts
        ADD CONSTRAINT fk_posts_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE CASCADE;
      `)

      expect(value.tables['posts']?.constraints).toEqual({
        posts_pkey: {
          name: 'posts_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['id'],
        },
        fk_posts_user_id: {
          name: 'fk_posts_user_id',
          type: 'FOREIGN KEY',
          columnNames: ['user_id'],
          targetTableName: 'users',
          targetColumnNames: ['id'],
          updateConstraint: 'RESTRICT',
          deleteConstraint: 'CASCADE',
        },
      })
    })

    it('check constraint', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TABLE products (
            id SERIAL PRIMARY KEY,
            name text,
            price numeric
        );

        ALTER TABLE products
        ADD CONSTRAINT price_check_is_positive CHECK (price > 0);
      `)

      expect(value.tables['products']?.constraints).toEqual({
        products_pkey: {
          name: 'products_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['id'],
        },
        price_check_is_positive: {
          name: 'price_check_is_positive',
          type: 'CHECK',
          detail: 'price > 0',
        },
      })
    })
  })

  describe('abnormal cases', () => {
    /**
     * Named rather than fatal. The reader works a statement at a time, so a
     * broken one is known exactly and costs only itself — the rest of the file
     * still draws. `--strict` is where that becomes a refusal, which is the
     * same bargain every other unrepresentable thing gets.
     */
    it('names a statement it cannot parse instead of failing the file', async () => {
      const { value, errors, unparsed } = await processor(/* sql */ `
        CREATEe TABLE posts ();
        CREATE TABLE users (id BIGSERIAL PRIMARY KEY);
      `)

      expect(Object.keys(value.tables)).toEqual(['users'])
      expect(errors).toEqual([])
      expect(unparsed).toEqual([
        { clause: 'STATEMENT', raw: 'CREATEe TABLE posts ();' },
      ])
    })

    it('should ignore \\restrict and \\unrestrict lines from PostgreSQL 16.10+', async () => {
      const { value, errors } = await processor(/* sql */ `--
-- PostgreSQL database dump
--

\\restrict GNe5kMfiI0ANWitVE3BZ0HVlF41EznPoORQML2l8w8Tg2gLdbf9IxWY2UPYdYuN

SET statement_timeout = 0;
SET lock_timeout = 0;

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

CREATE TYPE status AS ENUM ('active', 'inactive');

\\unrestrict GNe5kMfiI0ANWitVE3BZ0HVlF41EznPoORQML2l8w8Tg2gLdbf9IxWY2UPYdYuN`)

      expect(errors).toEqual([])
      expect(value.tables['users']).toBeDefined()
      expect(value.tables['users']?.columns['id']).toBeDefined()
      expect(value.tables['users']?.columns['name']).toBeDefined()
      expect(value.enums['status']).toBeDefined()
      expect(value.enums['status']?.values).toEqual(['active', 'inactive'])
    })
  })

  describe('Long "create table" statement (surpassing CHUNK_SIZE). regression test for liam-hq/liam#874', () => {
    // Use smaller chunkSize for faster testing
    const testChunkSize = 10

    it('parses without errors', async () => {
      const linePaddingForTest = '\n'.repeat(testChunkSize)
      const { value, errors } = await processor(
        /* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL
          ${linePaddingForTest}
        );
      `,
        testChunkSize,
      )

      expect(value).toEqual(parserTestCases.normal)
      expect(errors).toEqual([])
    })
  })

  describe('Long "create function" statement (surpassing CHUNK_SIZE). regression test for liam-hq/liam#874', () => {
    // Use smaller chunkSize for faster testing
    const testChunkSize = 10

    it('parses without errors', async () => {
      const linePaddingForTest = '\n'.repeat(testChunkSize)
      const { value, errors } = await processor(
        /* sql */ `
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL
        );

        CREATE OR REPLACE FUNCTION test_proc(p_id integer)
        RETURNS void AS $$
        BEGIN
            RAISE NOTICE 'Stored procedure called with parameter: %', p_id;
            ${linePaddingForTest}
        END;
        $$ LANGUAGE plpgsql;
      `,
        testChunkSize,
      )
      expect(value).toEqual(parserTestCases.normal)
      expect(errors).toEqual([])
    })
  })

  describe('Composite foreign keys', () => {
    it('should parse composite foreign key constraints', async () => {
      const { value } = await processor(/* sql */ `
        -- Create tables with composite primary keys
        CREATE TABLE regions (
          country_code VARCHAR(2),
          region_code VARCHAR(10),
          region_name VARCHAR(100),
          PRIMARY KEY (country_code, region_code)
        );

        CREATE TABLE stores (
          store_id SERIAL PRIMARY KEY,
          country_code VARCHAR(2),
          region_code VARCHAR(10),
          store_name VARCHAR(100),
          CONSTRAINT fk_store_region FOREIGN KEY (country_code, region_code) 
            REFERENCES regions(country_code, region_code) ON DELETE CASCADE
        );

        CREATE TABLE store_employees (
          employee_id SERIAL PRIMARY KEY,
          country_code VARCHAR(2),
          region_code VARCHAR(10),
          employee_name VARCHAR(100),
          hire_date DATE
        );

        -- Add composite foreign key using ALTER TABLE
        ALTER TABLE store_employees
          ADD CONSTRAINT fk_employee_region 
          FOREIGN KEY (country_code, region_code) 
          REFERENCES regions(country_code, region_code);
      `)

      // Expected: Composite foreign keys should include all columns
      expect(value.tables['regions']?.constraints).toEqual({
        regions_pkey: {
          name: 'regions_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['country_code', 'region_code'],
        },
      })

      // Currently this will fail because foreign keys only support single columns
      // The expected behavior would be:
      expect(value.tables['stores']?.constraints).toEqual({
        stores_pkey: {
          name: 'stores_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['store_id'],
        },
        fk_store_region: {
          name: 'fk_store_region',
          type: 'FOREIGN KEY',
          columnNames: ['country_code', 'region_code'], // Should be array
          targetTableName: 'regions',
          targetColumnNames: ['country_code', 'region_code'], // Should be array
          updateConstraint: 'NO_ACTION',
          deleteConstraint: 'CASCADE',
        },
      })

      expect(value.tables['store_employees']?.constraints).toEqual({
        store_employees_pkey: {
          name: 'store_employees_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['employee_id'],
        },
        fk_employee_region: {
          name: 'fk_employee_region',
          type: 'FOREIGN KEY',
          columnNames: ['country_code', 'region_code'], // Should be array
          targetTableName: 'regions',
          targetColumnNames: ['country_code', 'region_code'], // Should be array
          updateConstraint: 'NO_ACTION',
          deleteConstraint: 'NO_ACTION',
        },
      })
    })

    it('should handle composite foreign keys with mixed constraints', async () => {
      const { value } = await processor(/* sql */ `
        -- Time-series data with composite keys
        CREATE TABLE metrics (
          metric_type VARCHAR(50),
          timestamp TIMESTAMPTZ,
          value NUMERIC,
          PRIMARY KEY (metric_type, timestamp)
        );

        CREATE TABLE metric_aggregations (
          agg_id SERIAL PRIMARY KEY,
          metric_type VARCHAR(50),
          timestamp TIMESTAMPTZ,
          hour_avg NUMERIC,
          UNIQUE (metric_type, timestamp),
          CONSTRAINT fk_metric_agg 
            FOREIGN KEY (metric_type, timestamp) 
            REFERENCES metrics(metric_type, timestamp) ON UPDATE CASCADE ON DELETE CASCADE
        );
      `)

      expect(value.tables['metric_aggregations']?.constraints).toEqual({
        metric_aggregations_pkey: {
          name: 'metric_aggregations_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['agg_id'],
        },
        metric_aggregations_metric_type_timestamp_key: {
          name: 'metric_aggregations_metric_type_timestamp_key',
          type: 'UNIQUE',
          columnNames: ['metric_type', 'timestamp'],
        },
        fk_metric_agg: {
          name: 'fk_metric_agg',
          type: 'FOREIGN KEY',
          columnNames: ['metric_type', 'timestamp'], // Should be array
          targetTableName: 'metrics',
          targetColumnNames: ['metric_type', 'timestamp'], // Should be array
          updateConstraint: 'CASCADE',
          deleteConstraint: 'CASCADE',
        },
      })
    })
  })

  describe('Schema-qualified table names with foreign keys', () => {
    it('should parse foreign key constraints with schema-qualified table names', async () => {
      const { value } = await processor(/* sql */ `
        -- Create schemas
        CREATE SCHEMA auth;
        CREATE SCHEMA analytics;
        CREATE SCHEMA ecommerce;

        -- Create tables in different schemas
        CREATE TABLE auth.users (
          user_id uuid PRIMARY KEY,
          email varchar(255) NOT NULL
        );

        CREATE TABLE analytics.page_views (
          view_id bigint PRIMARY KEY,
          user_id uuid,
          page_url text NOT NULL
        );

        CREATE TABLE ecommerce.products (
          product_id uuid PRIMARY KEY,
          product_name varchar(255) NOT NULL,
          created_by uuid
        );

        -- Add foreign key constraints with schema-qualified references (using ONLY keyword like pg_dump)
        ALTER TABLE ONLY analytics.page_views
          ADD CONSTRAINT fk_page_view_user 
          FOREIGN KEY (user_id) REFERENCES auth.users(user_id) ON DELETE SET NULL;

        ALTER TABLE ONLY ecommerce.products
          ADD CONSTRAINT fk_product_creator 
          FOREIGN KEY (created_by) REFERENCES auth.users(user_id) ON DELETE SET NULL;
      `)

      // Expected: Both foreign key constraints should be parsed correctly
      expect(value.tables['page_views']?.constraints).toEqual({
        page_views_pkey: {
          name: 'page_views_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['view_id'],
        },
        fk_page_view_user: {
          name: 'fk_page_view_user',
          type: 'FOREIGN KEY',
          columnNames: ['user_id'],
          targetTableName: 'users',
          targetColumnNames: ['user_id'],
          updateConstraint: 'NO_ACTION',
          deleteConstraint: 'SET_NULL',
        },
      })

      expect(value.tables['products']?.constraints).toEqual({
        products_pkey: {
          name: 'products_pkey',
          type: 'PRIMARY KEY',
          columnNames: ['product_id'],
        },
        fk_product_creator: {
          name: 'fk_product_creator',
          type: 'FOREIGN KEY',
          columnNames: ['created_by'],
          targetTableName: 'users',
          targetColumnNames: ['user_id'],
          updateConstraint: 'NO_ACTION',
          deleteConstraint: 'SET_NULL',
        },
      })

      // Verify all tables are present
      expect(Object.keys(value.tables)).toContain('users')
      expect(Object.keys(value.tables)).toContain('page_views')
      expect(Object.keys(value.tables)).toContain('products')
    })

    it('should handle multiple schema-qualified foreign key constraints', async () => {
      const { value } = await processor(/* sql */ `
        CREATE SCHEMA ecommerce;
        CREATE SCHEMA analytics;

        CREATE TABLE ecommerce.customers (
          customer_id uuid PRIMARY KEY,
          email varchar(255) NOT NULL
        );

        CREATE TABLE ecommerce.orders (
          order_id uuid PRIMARY KEY,
          customer_id uuid NOT NULL,
          total_amount decimal(10,2) NOT NULL
        );

        CREATE TABLE ecommerce.order_items (
          order_item_id uuid PRIMARY KEY,
          order_id uuid NOT NULL,
          product_id uuid NOT NULL,
          quantity integer NOT NULL
        );

        CREATE TABLE ecommerce.products (
          product_id uuid PRIMARY KEY,
          product_name varchar(255) NOT NULL
        );

        -- Add multiple foreign key constraints
        ALTER TABLE ecommerce.orders
          ADD CONSTRAINT fk_order_customer 
          FOREIGN KEY (customer_id) REFERENCES ecommerce.customers(customer_id);

        ALTER TABLE ecommerce.order_items
          ADD CONSTRAINT fk_order_item_order 
          FOREIGN KEY (order_id) REFERENCES ecommerce.orders(order_id) ON DELETE CASCADE;

        ALTER TABLE ecommerce.order_items
          ADD CONSTRAINT fk_order_item_product 
          FOREIGN KEY (product_id) REFERENCES ecommerce.products(product_id);
      `)

      // Expected: All foreign key constraints should be parsed correctly
      expect(value.tables['orders']?.constraints).toEqual(
        expect.objectContaining({
          fk_order_customer: {
            name: 'fk_order_customer',
            type: 'FOREIGN KEY',
            columnNames: ['customer_id'],
            targetTableName: 'customers',
            targetColumnNames: ['customer_id'],
            updateConstraint: 'NO_ACTION',
            deleteConstraint: 'NO_ACTION',
          },
        }),
      )

      expect(value.tables['order_items']?.constraints).toEqual(
        expect.objectContaining({
          fk_order_item_order: {
            name: 'fk_order_item_order',
            type: 'FOREIGN KEY',
            columnNames: ['order_id'],
            targetTableName: 'orders',
            targetColumnNames: ['order_id'],
            updateConstraint: 'NO_ACTION',
            deleteConstraint: 'CASCADE',
          },
          fk_order_item_product: {
            name: 'fk_order_item_product',
            type: 'FOREIGN KEY',
            columnNames: ['product_id'],
            targetTableName: 'products',
            targetColumnNames: ['product_id'],
            updateConstraint: 'NO_ACTION',
            deleteConstraint: 'NO_ACTION',
          },
        }),
      )
    })

    it('should parse complex dump with multiple foreign key constraints', async () => {
      const { value } = await processor(/* sql */ `
        -- Simulated complex dump with multiple foreign key constraints
        CREATE SCHEMA analytics;
        CREATE SCHEMA auth;
        CREATE SCHEMA ecommerce;

        CREATE TABLE auth.users (user_id uuid PRIMARY KEY);
        CREATE TABLE auth.roles (role_id int PRIMARY KEY);
        CREATE TABLE auth.user_roles (user_id uuid, role_id int, PRIMARY KEY (user_id, role_id));
        
        CREATE TABLE analytics.page_views (view_id bigint PRIMARY KEY, user_id uuid);
        
        CREATE TABLE ecommerce.customers (customer_id uuid PRIMARY KEY, user_id uuid);
        CREATE TABLE ecommerce.products (product_id uuid PRIMARY KEY, created_by uuid);
        CREATE TABLE ecommerce.orders (order_id uuid PRIMARY KEY, customer_id uuid);
        CREATE TABLE ecommerce.order_items (order_item_id uuid PRIMARY KEY, order_id uuid, product_id uuid);

        -- Foreign key constraints
        ALTER TABLE ONLY analytics.page_views ADD CONSTRAINT fk_page_view_user FOREIGN KEY (user_id) REFERENCES auth.users(user_id) ON DELETE SET NULL;
        ALTER TABLE ONLY auth.user_roles ADD CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES auth.users(user_id) ON DELETE CASCADE;
        ALTER TABLE ONLY auth.user_roles ADD CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES auth.roles(role_id) ON DELETE CASCADE;
        ALTER TABLE ONLY ecommerce.customers ADD CONSTRAINT fk_customer_user FOREIGN KEY (user_id) REFERENCES auth.users(user_id) ON DELETE SET NULL;
        ALTER TABLE ONLY ecommerce.products ADD CONSTRAINT fk_product_creator FOREIGN KEY (created_by) REFERENCES auth.users(user_id) ON DELETE SET NULL;
        ALTER TABLE ONLY ecommerce.orders ADD CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES ecommerce.customers(customer_id);
        ALTER TABLE ONLY ecommerce.order_items ADD CONSTRAINT fk_order_item_order FOREIGN KEY (order_id) REFERENCES ecommerce.orders(order_id) ON DELETE CASCADE;
        ALTER TABLE ONLY ecommerce.order_items ADD CONSTRAINT fk_order_item_product FOREIGN KEY (product_id) REFERENCES ecommerce.products(product_id);
      `)

      // Count total foreign key constraints across all tables
      const totalForeignKeys = Object.values(value.tables).reduce(
        (count, table) => {
          const foreignKeys = Object.values(table.constraints || {}).filter(
            (constraint) => constraint.type === 'FOREIGN KEY',
          )
          return count + foreignKeys.length
        },
        0,
      )

      // Should parse all 8 foreign key constraints
      expect(totalForeignKeys).toBe(8)
    })
  })

  describe('CREATE TYPE AS ENUM statement', () => {
    it('should parse basic enum type', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TYPE status AS ENUM ('active', 'inactive', 'pending');
      `)

      expect(value.enums).toEqual({
        status: {
          name: 'status',
          values: ['active', 'inactive', 'pending'],
          comment: null,
        },
      })
    })

    it('should parse enum with comment', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TYPE user_status AS ENUM ('new', 'verified', 'suspended');
        COMMENT ON TYPE user_status IS 'Possible user account statuses';
      `)

      expect(value.enums).toEqual({
        user_status: {
          name: 'user_status',
          values: ['new', 'verified', 'suspended'],
          comment: 'Possible user account statuses',
        },
      })
    })

    it('should parse multiple enum types', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TYPE priority AS ENUM ('low', 'medium', 'high', 'urgent');
        CREATE TYPE category AS ENUM ('bug', 'feature', 'improvement');
        COMMENT ON TYPE priority IS 'Task priority levels';
      `)

      expect(value.enums).toEqual({
        priority: {
          name: 'priority',
          values: ['low', 'medium', 'high', 'urgent'],
          comment: 'Task priority levels',
        },
        category: {
          name: 'category',
          values: ['bug', 'feature', 'improvement'],
          comment: null,
        },
      })
    })

    it('should handle empty enum creation', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TYPE empty_enum AS ENUM ();
      `)

      // Empty enums should still be included (PostgreSQL allows empty enums)
      expect(value.enums).toEqual({
        empty_enum: {
          name: 'empty_enum',
          values: [],
          comment: null,
        },
      })
    })

    it('should correctly parse schema-qualified enum types in column definitions', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TYPE public.user_status AS ENUM ('active', 'inactive', 'pending');

        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          status public.user_status NOT NULL,
          name TEXT NOT NULL
        );
      `)

      // The enum definition should strip the schema prefix and use only the type name
      expect(value.enums).toEqual({
        user_status: {
          name: 'user_status',
          values: ['active', 'inactive', 'pending'],
          comment: null,
        },
      })

      // Column type should strip the schema prefix and use only the type name
      expect(value.tables['users']?.columns['status']?.type).toBe('user_status')
    })

    it('should handle quoted schema-qualified enum types', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TYPE "public"."user_status" AS ENUM ('active', 'inactive', 'pending');

        CREATE TABLE IF NOT EXISTS "public"."users" (
          "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
          "status" "public"."user_status" DEFAULT 'active'::"public"."user_status" NOT NULL,
          "name" TEXT NOT NULL
        );
      `)

      // The enum definition should strip the schema prefix and use only the type name
      expect(value.enums).toEqual({
        user_status: {
          name: 'user_status',
          values: ['active', 'inactive', 'pending'],
          comment: null,
        },
      })

      // Column type should strip the schema prefix and use only the type name even when quoted
      expect(value.tables['users']?.columns['status']?.type).toBe('user_status')
    })

    it('should handle COMMENT ON TYPE with schema-qualified enum (unquoted)', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high');
        COMMENT ON TYPE public.priority_level IS 'Task priority levels';

        CREATE TABLE tasks (
          id BIGSERIAL PRIMARY KEY,
          priority public.priority_level NOT NULL
        );
      `)

      // The enum should have the comment attached
      expect(value.enums).toEqual({
        priority_level: {
          name: 'priority_level',
          values: ['low', 'medium', 'high'],
          comment: 'Task priority levels',
        },
      })

      // Column type should strip the schema prefix
      expect(value.tables['tasks']?.columns['priority']?.type).toBe(
        'priority_level',
      )
    })

    it('should handle COMMENT ON TYPE with schema-qualified enum (quoted)', async () => {
      const { value } = await processor(/* sql */ `
        CREATE TYPE "public"."TaskStatus" AS ENUM ('todo', 'in_progress', 'done');
        COMMENT ON TYPE "public"."TaskStatus" IS 'Available task statuses';

        CREATE TABLE projects (
          id uuid PRIMARY KEY,
          status "public"."TaskStatus" DEFAULT 'todo'
        );
      `)

      // The enum should have the comment attached despite quoted schema qualification
      expect(value.enums).toEqual({
        TaskStatus: {
          name: 'TaskStatus',
          values: ['todo', 'in_progress', 'done'],
          comment: 'Available task statuses',
        },
      })

      // Column type should strip the schema prefix
      expect(value.tables['projects']?.columns['status']?.type).toBe(
        'TaskStatus',
      )
    })
  })

  describe('CREATE EXTENSION statement', () => {
    it('should parse basic extension creation', async () => {
      const { value } = await processor(/* sql */ `
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      `)

      expect(value.extensions).toEqual({
        'uuid-ossp': {
          name: 'uuid-ossp',
        },
      })
    })

    it('should parse multiple extensions', async () => {
      const { value } = await processor(/* sql */ `
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE EXTENSION vector;
        CREATE EXTENSION postgis;
      `)

      expect(value.extensions).toEqual({
        'uuid-ossp': {
          name: 'uuid-ossp',
        },
        vector: {
          name: 'vector',
        },
        postgis: {
          name: 'postgis',
        },
      })
    })

    it('should handle extensions with tables and other objects', async () => {
      const { value } = await processor(/* sql */ `
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL
        );

        CREATE EXTENSION vector;
      `)

      expect(value.extensions).toEqual({
        'uuid-ossp': {
          name: 'uuid-ossp',
        },
        vector: {
          name: 'vector',
        },
      })

      expect(value.tables).toEqual({
        users: expect.objectContaining({
          name: 'users',
          columns: expect.objectContaining({
            id: expect.objectContaining({ type: 'uuid' }),
            name: expect.objectContaining({ type: 'varchar' }),
          }),
        }),
      })
    })
  })
})
