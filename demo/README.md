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

Its Supabase migrations are vendored in `migrations/`, which crowfoot parses
directly. They were an external path until 0.7.1; a demo that cannot be rebuilt
from this repository alone is one nobody can check.

```bash
npx crowfoot erd build --input 'demo/migrations/*.sql' --format postgres --output-dir dist
```

23 tables, 27 foreign keys, 37 migration files — the table count matches
`CREATE TABLE` in the migrations exactly, which is worth asserting after any parser
change. `--json` reports all of it, and `--strict` fails the build on anything the
parser read and could not represent.

The migrations carry no credentials: what looks like one is a column name
(`encrypted_api_key`), a comment describing how to create a vault secret, or a
lookup by name. They do name the deprecated project's Supabase URL, which is
public in the legacy repository too.

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
npx crowfoot erd build --input 'demo/migrations/*.sql' --format postgres \
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

The rest of this section is the two ways the copy goes wrong.

**Replace the contents, never the directory.** A bind mount resolves to the inode, so
`mv site site.old && mv site.new site` leaves the container serving the directory you
just renamed — with no error, and the old page still answering. Copy into the
directory that is already mounted.

`rsync -a --delete` is the obvious way to do it. If the host has no rsync, upload a
tarball, unpack it somewhere else, and copy it in — but then nothing deletes, which
is the second one:

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
