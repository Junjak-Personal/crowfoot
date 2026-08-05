# erdkit Usage Guide

> 한국어: [usage.md](./usage.md) · For a summary, see the [README](../README.md)

`erdkit` is a CLI that generates a standalone static ERD web app from a schema file.
It is a fork of [Liam ERD](https://github.com/liam-hq/liam) (Apache-2.0, ROUTE06, Inc.),
pinned to upstream commit `92156eac5` and not tracking it.

The original tool is documented at <https://liambx.com/docs>; this guide covers **the fork**.
The full list of changes is in [`NOTICE`](../NOTICE).

---

## Contents

1. [Quick start](#quick-start)
2. [CLI reference](#cli-reference)
3. [Build output](#build-output)
4. [Using the viewer](#using-the-viewer)
5. [Edit mode](#edit-mode)
6. [Persisting a layout](#persisting-a-layout)
7. [Sidecar file schemas](#sidecar-file-schemas)
8. [Query parameters](#query-parameters)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## Quick start

```bash
npx erdkit erd build --input schema.sql --format postgres --output-dir dist
npx serve dist/
```

Then open `http://localhost:3000`.

> **`file://` will not work.** The output is an SPA that reads its schema with
> `fetch('./schema.json')`, so it has to be served over HTTP.

If you are not sure which format applies, use the interactive setup:

```bash
npx erdkit init
```

---

## CLI reference

```
erdkit [command]

Commands:
  erd build       Generate the ERD web app from a schema file
  erd from-link   Recover layout.json / memos.json / groups.json from a shared link
  init            Guide you interactively through the setup

Options:
  -V, --version   Print the version
  -h, --help      Show help
```

### `erdkit erd build`

Parses the schema into `schema.json` and copies the viewer's static files into the
output directory.

| Option | Default | Description |
|---|---|---|
| `--input <path\|url>` | (none) | Path or URL to the schema file. Local paths support glob patterns. |
| `--format <format>` | auto-detected | Input format. See the table below. |
| `--output-dir <path>` | `dist` | Output directory. |

Examples:

```bash
# Local file
npx erdkit erd build --input db/schema.sql --format postgres

# Glob — several files merged into one schema
npx erdkit erd build --input 'db/migrations/*.sql' --format postgres

# Remote URL
npx erdkit erd build \
  --input https://raw.githubusercontent.com/user/repo/main/schema.sql \
  --format postgres

# Custom output location
npx erdkit erd build --input schema.prisma --output-dir public/erd
```

#### Supported formats

| Source | `--format` | Auto-detected filenames / extensions |
|---|---|---|
| PostgreSQL | `postgres` | `.sql` |
| Ruby on Rails | `schemarb` | `schema.rb`, `Schemafile`, `.rb` |
| Prisma | `prisma` | `prisma.schema`, `.prisma` |
| Drizzle | `drizzle` | `schema.ts`, `db.ts`, `database.ts`, `drizzle.ts`, `.ts`, `.js` |
| tbls | `tbls` | `schema.json`, `.json` |
| Liam JSON | `liam` | (not auto-detected — pass it explicitly) |

Omitting `--format` detects the format from the **filename and extension only** —
the file's contents are never inspected. Pass it explicitly when the extension is
ambiguous (any `.json` is read as `tbls`) or when a remote URL has no extension.
Detection failure exits with:

```
--format is missing, invalid, or specifies an unsupported format.
```

#### MySQL, SQLite and BigQuery

There is no direct parser. Export a `schema.json` with
[tbls](https://github.com/k1LoW/tbls) and pass `--format tbls`, or dump to
PostgreSQL and pass `--format postgres`.

> Exporting **to** MySQL DDL is supported by this fork — see the [Export menu](#export-menu).

### `erdkit erd from-link`

Turns an arrangement made in edit mode back into `layout.json` / `memos.json` /
`groups.json`. This is the central command of
[Persisting a layout](#persisting-a-layout).

| Option | Default | Description |
|---|---|---|
| `--input <url>` | (none) | The shared ERD URL. **Quote it** — it contains `&`. |
| `--output-dir <path>` | `dist` | Output directory. |

```bash
npx erdkit erd from-link --input 'https://example.com/erd/?edit=1&positions=...' --output-dir dist
```

Behaviour:

- Only the files the link **actually carries** are written. A link with no memos
  will not blow away an existing `memos.json`.
- If the link carries none of `positions` / `colors` / `memos` / `groups`, nothing
  is written and the command exits with an error.
- Colour keys are not validated here — the viewer drops unknown keys on load.
- `groups` is written just as raw, unvalidated — the CLI is not a sanitization
  boundary. Real validation happens in the viewer's `parseGroups` on load.
  `?showgroups=` is a pure view preference, so `from-link` never reads it.

### `erdkit init`

Walks through a database/ORM picker and prints the matching `erd build` command,
including the workaround paths such as `MySQL (via tbls)`.

---

## Build output

```
dist/
├── index.html          Viewer entry point
├── assets/             JS and CSS (all paths are relative)
├── schema.json         Written by erd build — the parsed schema
├── layout.json         (optional) pinned table positions and colours
├── memos.json          (optional) canvas memos
└── groups.json         (optional) table groups
```

- `layout.json`, `memos.json` and `groups.json` are **optional**. Without them you
  get the automatic layout and no memos or groups.
- All three load from the **same directory as `index.html`**. Anywhere else and
  they are not read.
- `erd build` overwrites the output directory, so keep the sidecars in source
  control and **copy them in after the build**.

---

## Using the viewer

### Navigation

| Input | Action |
|---|---|
| Scroll wheel / trackpad | Pan the canvas |
| `Ctrl` + scroll | Zoom |
| Middle / right drag | Pan the canvas |
| Double-click | Zoom in |
| Click a table | Open the detail panel (reflected in `?active=`) |
| Drag a table | Move it *(edit mode only)* |
| Left drag | Draw a selection box over tables and memos *(edit mode only)* |
| `Ctrl`/`Cmd`/`Shift` + click | Add to or remove from the selection *(edit mode only)* |

The left sidebar lists every table and lets you hide or show them individually.
Hidden state lands in `?hidden=`, so it travels with the link.

### Show mode

Three levels of detail, from the toolbar or the URL.

| `?show=` | Internal name | Displays |
|---|---|---|
| `all` | `ALL_FIELDS` | Every column **(default)** |
| `table` | `TABLE_NAME` | Table names only |
| `key` | `KEY_ONLY` | Key columns only |

### Command palette

`⌘K` / `Ctrl+K` opens a table search with a live preview and jumps to the match.

### Keyboard shortcuts

| Keys | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘C` / `Ctrl+C` | Copy the selected memos *(edit mode only)* |
| `⌘V` / `Ctrl+V` | Paste the copied memos at the cursor *(edit mode only)* |
| `⇧1` | Zoom to fit |
| `⇧2` | Show all fields |
| `⇧3` | Show table names only |
| `⇧4` | Show keys only |
| `⇧T` | Tidy up — re-run the automatic layout |
| `⇧A` | Show all tables |
| `⇧H` | Hide all tables |

> Sharing is the **Copy Link** button, top right. Positions, colours, memos and
> groups all ride in that URL, so **that single copy is the share**. It has no
> keyboard shortcut — `⌘C` belongs to the canvas selection.

### Export menu

The `Export` dropdown, top right.

| Item | Output |
|---|---|
| Copy MySQL | MySQL DDL to the clipboard |
| Download MySQL (.sql) | Downloads `schema.mysql.sql` |
| Copy PostgreSQL | PostgreSQL DDL to the clipboard |
| Copy YAML | Schema as YAML |
| Download layout.json | Current positions and colours *(edit mode only)* |
| Download memos.json | Current memos *(edit mode only)* |
| Download groups.json | Current groups *(edit mode only)* |

MySQL export is added by this fork; upstream offers PostgreSQL and YAML only.

---

## Edit mode

### Turning it on

```
https://your-host/erd/?edit=1
```

`?edit=1` or `?edit=true`. Without it the diagram is **read-only** — tables cannot
be dragged and memos cannot be created. That default is what keeps a shared link
from being rearranged by accident.

In edit mode a badge appears at the top of the canvas:
`Edit mode · drag to select · Ctrl/Cmd + right-click for the menu`

`editMode` is never stored, only derived from the URL. Drop the parameter and the
diagram is read-only again immediately.

### Moving tables

Tables are draggable in edit mode only. Dropping one writes to browser storage and
to `?positions=` at the same time.

To move **several at once**, drag a selection box across empty canvas with the left
button, or add items one at a time with `Ctrl`/`Cmd`/`Shift` + click. A box that
merely clips a table still selects it. Dragging any item in the selection moves
the whole set, and the whole set is saved together.

Tables and memos are caught by **the same selection box**. A mixed selection drags
as one, with table positions saved to `?positions=` and memos to `?memos=`.

> The selection box takes over the left button in edit mode only. In read-only the
> left button stays inert. Panning is the scroll wheel or a middle/right drag in
> both modes.

### Context menu

> **`Ctrl` (or `Cmd` on macOS) + right-click.** A plain right-click is React Flow's
> pan gesture, so the editing menu sits behind the modifier.

| Target | Menu |
|---|---|
| Empty canvas | `Add memo here` — creates a memo at the clicked point |
| A table | Colour palette |
| A memo | Colour palette, font size (`−` / number input / `+`), `Duplicate memo`, `Delete memo` |

The menu applies to **the whole selection**. Right-clicking something already in the
selection keeps that selection; right-clicking something outside it narrows the
selection to that one thing — the same rule a left click follows. So selecting five
tables and picking a colour from any one of them tints all five.

### Memos

A memo is the **same kind of canvas element as a table**: selecting, multi-selecting,
dragging and resizing behave identically.

- In edit mode the memo body becomes a textarea you can type into directly.
- Selecting a memo reveals resize handles on its corners. Minimum `100 × 60`,
  default `220 × 120`.
- Font size ranges from `10` to `96` and defaults to `13`. The step scales with the
  size — 2 below 24, 4 below 48, 8 above that.
- Colour, font size, duplicate and delete all apply to **every selected memo**.

### Copying and pasting memos

Three routes, all producing a **full copy under a new id** that keeps the colour,
font size and box size of the original.

| Route | Result |
|---|---|
| Context menu `Duplicate memo` | Every selected memo copied 24px down and right of its original |
| `⌘C` then `⌘V` | Pasted centred on the cursor; copying several **keeps their spacing** |
| `⌘V` in another tab | Pastes into any other tab showing the viewer |

Clicking a memo selects it and draws a green ring; click empty canvas to deselect.
With the caret inside a memo body, `⌘C`/`⌘V` behave as ordinary text copy and paste.

A copy or paste raises a toast — `Memo copied`, `3 memos pasted`. Pressing `⌘C`
with no toast at all means nothing was selected.

Memos travel through the OS clipboard as JSON under a marker, so pasting ordinary
text is ignored rather than turned into a memo.

### Colour palette

Twelve fixed colours, all lifted from the existing `@liam-hq/ui` design tokens.

| Key | Colour | Key | Colour |
|---|---|---|---|
| `green` | `#5ec692` | `sand` | `#c3b476` |
| `mint` | `#b0f9d4` | `yellow` | `#e7ddb3` |
| `teal` | `#87e2eb` | `gold` | `#ffbf36` |
| `sky` | `#cce8f2` | `orange` | `#dd6502` |
| `blue` | `#97bdcb` | `vermilion` | `#d55235` |
| `steel` | `#5f6366` | `red` | `#ea928e` |

`layout.json`, `memos.json` and `?colors=` store the **key**, not the colour value.
Keys outside this list are silently dropped on load.

### Groups

A group is a human-authored set of tables, drawn as a dashed, labelled box on the
canvas. Never inferred from foreign keys — always explicit. **A table can belong to
several groups at once** (multi-membership). Overlapping domains — payments and
settlement sharing a table, for example — are represented as-is, and overlapping
boxes and labels are treated as a normal state, not an edge case.

- **Creating one** — select two or more tables, then `Ctrl`/`Cmd` + right-click →
  `Group selected tables`.
- **Clicking the group header** — selects every member table so they can be moved
  together. The header sits as a label just outside the box's top-left corner.
- **Right-clicking the group header** — colour palette, rename, `Ungroup` (removes
  the grouping only; the tables themselves are untouched).
- **Right-clicking a table already in a group** — `Remove from "name"` drops that
  table from that one group only; its other memberships are unaffected.

#### Single view vs group view

The toolbar toggle button (or `?showgroups=on|off`) switches the canvas and the
sidebar **together**.

| | Single view (`showgroups=off`) | Group view (`showgroups=on`, default) |
|---|---|---|
| Canvas | No boxes or labels | Boxes and labels drawn |
| Left sidebar | Flat alphabetical list, one row per table | Sectioned by group, "Ungrouped" always last |
| A table in N groups | Listed **once** | Listed **N times** — once per group |

With no groups defined (or every defined group's members all gone), the sidebar in
both modes is **byte-identical** — group view shows no stray "Ungrouped" header
either.

If a table appearing several times in the sidebar is confusing, **single view is
the escape hatch**: one toggle click returns today's flat list. The sidebar's
`(n/m visible)` count is based on the actual table count in both modes, so a
duplicated row is never counted twice.

---

## Persisting a layout

### Resolution order

```
?positions= (link)  >  browser storage  >  layout.json  >  automatic layout (ELK)
```

Memos follow the same shape: `?memos=` > browser storage > `memos.json` > none.
So do groups: `?groups=` > browser storage > `groups.json` > none.

`?showgroups=` (single view vs group view) is a separate view preference, outside
this resolution order — it never changes the group data itself, only how it is
displayed.

The important part is that **a table pinned nowhere falls back to the automatic
layout**. Adding a table to the schema therefore does not break an existing
arrangement — the design deliberately avoids a hand-maintained layout debt.

Browser storage keys:

| Key | Contents |
|---|---|
| `liam:tableLayout` | Tables moved or tinted in this browser |
| `liam:memos` | This browser's working copy of the memos |
| `liam:groups` | This browser's working copy of the groups |

> Browser storage stays **in your browser only**. To show the arrangement to
> anyone else, share the link or pin it into the sidecar files below.

### Three ways to pin an arrangement

**A. Link → files (recommended)**

```bash
# 1. Open with ?edit=1 and arrange tables, colours, memos and groups
# 2. Copy the link with the Copy Link button, top right
# 3. Turn the link back into files
npx erdkit erd from-link --input '<the copied URL>' --output-dir dist
# 4. Commit dist/layout.json, dist/memos.json and dist/groups.json to source control
```

**B. Download from the Export menu**

In edit mode: `Export` → `Download layout.json` / `Download memos.json` /
`Download groups.json`. Same output, without going through a URL.

**C. Browser console**

```js
liamLayout.dump()    // print the current layout and copy it to the clipboard
liamLayout.reset()   // clear this browser's layout edits and reload
liamMemos.dump()     // same for memos
liamMemos.reset()
liamGroups.dump()    // same for groups
liamGroups.reset()
```

`dump()` prints and copies. Outside a secure context the clipboard is unavailable,
so copy from the console output instead.

---

## Sidecar file schemas

### `layout.json`

An object keyed by table name.

```json
{
  "users": { "x": 0, "y": 0 },
  "orders": { "x": 420, "y": 160, "color": "teal" },
  "order_items": { "x": 840, "y": 160, "color": "sand" }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `x` | number | ✅ | Canvas X coordinate |
| `y` | number | ✅ | Canvas Y coordinate |
| `color` | string | | Palette key. Values outside the list are ignored. |

An entry with a missing or non-numeric `x`/`y` is dropped whole, and that table
falls back to the automatic layout.

### `memos.json`

An array of memo objects.

```json
[
  {
    "id": "5c9f1b7a-1b7e-4e6a-9c3f-2a1d5e8b0c44",
    "text": "Payment domain starts here",
    "x": 120,
    "y": -240,
    "width": 260,
    "height": 140,
    "color": "gold",
    "fontSize": 15
  }
]
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | ✅ | | Must not be empty. New memos use `crypto.randomUUID()`. |
| `text` | string | ✅ | | Body. May be empty. |
| `x` | number | ✅ | | Canvas X coordinate |
| `y` | number | ✅ | | Canvas Y coordinate |
| `width` | number | | `220` | Minimum `100` |
| `height` | number | | `120` | Minimum `60` |
| `color` | string | | (none) | Palette key |
| `fontSize` | number | | `13` | Clamped to `10`–`96` |

Entries missing a required field or with the wrong type are skipped silently. Even
a badly broken sidecar still leaves the ERD itself working — loading a sidecar
never blocks the schema from loading.

### `groups.json`

An array of group objects.

```json
[
  { "id": "payment", "name": "Payments", "tableNames": ["orders", "payments"], "color": "gold" },
  { "id": "shipping", "name": "Shipping", "tableNames": ["shipments"] }
]
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Must not be empty. New groups use `crypto.randomUUID()`. A duplicate `id` keeps whichever entry appeared first. |
| `name` | string | ✅ | Group name. May be empty. |
| `tableNames` | string[] | ✅ | Member table names. **The same table name may appear in more than one entry (a different group)** — this is how a table's membership in several groups at once is represented. An empty array drops the whole entry. Duplicate names within one entry are merged into one. |
| `color` | string | | Palette key. Values outside the list are ignored. |

Entries missing a required field or with the wrong type are skipped silently. A
table name that no longer exists in the schema, or one that is hidden
(`?hidden=`), is excluded when the box is drawn; a group left with zero visible
members is simply **not drawn — it is not removed from the file**, and reappears
if the schema changes back.

---

## Query parameters

Almost every piece of UI state is reflected in the URL, so one link reproduces the view.

| Parameter | Values | Description | History |
|---|---|---|---|
| `show` | `all` \| `table` \| `key` | Level of detail. Defaults to `all`. | push |
| `active` | table name | Opens that table's detail panel. | push |
| `hidden` | compressed list | Table names hidden from the diagram. | push |
| `positions` | compressed `name:x:y` list | Table positions. Wins over `layout.json`. | replace |
| `colors` | compressed `name:colorkey` list | Table tints. | replace |
| `memos` | compressed JSON | The memos, verbatim. | replace |
| `groups` | compressed JSON | The groups, verbatim. | replace |
| `showgroups` | `on` \| `off` | Single view vs group view — applies to both the canvas boxes/labels and the sidebar sectioning. Defaults to `on`. | push |
| `edit` | `1` \| `true` | Enables editing. Absent means read-only. | — |

### Encoding

`positions`, `colors`, `memos` and `groups` are **deflate-compressed and URL-safe
base64 encoded** (`+`→`-`, `/`→`_`, `=` stripped). Not human-readable, but in exchange:

- They survive query-string reassembly by a CDN such as CloudFront intact.
- `positions` encodes **only the tables that were actually moved**. Everything else
  is reproduced from `layout.json` and the deterministic auto-layout, so links stay short.
- `memos` and `groups` are each a single JSON blob rather than a list — memo text
  and group names are both free-form and would be shredded by a list parser's
  `split(',')`.
- `showgroups` is a **view mode**, not group data, so it rides uncompressed as
  `on`/`off`.

### History behaviour

`push` adds a back-button entry, `replace` does not. Navigation (`active`, `show`,
`hidden`, `showgroups`) should be reversible with the back button; editing
(`positions`, `colors`, `memos`, `groups`) must not fill the history stack on every
drag, so the two are split deliberately.

---

## Deployment

### Static hosting

The output is plain static files — S3 + CloudFront, GitHub Pages, Netlify, Vercel
and nginx all work.

```bash
npx erdkit erd build --input schema.sql --format postgres --output-dir dist
aws s3 sync dist/ s3://my-bucket/erd/ --delete
```

### Mounting at a sub-path

Asset paths (`./assets/…`) and the schema fetch (`./schema.json`) are **all
relative**, so mounting the build at a sub-path such as `/erd/` needs **no rebuild**.

### Cache headers

The viewer requests `layout.json` / `memos.json` / `groups.json` with
`cache: 'no-cache'`, which revalidates the browser copy. **CDN caching is a
separate matter**: to have a deploy show up immediately, give those three files a
short TTL or invalidate them.

`assets/` filenames are content-hashed, so they are safe to cache for a long time.

### Wiring into CI

```bash
# Rebuild when the schema changes, then copy the sidecars back in from source
npx erdkit erd build --input db/schema.sql --format postgres --output-dir dist
cp docs/erd/layout.json docs/erd/memos.json dist/
```

`erd build` overwrites the output directory, so the copy has to come **after** the build.

---

## Troubleshooting

**Blank page with a fetch error in the console**
Most likely opened over `file://`. Serve it over HTTP (`npx serve dist/`).

**Tables snap back to the automatic layout every time**
Check that `layout.json` sits in the same directory as `schema.json`. A rerun of
`erd build` may have overwritten it without the sidecars being copied back.

**Memos do not appear**
Check where `memos.json` is. Any entry missing `id`, `text`, `x` or `y` is dropped silently.

**Group boxes do not appear**
Check whether `?showgroups=off` is set (`?showgroups=on` is the default). If it is
on, check where `groups.json` is, or whether every member table is hidden
(`?hidden=`) — a group with zero visible members is not drawn.

**Cannot drag tables or create memos**
The URL has no `?edit=1`. Read-only is the default.

**Right-click does not open a menu**
Hold `Ctrl` (`Cmd` on macOS) as well — a plain right-click is the pan gesture. The
menu never opens outside edit mode, modifier or not.

**`⌘C` does nothing (no toast appears)**
No memo is selected. Click the memo once, check for the green ring, then press it
again. A selection of tables only counts as none — tables are not copied. If you
meant to copy the link, that is the **Copy Link** button, top right.

**`⌘V` does nothing**
Either `?edit=1` is missing, or the clipboard holds something this viewer did not
copy. Ordinary text is ignored on purpose.

**Left drag draws a box instead of panning**
That is edit mode working as intended. Pan with the scroll wheel or a middle/right drag.

**The arrangement only persists in my browser**
It is still in browser storage. See [Three ways to pin an arrangement](#three-ways-to-pin-an-arrangement).

**`from-link` fails with "carries no positions, colors, memos or groups"**
The link has no edits in it. Open with `?edit=1`, actually move or add something,
then copy the URL again with the **Copy Link** button.

**`from-link` only picks up part of the URL**
The shell cut the command at `&`. Wrap the whole URL in single quotes.

**A colour is ignored**
The key is outside the [twelve-colour palette](#colour-palette) and is dropped on load.

**Exits with `--format is missing, invalid...`**
The extension was not enough to detect the format. Pass `--format` explicitly.

**The deploy still shows the old arrangement**
CDN cache. Invalidate `layout.json` / `memos.json` / `groups.json`.

**How do I reset?**
`liamLayout.reset()` / `liamMemos.reset()` / `liamGroups.reset()` in the browser
console. That clears only this browser's edits and returns to whatever
`layout.json` / `memos.json` / `groups.json` say.

---

## Using the original Liam ERD

To use the upstream tool rather than this fork:

- Public repositories: insert `liambx.com/erd/p/` into the schema file's URL —
  `https://liambx.com/erd/p/github.com/user/repo/blob/master/db/schema.rb`
- Private repositories: `npx @liam-hq/cli init`
- Docs: <https://liambx.com/docs> — [UI Features](https://liambx.com/docs/ui-features) ·
  [Web](https://liambx.com/docs/web) · [CLI](https://liambx.com/docs/cli) ·
  [Parser](https://liambx.com/docs/parser)

Upstream has no position persistence, memos, groups, colours, edit mode or MySQL export.
