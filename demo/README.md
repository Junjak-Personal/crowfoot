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

It is not vendored here. The demo is built from its Supabase migrations, which
crowfoot parses directly:

```bash
npx crowfoot erd build --input 'supabase/migrations/*.sql' --format postgres --output-dir dist
```

23 tables, 27 foreign keys — the table count matches `CREATE TABLE` in the migrations
exactly, which is worth asserting after any parser change.

## Rebuilding

```bash
node demo/build-demo.mjs dist/schema.json demo   # regenerate the three files
cp demo/{layout,groups,memos}.json dist/         # the viewer fetches them at runtime
```

Serve `dist/` over HTTP — any static host will do. `file://` will not work.

Edit the groups in `build-demo.mjs` rather than the JSON: positions are computed from
group membership, so adding a table to a group is a one-line change and re-run.

## Deploying

The site is an nginx container with two bind mounts from the host: the directory it
serves, and nginx's own `default.conf`. Both used to live inside the container and
nowhere else — one `docker rm` from taking the site and its server config with it.

A deploy is now `dist/` replacing the contents of the mounted directory. Take a copy
of what is there first; the rest of this section is the two ways that goes wrong.

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
