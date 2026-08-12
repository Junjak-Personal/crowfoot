> **This is a fork.**
> The original work is [Liam ERD](https://github.com/liam-hq/liam) by ROUTE06, Inc.,
> licensed under the Apache License, Version 2.0. This fork is pinned to upstream
> commit `92156eac5` and does not track it.
>
> See [`NOTICE`](./NOTICE) for what was changed and [`LICENSE`](./LICENSE) for the
> license. Modified files carry a notice at the top of the file; files added by
> this fork are marked as such.
>
> The command-line tool is redistributed under a different name,
> [`crowfoot`](https://www.npmjs.com/package/crowfoot), because section 6 of the
> License grants no trademark rights. No endorsement by ROUTE06, Inc. is implied.

---

<p align="center">
  <img src="./assets/crowfoot-logo.svg" width="88" height="88" alt="crowfoot" />
</p>

<h1 align="center">crowfoot</h1>

<h3 align="center">
  Automatically generates beautiful and easy-to-read ER diagrams from your database.
</h3>

<p align="center">
  <a href="https://crowfoot.jun-devlog.win"><b>Live demo →</b></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/crowfoot"><img src="https://img.shields.io/npm/v/crowfoot?color=F59E0B&label=npm" alt="npm" /></a>
  <img src="https://img.shields.io/badge/license-Apache--2.0-F59E0B" alt="Apache-2.0" />
</p>

<p align="center">
  Based on <a href="https://github.com/liam-hq/liam">Liam ERD</a> by ROUTE06, Inc., Apache-2.0.
</p>

---

[`crowfoot`](https://www.npmjs.com/package/crowfoot) builds a standalone, static ERD
app from a database schema — plus persisted table positions, canvas memos, colour
coding, table grouping, in-browser schema editing, and MySQL and PNG export.

**[crowfoot.jun-devlog.win](https://crowfoot.jun-devlog.win)** is a live one — a real
app's schema, grouped and annotated, built by the command below and served as static
files. The memos on it explain the features as you look at them.

> Full reference: **[docs/usage.md](./docs/usage.md)** (한국어) ·
> **[docs/usage_en.md](./docs/usage_en.md)** (English) — every command and option,
> the sidecar file schemas, deployment and troubleshooting. What follows is a summary.

## Build and serve

```bash
npx crowfoot erd build --input schema.sql --format postgres --output-dir dist
npx serve dist/
```

The interactive setup is `npx crowfoot init` — it walks you through picking a format
and prints the command you need.

The output is a static SPA: `file://` will not work, serve it over HTTP. All asset
paths are relative, so the build can be mounted at a sub-path (`/erd/`, say) without
rebuilding. `LICENSE` and `NOTICE` are written alongside it, since the generated site
carries the compiled viewer and therefore the license travels with it.

### `erd build` options

| Option | Description |
|---|---|
| `--input <path\|url>` | Schema file to read. A local path (glob patterns supported) or a URL. |
| `--format <format>` | Overrides format auto-detection. |
| `--output-dir <path>` | Output directory. Defaults to `dist`. |

⚠️ `--input` with an **absolute** path is parsed as a URL and fails with
`fetch failed`. Use a relative path.

A remote schema works the same way:

```bash
npx crowfoot erd build \
  --input https://raw.githubusercontent.com/user/repo/main/schema.sql \
  --format postgres
```

### Supported formats

| Source | `--format` | Typical files |
|---|---|---|
| PostgreSQL | `postgres` | `.sql` |
| Ruby on Rails | `schemarb` | `schema.rb`, `Schemafile` |
| Prisma | `prisma` | `schema.prisma` |
| Drizzle | `drizzle` | schema `.ts` files |
| tbls | `tbls` | `schema.json` |
| Liam JSON | `liam` | `schema.json` in the upstream format |

MySQL, SQLite and BigQuery have no direct parser. Export via
[tbls](https://github.com/k1LoW/tbls) (or `pg_dump` to PostgreSQL) and feed the
result in. The parser is unchanged from upstream, so its
[format documentation](https://liambx.com/docs/parser/supported-formats) still
applies — that link is upstream's, not this project's.

## What this fork adds

| | |
|---|---|
| **Persisted table positions** | Dragged tables stay put across reloads. Resolution order is `?positions=` → browser storage → `layout.json` → automatic layout. Tables not pinned anywhere still get the automatic layout, so adding a table to the schema does not break an existing arrangement. |
| **Canvas memos** | Free-form notes pinned to the diagram. In edit mode, `Ctrl`/`Cmd` + right-click the canvas to add one; memos can be moved, resized, recoloured, duplicated, copy-pasted (including into another tab) and have their font size changed. Shipped with the build in `memos.json`. |
| **Multi-select** | In edit mode, drag a box across the canvas, or `⌘`/`Ctrl` + click and `Shift` + click, to select several tables and memos at once, then move, tint, group or delete them together. `⌘G` groups, `⌘⇧G` ungroups. |
| **Table grouping** | Gather tables into named groups, drawn as a dashed tinted box behind them. A table may belong to more than one group. Dragging a group's label moves its members together. One toolbar control switches between **group view** (boxes drawn, sidebar sectioned by group) and **single view** (no boxes, the plain alphabetical list). Shipped with the build in `groups.json`. |
| **Colour coding** | Tables and memos can be tinted from a fixed 12-colour palette taken from the existing design tokens: `green`, `mint`, `teal`, `sky`, `blue`, `steel`, `sand`, `yellow`, `gold`, `orange`, `vermilion`, `red`. |
| **Schema editing** | In edit mode the table detail panel becomes a form for the whole table definition — name, comment, columns, primary/foreign/unique/check constraints, indexes — and tables can be added, renamed and removed. `Ctrl`/`Cmd` + right-click a table and pick `Connect to` to draw a foreign key to another one. Renames and deletions carry every reference with them, and the DDL export reflects the result. Edits live in `?schemaedits=`; `schema.json` is never touched. |
| **Read-only by default** | Positions, memos, colours and the schema itself are locked unless edit mode is on, so a shared link cannot be rearranged by accident. |
| **MySQL export** | Upstream exports PostgreSQL and YAML only; MySQL DDL was added, and the export menu can copy to the clipboard or download a `.sql` file. |
| **Arrange from a plan** | `erd plan` prints a grouping with every table already in it; `erd arrange` turns it into `layout.json` / `groups.json` / `memos.json`, working out every position. The plan carries no coordinates — sizing, group spacing and memo heights are the CLI's job. Written so an AI agent can drive it. |
| **PNG export** | The export menu writes the whole diagram, the current view, or just the selected tables, at twice the on-screen size. Controls and badges are left out, the background is painted rather than transparent, and an oversized diagram is scaled down to stay inside the browser's canvas limits. |
| **Short `?show=` values** | `all` / `table` / `key` instead of the internal `ALL_FIELDS` / `TABLE_NAME` / `KEY_ONLY`. |

## Edit mode

The **`Edit` button in the header** toggles it, or set the parameter yourself:

```
https://your-host/erd/?edit=1
```

`?edit=1` (or `?edit=true`) is what unlocks dragging tables, adding and editing
memos, the colour menus and schema editing. It is derived from the URL and never
stored, so dropping the parameter returns the diagram to read-only.

## Committing an arranged layout

The arrangement you make in edit mode lives in the URL, which makes it shareable
but not permanent. To turn a link into the sidecar files the viewer loads on every
visit, copy the URL and run:

```bash
npx crowfoot erd from-link --input '<the ?edit=1 URL>' --output-dir dist
```

Quote the URL — it contains `&`. Only the files the link actually carries are
written, so a link with no memos will not blow away an existing `memos.json`.

`layout.json`, `memos.json` and `groups.json` are loaded from the same directory
as `schema.json`, so keep them next to it and commit them to whatever your deploy
copies in — a rebuild overwrites the directory otherwise.

| File | Contents | Missing means |
|---|---|---|
| `schema.json` | The parsed schema. Written by `erd build`. | Nothing renders. |
| `layout.json` | `{"table_name": {"x": 0, "y": 0, "color": "teal"}}` | Automatic layout for every table. |
| `memos.json` | The canvas memos. | No memos. |
| `groups.json` | `[{"id": "...", "name": "Payment", "tableNames": ["orders"], "color": "gold"}]` | No groups. |

A table name may appear in more than one `groups.json` entry; both boxes are
drawn, and the sidebar lists that table once per group it belongs to.

In edit mode the Export menu also offers **Download layout.json**,
**Download memos.json** and **Download groups.json**, which is the same output
without going through a URL. The browser console exposes `crowfootLayout.dump()` /
`crowfootLayout.reset()`, `crowfootMemos.dump()` / `crowfootMemos.reset()` and
`crowfootGroups.dump()` / `crowfootGroups.reset()` for the same purpose.

An edit lives in the link and nowhere else. `?positions=`, `?memos=` and
`?groups=` carry only the difference from the deployed files, so redeploying one
still reaches everyone holding a link for everything they did not touch; `?base=`
records which files an edit was made against, and the viewer says so when they no
longer match. Because the link is the whole of the state, the back button is undo
(`Cmd`/`Ctrl` + `Z`) and forward is redo.

Browser storage holds one thing: a copy of the deployed files, kept only so that
mismatch can be described. Working copies written by releases up to 0.3.0
(`crowfoot:*`, `erdkit:*`, `liam:*`) are cleared the first time an edit is made.

## Query parameters

| Parameter | Values | Description |
|---|---|---|
| `show` | `all` \| `table` \| `key` | Level of detail. Defaults to `all`. |
| `active` | table name | Opens that table's detail panel. |
| `hidden` | compressed list | Table names hidden from the diagram. |
| `positions` | compressed `name:x:y` list | Table positions. Wins over `layout.json`. |
| `colors` | compressed `name:colorkey` list | Table tints. |
| `memos` | compressed JSON | The memos, verbatim. |
| `groups` | compressed JSON | The groups, verbatim. Wins over `groups.json`. |
| `showgroups` | `on` \| `off` | View mode. `on` (the default) draws the group boxes and sections the sidebar; `off` hides the boxes and returns the sidebar to a plain alphabetical list. Group data is untouched either way. |
| `edit` | `1` \| `true` | Enables editing. Absent means read-only. |

`positions`, `colors`, `memos` and `groups` are deflate-compressed and URL-safe
base64 encoded, so they survive CDN query-string handling intact. `memos` and
`groups` go in as one JSON blob rather than a list, because free-form text would
be shredded by the list parser's `,` split. Navigation parameters (`active`,
`show`, `hidden`, `showgroups`) push history entries; editing parameters
(`positions`, `colors`, `memos`, `groups`) replace them, so the back button
still does what you expect.

## Export menu

| Item | Output |
|---|---|
| Copy MySQL | MySQL DDL to the clipboard |
| Download MySQL (.sql) | `schema.mysql.sql` |
| Copy PostgreSQL | PostgreSQL DDL to the clipboard |
| Copy YAML | Schema as YAML |
| Download layout.json | Current positions and colours *(edit mode only)* |
| Download memos.json | Current memos *(edit mode only)* |
| Download groups.json | Current groups *(edit mode only)* |

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘C` / `Ctrl+C` | Copy the selected memos *(edit mode only)* |
| `⌘V` / `Ctrl+V` | Paste them at the cursor *(edit mode only)* |
| `⇧1` | Zoom to fit |
| `⇧2` | Show all fields |
| `⇧3` | Show table names only |
| `⇧4` | Show keys only |
| `⇧T` | Tidy up — re-run the automatic layout |
| `⇧A` | Show all tables |
| `⇧H` | Hide all tables |

## Development

```bash
pnpm install
pnpm exec turbo build --filter=@crowfoot/schema --filter=@crowfoot/ui   # required first
pnpm build                     # all packages
pnpm lint                      # lint and format
pnpm test                      # tests
```

The build of `schema` and `ui` is not optional on a fresh clone: `erd-core` and the
CLI import them as built packages, and `vitest` fails at collection without it.

Working on the CLI and viewer specifically:

```bash
cd frontend/packages/cli
pnpm run build                 # executable at dist-cli/bin/cli.js
pnpm run test
node ./dist-cli/bin/cli.js erd build --input ./fixtures/input.schema.rb --format schemarb
```

⚠️ `turbo build --filter=crowfoot` needs `--force` after an `erd-core`-only change.
`erd-core` is consumed as TypeScript source, so it is not part of the CLI's cache
key and a stale bundle comes back out of cache otherwise.

The workspace is six packages: `crowfoot` (the CLI), `@crowfoot/erd-core` (the
viewer), `@crowfoot/schema` (parsers and deparsers), `@crowfoot/ui` (components), and
`@crowfoot/configs` / `@crowfoot/neverthrow` as internal helpers. Only `crowfoot` is
published; the rest are private workspace packages that get inlined into it.
See [`CLAUDE.md`](./CLAUDE.md) for conventions.

## Releasing

Tag-driven, through GitHub Actions with npm trusted publishing — no tokens:

```bash
# bump frontend/packages/cli/package.json, add a CHANGELOG.md section, then:
git tag v0.1.4 && git push origin v0.1.4
```

The workflow refuses to publish if the tag disagrees with the version in
`frontend/packages/cli/package.json`. After publishing it creates the GitHub Release,
taking the notes from the matching [`CHANGELOG.md`](./CHANGELOG.md) section — so the
notes are written in one place, not two.

---

## Documentation

- **[docs/usage.md](./docs/usage.md)** — crowfoot 사용 가이드 (한국어)
- **[docs/usage_en.md](./docs/usage_en.md)** — crowfoot usage guide (English)
- [liambx.com/docs](https://liambx.com/docs) — **upstream Liam ERD's** documentation.
  The parser and schema formats are unchanged in this fork, so it still applies to
  those; the UI sections describe upstream's viewer, not this one.

What this fork changes is listed in [`NOTICE`](./NOTICE) and documented under `_docs/`.

## License

Apache License, Version 2.0 — see [`LICENSE`](./LICENSE).
This is a modified fork of Liam ERD, © 2024 ROUTE06, Inc.; changes © 2026 QESG.

Licenses for third-party packages are in [docs/packages-license.md](docs/packages-license.md).
