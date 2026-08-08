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

## Two things that will bite

**A table with no foreign key ignores `layout.json`.** The viewer collects
relationship-less tables into a built-in group of its own and places it where it
likes. `dictionary_entries` is the one here, and it is deliberately left out of every
group — put it in one and its box stretches across the whole canvas. This is also why
the grouped columns start at a large `x`: they have to clear wherever that built-in
group lands.

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
