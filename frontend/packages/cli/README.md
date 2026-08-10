# crowfoot

Command-line tool that generates a standalone web app displaying ER diagrams.

A fork of [Liam ERD](https://github.com/liam-hq/liam) (Apache-2.0, ROUTE06, Inc.)
adding persisted table positions, canvas memos, table grouping, colour coding,
canvas multi-selection, a read-only default with an explicit edit mode, and
MySQL schema export. Section 6 of the License grants no trademark rights, so
this fork is published under its own name; it is not endorsed by ROUTE06, Inc.
See `NOTICE` for the full list of changes.

## Usage

```bash
npx crowfoot erd build --input schema.sql --format postgres --output-dir dist
```

`--format` accepts `postgres`, `schemarb`, `prisma`, `drizzle`, `tbls`, `liam`.
Use a **relative** `--input` path; an absolute one is parsed as a URL and fails.

The output directory is a static SPA — serve it over HTTP, `file://` will not work:

```bash
npx serve dist/
```

All asset paths are relative, so it can be mounted at a sub-path (`/erd/`) without
rebuilding. `LICENSE` and `NOTICE` are written alongside it: the generated site
contains the compiled viewer, so the licence travels with it.

Full documentation — every option, the sidecar file schemas, deployment and
troubleshooting — is in the repository:
**[usage guide](https://github.com/Junjak-Personal/crowfoot/blob/master/docs/usage_en.md)**
(also [한국어](https://github.com/Junjak-Personal/crowfoot/blob/master/docs/usage.md)).

The parser is unchanged from upstream, so its
[format documentation](https://liambx.com/docs/parser/supported-formats) still
applies — that link is Liam ERD's, not this project's.

### Committing an arranged layout

Open the built ERD with `?edit=1`, drag tables around, add memos, group tables,
then copy the URL — it carries the arrangement. Turn that link back into the
sidecar files the viewer loads:

```bash
npx crowfoot erd from-link --input '<the ?edit=1 URL>' --output-dir dist
```

Quote the URL; it contains `&`. Only the files the link actually carries are
written, so a link with no memos will not blow away an existing `memos.json`.
`layout.json`, `memos.json` and `groups.json` load from the same directory as
`schema.json`, so keep them next to it (or commit them to whatever your deploy
copies in).

### Arranging it without dragging anything

Useful for an AI agent, and for anyone who would rather not place tables by hand.
`erd plan` prints a grouping with every table name already in it, grouped by
foreign-key island as a starting point:

```bash
npx crowfoot erd plan --input dist/schema.json > plan.json
```

Edit that file — rename the groups, move tables between them, add memos. **There
is no coordinate in it, by design.** Then:

```bash
npx crowfoot erd arrange --input dist/schema.json --plan plan.json --output-dir dist
```

`arrange` writes the same three sidecar files as `from-link`, working out every
position: tables sized from their column count, groups spaced far enough apart
that their boxes do not overlap, memos tall enough that none of the text is cut
off. Those are the parts that are wrong by default and silent about it, which is
why they are not yours to get right.

```jsonc
{
  "groups": [
    { "id": "vocab", "name": "Vocabulary", "color": "sky",
      "tables": ["words", "word_examples", "wordbooks"] }
  ],
  "memos": [
    { "text": "Words and the books they belong to.", "color": "sky", "span": 2 }
  ]
}
```

`color` is one of `green` `mint` `teal` `sky` `blue` `steel` `sand` `yellow`
`gold` `orange` `vermilion` `red` — anything else is rejected rather than
silently dropped. `span` is the memo's width in columns.

A table with no foreign key at all is left out of `layout.json` and reported: the
viewer gathers those into a group of its own and places them itself, so a
position written for one would be applied in a different coordinate space.

## Development

```bash
pnpm run build   # executable at dist-cli/bin/cli.js
pnpm run test
node ./dist-cli/bin/cli.js erd build --input ./fixtures/input.schema.rb --format schemarb
```

`pnpm dev` builds the CLI, runs it against a **remote** schema (mastodon's
`schema.rb`, fetched over the network — not `fixtures/`), copies the generated
`schema.json` into `public/` and starts the Vite dev server. Point
`command:build` at `./fixtures/input.schema.rb` if you want it offline.

⚠️ `turbo build --filter=crowfoot` needs `--force` after an `erd-core`-only
change: `erd-core` is consumed as TypeScript source, so it is not part of this
package's cache key and a stale bundle comes back out of cache otherwise.

## Project File Structure

- **`bin/cli.ts`**: main CLI script.
- **`src/cli/`**: CLI source.
- **`fixtures/input.schema.rb`**: sample input for testing and development.
- **`src/{App,main}.tsx`**, **`index.html`**: the ER diagram web app entry point.
