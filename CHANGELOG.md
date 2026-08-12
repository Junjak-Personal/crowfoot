# Changelog

Notable changes per release. Written for someone deciding whether to upgrade, so it
records behaviour and reasons rather than commits — `git log` already has those.

Versions follow [semver](https://semver.org/). While the major is `0`, a minor bump
is where a breaking change may appear.

> Starts at `0.1.3`. `0.1.0`–`0.1.2` shipped the same day this project was renamed
> from `erdkit` and are on npm without notes; the history before that — including the
> fork from [Liam ERD](https://github.com/liam-hq/liam) — is recorded in
> [`NOTICE`](./NOTICE) and in git, and is deliberately not restated here.

## Unreleased

### Added

- **A panel saying what is selected, and what can be done to it.** It appears
  in edit mode as soon as anything is, and carries the count — which until now
  existed only as a condition on a menu item, so "did the lasso catch four
  tables or five" could only be answered by counting outlines. Its buttons come
  from the selection and are absent rather than greyed out when they do not
  apply.
- **A table can be moved between groups without dissolving one.** `Add to` and
  `Remove from` act on the whole selection; before this the only way to change
  a grouping was to ungroup and build it again, which cost its name and its
  colour too. Resting on a row draws the box that row would produce, in the
  group's own colour, before anything is committed.
- **Selecting a group and selecting the tables in it are two different
  things.** Clicking a group's label selects the group; double-clicking steps
  inside and hands you its tables, as does clicking any of them directly. They
  used to be one act — the label put every member into the selection — so
  nothing on screen could say which one a command was about to apply to, and
  `⌘⇧G` quietly did nothing whenever a group was what you had in mind.

### Fixed

- **Clicking a table on the canvas no longer moves the camera.** It framed the
  table you clicked, which meant the view lurched away from whatever else you
  had in front of you — worst while arranging groups, where clicking tables is
  the whole activity. Picking a table by name from the sidebar or the command
  palette still brings it into view; there the table may be anywhere.
- **A `DEFAULT` that is `false`, `0` or an empty string is no longer read as
  absent.** The parser's JSON drops a scalar it considers empty but keeps its
  wrapper, so every falsy default arrived looking like a column with no default
  at all. Negative integers are dropped the same way and are indistinguishable
  from zero, so those are read back out of the SQL rather than guessed —
  recording `0` where the column said `-1` would be worse than recording
  nothing.
- **`DEFAULT now()`, `gen_random_uuid()`, `CURRENT_TIMESTAMP` and casts are
  parsed.** Only bare literals were, and function defaults outnumbered literals
  two to one in the schemas this was measured against: 18 of 251 columns came
  back with a default before, 102 after. An expression that cannot be
  represented faithfully is still left empty rather than approximated.
- `erd arrange` no longer drops a table with no foreign key out of the group
  the plan put it in. It cannot be given a coordinate — the viewer parents it
  to a group of its own — but that is a fact about layout, not about which
  context the table belongs to. The membership is kept and the consequence is
  reported. `erd plan` clusters them like any other table for the same reason.

## 0.3.0

A diagram you can arrange without dragging, and take a picture of.

### Added

- **`erd plan` and `erd arrange` — a diagram arranged without dragging anything.**
  `plan` prints a grouping with every table name already in it, clustered by
  shared name prefix as a starting point. Edit it — rename the groups, move
  tables between them, add memos — and `arrange` turns it into the three sidecar
  files, working out every position. The plan has no coordinates in it on
  purpose: sizing tables, spacing groups so their boxes clear, and making a memo
  tall enough not to lose its last line are the parts that are wrong by default
  and say nothing when they are. Meant for an AI agent driving the CLI, and just
  as useful for a person who would rather not place forty tables by hand.
- A table with no foreign key is left out of the generated `layout.json` and
  reported rather than placed. The viewer gathers those into a group of its own,
  and React Flow reads a child's position in its parent's frame, so a coordinate
  written for one lands somewhere else entirely.
- **The export menu writes PNGs.** Three of them: the whole diagram, the pane as
  you are looking at it, or only the tables you have selected. Images come out at
  twice the on-screen size so text survives being dropped into a document, and
  the zoom controls and badges are left out — only the diagram is captured. The
  background is painted rather than left transparent, because the viewer is dark
  and a transparent PNG in a light document is pale text on white.
- A diagram too big for the browser's canvas is exported at reduced scale rather
  than refused. Past the point where even that will not do, the canvas stops
  working without raising anything, so an export that has not finished in 30
  seconds gives up and says which of the smaller exports to try instead.

## 0.2.3

### Fixed

- **A section of the table pane could be cut off partway through.** Each one
  animated open to a height its caller had guessed — 300px per column, 400px per
  constraint, 700px per foreign key — and whatever did not fit inside the guess
  was hidden, with no scrollbar or any other sign that there was more. The
  margins were thin: a four-column unique constraint already used 336px of its
  400, and each further column costs about 30px. Sections now fold to the height
  they actually measure, so there is nothing left to guess.
- `erd build` left the previous build's bundle behind on every rebuild into the
  same directory — 2.4MB each time, and a deploy that syncs without `--delete`
  carries all of them forever. `assets/` is emptied first now. Nothing else in
  the output directory is touched: `schema.json`, and the `layout.json`,
  `memos.json` and `groups.json` you put beside it, stay exactly as they were.

## 0.2.2

### Fixed

- Every section of the table editor was cut off partway through — the comment
  field, a column's checkboxes, the line saying a table has no check
  constraints. The editor's pane was a flex column, so each section was free to
  shrink under its own content, and the sections hide their overflow: the pane
  never grew tall enough to scroll, and nothing indicated there was more to see.

## 0.2.1

### Fixed

- **Memos and group boxes disappeared from any deployment carrying
  `memos.json` or `groups.json`.** The canvas takes them, and the pinned
  positions, once — when it mounts. Until 0.2.0 it was remounted whenever the
  schema changed, so it picked them up when the schema arrived; 0.2.0 stopped
  remounting it and the app was still mounting it immediately, against the empty
  schema it starts with and before the sidecars had been fetched. The sidebar
  went on listing the groups, which made it look like a canvas problem rather
  than a loading one. The app now waits for the sidecars and the schema before
  rendering the diagram.

## 0.2.0

The viewer could arrange a diagram but never change what it showed. It can now.

### Added

- **Schema editing in the browser.** In edit mode the table detail panel becomes
  a form covering the whole of a table's definition — name, comment, columns,
  primary/foreign/unique/check constraints and indexes — and tables can be added,
  renamed and removed. Each section folds, and its header carries the button that
  adds to it.
- **Connecting two tables is a gesture.** `Ctrl`/`Cmd` + right-click the table
  that should hold the key, pick `many : 1`, `1 : 1`, `1 : many` or
  `many : many`, then click the table to connect it to. The first three write a
  foreign key (one-to-one adds the `UNIQUE` that makes it so, one-to-many puts
  the column on the other end); many-to-many has no single-key form, so a join
  table is created between them and pinned halfway.
- **`⌘G` / `⌘⇧G`** group and ungroup the selection. Ungrouping asks first,
  from the shortcut and the right-click menu alike.
- Edits ride in `?schemaedits=` and carry only the tables actually touched, so a
  link stays proportional to the work. Nothing is written to `schema.json`, and
  the DDL export reflects the edits.
- Renames and deletions carry their references: foreign keys follow a renamed
  table or column, constraints and indexes left with no columns are dropped, and
  a renamed table keeps its pinned position, its tint and its group membership.

### Changed

- **Editing no longer rearranges the diagram.** The canvas used to be rebuilt on
  a key derived from the schema, so every edit reset the viewport, the selection
  and the position of every table nobody had dragged. It is reconciled in place
  now; when a table grows, only what is directly below it slides down to make
  room. `Tidy up` is still there for a full re-layout.
- **Shift + click adds to the selection.** React Flow's default is a single
  modifier, so it never did — even though this project's own documentation said
  it worked. Ctrl is deliberately not a selection modifier on macOS, where it is
  the secondary-click gesture.

### Fixed

- Pressing Enter to confirm an IME candidate committed the field mid-composition,
  which broke Korean syllables apart into jamo.
- A new relationship's edge did not appear until the page was reloaded: React
  Flow was never told about the handle the new key had grown.
- Reloading a link carrying `?schemaedits=` scattered the diagram into a single
  column — the schema arrives after the first render, and the automatic layout
  had already declared itself done against a partial one.

### Known

- Diagrams past roughly a hundred tables feel heavy while editing. The cost is in
  the per-table tooltip and context-menu machinery, not in the schema layer.

## 0.1.3

### Fixed

- The package page on npm documented a `pnpm dev` that runs against `fixtures/`. It
  fetches a remote schema over the network, so anyone following it offline watched a
  command fail for a reason the docs denied.
- Its only reference link pointed at upstream's CLI documentation, which describes a
  different command. It now points at the parser format docs, which do still apply,
  labelled as upstream — plus this repository's own usage guide, which the package
  page never offered.

### Added

- The npm page now states the `--input` relative-path constraint, that the output
  mounts at a sub-path unchanged, that `LICENSE` and `NOTICE` ship inside it, and the
  `--force` caveat for `erd-core`-only rebuilds.
