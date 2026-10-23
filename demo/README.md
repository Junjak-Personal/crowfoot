# demo

The sidecar files behind **<https://crowfoot.jun-devlog.win>**.

`layout.json`, `groups.json` and `memos.json` are committed *and* generated:
`build-demo.mjs` produces them, and the committed copies are the demo itself.
Keeping both means a lost server does not cost an afternoon of arranging 23 tables
by hand.

## The schema

The legacy build of **nivoca**, a Japanese vocabulary app — Next.js + Supabase,
shipped as a PWA, since rebuilt on Flutter with a Kotlin/Spring backend. That earlier
codebase is public at
[Junjak-Personal/nivoca-legacy](https://github.com/Junjak-Personal/nivoca-legacy).

The input is `schema.sql`, a `pg_dump --schema-only` of the final state:

```bash
npx crowfoot erd build --input demo/schema.sql --format postgres --output-dir dist
```

23 tables, 29 foreign keys, 225 columns, 31 indexes, 1 enum, 2 extensions, and
`unparsed` empty. `--json --strict` reports all of it and fails on anything read
and not represented.

### The migrations are the cross-check

`migrations/` holds the 37 Supabase migrations `schema.sql` was derived from,
vendored since 0.7.1 so the demo can be rebuilt from this repository alone. Since
0.9.0 they also build on their own — statements are replayed in order — which
makes the pair the sharpest test this repository has of that replay:

> Two inputs describing the same database must produce the same `schema.json`.

```bash
npx crowfoot erd build --input 'demo/migrations/*.sql' --format postgres --output-dir a
npx crowfoot erd build --input demo/schema.sql          --format postgres --output-dir b
# a/schema.json and b/schema.json should agree
```

They agree on tables, columns and indexes exactly. Add `--strict` and the migrations
exit 1 while the dump exits 0: since 1.0.1 a `DO $$ … $$` block whose body looks like
it holds DDL is named in `unparsed` instead of being skipped in silence, and there
are 4 of them. That is the check working — the 4 are exactly the first row below.
(The migrations hold 7 `DO` blocks; the other 3 only move data around and stay quiet.)

What differs:

| | |
|---|---|
| `feedback_survey` primary key, 3 CHECK constraints, the `kanji_reading_type` enum | Created inside `DO $$ … $$` blocks (`020`, `037`). A `DO` body reaches the parser as one string — the one gap replay does not close, now at least a reported one. |
| Foreign key and CHECK constraint **names** | An inline `REFERENCES` has no name, so one is synthesised; pg_dump writes the name postgres gave it. Same constraints, different labels. |
| CHECK constraint **text** | `role in ('user', …)` as written, against `(role = ANY (ARRAY['user'::text, …]))` as postgres normalises it. |

None of that is a replay bug. Twice now it has found one, though, and both times
no unit test had noticed:

- **0.9.0** — `DROP COLUMN` was narrowing a two-column index to one column
  instead of dropping it.
- **1.0.2** — `DROP COLUMN` was leaving behind a CHECK over the column it
  dropped. `words.priority_check` outlived `words.priority` by 4 migrations.

Both are the same mistake in different clothes: postgres drops everything that
depends on the column, and the replay was only clearing what listed it by name.

The migrations carry no credentials: what looks like one is a column name
(`encrypted_api_key`, since dropped), a comment describing how to create a vault
secret, or a lookup by name. They do name the deprecated project's Supabase URL,
which is public in the legacy repository too.

### Regenerating `schema.sql`

The live Supabase project is deprecated, so the dump is taken from a throwaway
local Postgres instead. `supabase-stub.sql` is the minimum of Supabase — the
`auth`, `storage`, `vault`, `cron` and `net` objects the migrations reference —
needed to make them apply; none of it reaches the dump, which takes `public` only.

```bash
initdb -U postgres "$PGDATA" && pg_ctl -D "$PGDATA" -o '-p 5459' start
psql -p 5459 -U postgres -c 'CREATE DATABASE nivoca'
psql -p 5459 -U postgres -c 'CREATE ROLE authenticated'
psql -p 5459 -U postgres -d nivoca -v ON_ERROR_STOP=1 -f demo/supabase-stub.sql

for f in $(ls demo/migrations/*.sql | sort -V); do
  # pg_cron and pg_net have no binaries locally; supabase-stub.sql fakes their objects
  sed -E 's/^[[:space:]]*CREATE EXTENSION[^;]*pg_(cron|net)[^;]*;/-- &/I' "$f" |
    psql -p 5459 -U postgres -d nivoca -v ON_ERROR_STOP=1 || break
done

pg_dump -p 5459 -U postgres -d nivoca \
  --schema-only --no-owner --no-privileges --schema=public > demo/schema.sql
```

Then put the two `CREATE EXTENSION` lines back by hand, under the
`COMMENT ON SCHEMA public` line. The live database has `pg_cron` and `pg_net`
enabled; the local one has neither binary, so a dump of it would say the schema
has no extensions when it has two.

## Rebuilding

```bash
node demo/build-demo.mjs dist/schema.json demo   # regenerate the three files
cp demo/{layout,groups,memos}.json dist/         # the viewer fetches them at runtime
```

Serve `dist/` over HTTP — any static host will do. `file://` will not work.

Edit the groups in `build-demo.mjs` rather than the JSON: positions are computed from
group membership, so adding a table to a group is a one-line change and re-run.

## Deploying

Build it, refuse it if it is wrong, then copy it:

```bash
npx crowfoot erd build --input demo/schema.sql --format postgres \
  --output-dir dist --json --strict
cp demo/{layout,groups,memos}.json dist/
npx crowfoot erd arrange --input dist/schema.json --check --output-dir dist
rsync -a --delete dist/ <the directory nginx serves>/
```

`--strict` fails on a clause the parser read and could not represent, and `--check`
fails on two group boxes crossing. Both are worth having in front of a copy: the
demo is the one diagram everybody sees, and neither failure looks like a failure —
the diagram still renders, it just renders wrong.

Wrapping those four lines in a script is the obvious next step, and that script does
not belong here. It has to know the hostname, the path and the account, which are the
things this file deliberately does not say — `_workspace/` is gitignored and is where
it lives. Nothing is wired to the release workflow either: that workflow's defining
property is that it holds no credentials, npm being reached over OIDC, and a deploy
needs a way into a host.

Take a copy of what is there first. The site is an nginx container with two bind
mounts from the host: the directory it serves, and nginx's own `default.conf`. Both
used to live inside the container and nowhere else — one `docker rm` from taking the
site and its server config with it.

The rest of this section is the three ways the copy goes wrong.

**Replace the contents, never the directory.** A bind mount resolves to the inode, so
`mv site site.old && mv site.new site` leaves the container serving the directory you
just renamed — with no error, and the old page still answering. Copy into the
directory that is already mounted.

`rsync -a --delete` is the obvious way to do it. If the host has no rsync, upload a
tarball, unpack it somewhere else, and copy it in — but then nothing deletes, which
is the second one:

**Make the staged copy world-readable before sending it.** `rsync -a` carries the
local modes across, and a build staged in a `mktemp -d` is `0700`. That mode lands on
the served directory, where nginx — a different uid inside the container — can no
longer traverse it, and the site answers `403` with every file present, correct and
newly dated. `chmod -R a+rX` on the staging directory first. (`--chmod=D755,F644`
says the same thing at the copy, and macOS ships an rsync that does not have it.)

**Empty `assets/` before copying, and only `assets/`.** Its filenames are
content-hashed, so a copy leaves the previous build's bundle sitting beside the new
one — megabytes a deploy, forever. Everything else in the directory has a stable name
and is simply overwritten, and `schema.json` and the three sidecar files are not the
build's to remove. (`erd build` does this itself; a copy-based deploy has to.)

## Two things that will bite

**Group boxes are derived from member bounds, plus the app's own padding.** Space
groups further apart than that padding or neighbouring boxes visibly overlap. The gap
in the script was arrived at by rendering it and looking, not by deriving it.

**A memo clips whatever does not fit, silently.** `overflow` is `hidden`, so a card
one line too short simply loses its last line, and `scrollHeight` reports the clipped
height rather than the real one — measuring the element in place says everything fits
even when it doesn't. Measure a clone at `height: auto` instead.

All three are easy to miss because the diagram still *renders* — it just renders
wrong. Checking the rendered geometry beats reading the JSON:

```js
// in the browser console on the demo
[...document.querySelectorAll('.react-flow__node-tableGroup')]
  .map((n) => (n.firstElementChild ?? n).getBoundingClientRect())
```
