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

## 0.7.3

### Fixed

- **An edge drew over a group's name.** A group's box and the label it carries
  are one node, and React Flow writes `zIndex` and `transform` inline on the
  node wrapper — each starting its own stacking context — so the two cannot be
  given different depths. The box sat below every edge, which put the name there
  with it, and a hairline crossing an opaque label is the one place the backdrop
  had to win. The box now sits between the edges and the tables: still a
  backdrop for the tables it holds, no longer beneath the lines that pass over
  it. A non-member table overlapping the label still covers it — separating
  those two needs a second node, not a second z-index.

### Changed

- **A table's name is smaller at the zoom where the name is all that is drawn.**
  12px against the full node's 14, with less padding around it, which makes the
  chip about 16% narrower and 19% shorter. Names collided at that zoom long
  before they were hard to read, and the chip is what decides how much room a
  table takes there.

## 0.7.2

### Fixed

- **A group's name lurched between sizes as the canvas was zoomed.** It was
  ramped rather than scaled — `12px + (scale - 1) * 36px`, to clear a 14px
  table name from a 12px base — which reached 84px against the table's 42px and
  moved 18px at every half step of the scale against the table's 7px. It is a
  plain multiple now, from a base one step above the tables': the group still
  outranks the tables inside it at every zoom, and changes by exactly as much as
  they do.
- **A long name is no longer cut short with an ellipsis.** A table node is
  `width: auto` and a group's pill is drawn around whatever it holds, so both
  simply grow — there was nothing for the ellipsis to rescue, and it hid the end
  of a name inside a box that would happily have got wider.

## 0.7.1

### Fixed

- **`layout.json` was ignored for every table with no foreign key.** The viewer
  gathers those into a container of its own, and React Flow measures a child's
  position from its parent — so a canvas coordinate applied to one landed the
  table a whole container's offset away, and dragging one wrote that offset
  back as though it were a coordinate. Neither half said anything; the diagram
  drew, it just drew somewhere else. A table leaves the container the moment
  something places it, and a position is recorded in canvas space whatever the
  table is parented to.
- **`erd arrange` places every table now**, relationship-less ones included, and
  `erd plan` no longer warns that it cannot. The band `arrange` used to leave
  clear for that container goes with them, so a diagram starts at the origin
  rather than `x: 3100` — an existing plan re-arranged will come out with
  different coordinates, and the same diagram.

## 0.7.0

### Added

- **Zoomed out far enough, a group is only its label.** The box, the tables
  inside it and the edges between them all go; a table in no group stays,
  because nothing else speaks for it. Three rungs now, one per thing that stops
  being legible: a table draws its columns, then its name, then its group draws
  for it.
  - A member is hidden rather than unmounted. The group's box is its members'
    bounding box, so a member that stopped taking up space would drag the label
    that replaced it across the canvas.
  - Every edge goes at that zoom, not only the ones ending somewhere hidden.
    React Flow puts neither endpoint on the element, so telling them apart
    means driving `edge.hidden` from state and holding it there through every
    reconcile — and at this zoom an edge is a hairline.
- **The zoom each rung starts at is a setting**, under `Detail` in the toolbar
  and remembered in the browser. How dense a diagram is, and how far away
  whoever is reading it sits, are things only they know: 23 tables and 300
  tables stop being legible at very different zooms. Defaults are 40% for names
  only and 20% for groups only. A group rung asked to sit above the table rung
  is brought back down to it — above it there would be no zoom left at which a
  table draws its name.

### Fixed

- **A group read smaller than the tables inside it, at every zoom.** Its label
  was scaled by the same counter-scale as a table name but starts at 12px
  against a table's 14px, so pulling back never made the group the thing you
  could still read — the tables kept the diagram and the grouping disappeared
  into it. The label now ramps instead: unchanged at reading zoom, and by the
  point a table name is 42px the group above it is 84px. Zooming out gives way
  to the larger thing, which is what the mode is for.

## 0.6.0

### Added

- **`erd build --json`** prints what the build read — tables, columns,
  constraints by kind, indexes, enums, extensions, and anything it could not
  represent. Counted off the `schema.json` that was just written, so the
  numbers describe the file every consumer downstream reads. stdout carries
  only the report; everything for a person moves to stderr, so
  `erd build --json > report.json` is a file and not a transcript.
- **`unparsed`** names each such clause by table, column, clause and the source
  text as written. A `DEFAULT` the postgres parser cannot render used to come
  back `null` — which is exactly what a column with *no* default looks like,
  and no count of the output could tell the two apart. A one-line warning is
  printed with or without `--json`.
- **`--strict`** exits 1 when anything was read but not represented.
- **`schema.json` records what it was built from.** `meta` carries every source
  file with its sha256 (over the source bytes, so `sha256sum` agrees), the
  crowfoot version and the build time. `curl .../schema.json | jq .meta`
  answers it, and so does the help menu — a screenshot of the diagram now
  carries its own provenance. Optional, so a file written before this still
  loads.

### Fixed

- **`erd plan --update <plan>`** brings an existing plan back in step with a
  schema that moved under it. Tables the schema no longer has are dropped,
  groups they empty go with them, and tables it has gained are put in a group
  named `unassigned` for the next edit to place. Every grouping decision already
  made survives. A plan naming a table that is gone stops `arrange` outright, so
  the choice past a hundred tables used to be hand-editing the JSON or starting
  the grouping over.
- **`erd arrange --check`** reports the diagram a deploy actually serves and
  writes nothing: the size and position of every group box the viewer will
  draw, which members have no position of their own, and exit 1 if any two
  boxes cross. Two crossing boxes is what reads as a broken diagram, and until
  now the only way to see it was to open a browser and measure the DOM. It
  reads the `layout.json` and `groups.json` in `--output-dir` rather than
  re-running the layout — `arrange` places groups hundreds of units apart and
  its own boxes can never cross, so checking those would always pass. They
  cross after someone has dragged tables in edit mode.
- **`--help` carries the usage, not just the flag list.** Every command shows
  worked examples, and the top level shows the quick start, the supported
  formats and what to do about the ones with no parser. The package ships no
  documentation of its own — `files` carries the build and the licences and
  nothing else — so for anyone working in another repository, and for an agent
  especially, this is the manual. An unrecognised flag or command now points at
  it too.
- **An array column was read as its element type** — `text[]` as `text`.
  Postgres carries the dimensions in `TypeName.arrayBounds` and nowhere else,
  and the parser read only the names. Nothing downstream could catch it: the
  column count was right, which is what makes it the kind of loss counting
  cannot find. The deparser has always been able to write the suffix back out.
- **Files matched by a glob were read in whatever order the filesystem gave
  them,** then concatenated before parsing — so the same input could produce
  two different schemas. Sorted.
- **`pnpm lint` was not type-checking the `crowfoot` package at all.** Its
  `lint:tsc` ran `tsc --noEmit` against a root config that is `"files": []` plus
  project references, and without `-b` that walks nothing and exits 0. Three
  real errors were sitting behind it, including an `emptySchema` that did not
  satisfy `Schema`. Both projects are checked now.
- **A Windows path with a drive letter was fetched instead of read.**
  `C:\db\schema.sql` parses as a URL whose protocol is `c:`, so it went to
  `fetch` and failed with `fetch failed` — an absolute path was unusable on
  Windows. A POSIX absolute path was never affected, despite what the README
  said; that line is gone with the defect it described.
- **`erd build` with no `--input` threw a raw stack trace** from inside `glob`,
  at whoever left off the one flag the command cannot work without. It says
  `--input is required`, which is what `from-link`, `plan` and `arrange` have
  always said.

## 0.5.0

### Added

- **The canvas simplifies itself as it is zoomed out.** Past 50% zoom every
  table drops to its name alone, and the name is counter-scaled so it keeps a
  readable size on screen instead of shrinking with the diagram — a hundred
  tables zoomed out to fit were a wall of rows too small to read, which is the
  point at which an overview stops being one.
  - Rendering only. `?show=` and the show-mode picker keep whatever was chosen,
    nothing is written to the URL or the back button, and zooming in restores
    the columns. No table moves: the layout is left exactly as it was arranged.
  - Counter-scaling stops at 3x, so past roughly 30% zoom the names shrink
    again rather than growing their tables into each other. Group labels follow
    the same rule.

### Fixed

- **Typing in a memo or a group name lost the caret and broke Korean input.**
  Both fields commit through React Flow, which queues the change and applies it
  a render later — so the render in between put the *previous* text back in the
  box. Rewriting a text box sends the caret to its end, so a character typed
  mid-word landed at the end of the line instead; and it throws away an
  in-flight IME composition, which is how a Korean syllable came apart into
  jamo. The field now shows what was typed into it until it is left.
- **A table could not be resized by anything it drew.** The automatic layout
  wrote the size each table had when it ran onto the table itself, and React
  Flow honours an explicit size instead of measuring — so a table kept that
  size for as long as it stayed on the canvas, unable to shrink when its
  columns were hidden or widen for a longer name. Sizes are measured again.

## 0.4.2

### Breaking

- **A table belongs to at most one group.** The group box is derived from its
  members' bounding box on every render, so a table in two groups forced the
  two boxes to cross and made dragging either one deform the other — and
  `erd arrange`, which packs each group into its own column, could not place
  such a table in two columns at once: it wrote the last column's coordinate
  and left the first group's box stretched across the diagram to reach a table
  that was no longer next to it.
  - A `groups.json` or a link that names a table twice still opens. The group
    that names it **first** keeps it; a group left with no table of its own is
    dropped. The same resolution runs on every read, so the canvas, the sidebar
    and an export never disagree about which group owns a table.
  - `erd arrange` **refuses** such a plan instead, naming the table and the two
    groups. A plan is written now, not inherited, and quietly picking one group
    would teach whoever wrote it that the plan meant something it did not.
  - In the selection panel, `Add to` is now **`Move to`** — joining a group is
    the same act as leaving the one before it — and the `Remove from` menu is a
    single `Remove from group` button, since there is only ever one to leave.
    Hovering a `Move to` row previews both boxes changing at once.

### Fixed

- **`erd from-link` deleted the position of every table the link did not
  mention.** A link carries only the tables that were dragged, and
  `layout.json` was written from the link alone while `groups.json` and
  `memos.json` were merged into the deployed files. Updating an 86-table
  `layout.json` from a link that had moved 33 of them left 33 — the other 56
  positions were gone, with no error, no warning, and a `Wrote layout.json (33
  tables)` that read like success. `layout.json` is now merged like the other
  two.
  - Merged **per field**, not per entry: a table that was moved but not
    recoloured keeps the colour the deploy gave it, and one that was recoloured
    but not moved keeps its position. The second half of that was its own quiet
    loss — a colour-only edit used to arrive carrying an invented `(0, 0)`.
  - The report says what happened — `layout.json (89 tables: 53 kept, 33
    updated, 3 added)` — and says so when there was no deployed `layout.json`
    to merge into. The old count could not tell a merge from a deletion.
- **A rejected input printed a stack trace instead of its message.** Commands
  report a bad input two ways — some return the error, some throw it — and only
  the returned ones were being read out. Every check in `erd arrange`
  (unreadable plan, invalid plan, unknown table, duplicate group id, and now a
  shared table) throws, so all of them surfaced as a raw V8 trace with the
  message buried in it. They print as `ERROR: …` and exit 1 like everything
  else now. An error that is *not* a CLI error still keeps its stack trace —
  that one is a defect in this tool, and the trace is the point.

## 0.4.1

### Fixed

- **The selection panel sat on top of the toolbar.** Both were centred on the
  bottom edge, so the zoom controls and the show-mode picker were underneath
  it. It goes in the bottom right corner now, and above the toolbar rather than
  on it when the window is too narrow for both to share the edge.
- The panel no longer counts the groups a selection is in. `Remove from`
  already lists exactly those groups, so the count was a second way of saying
  the same thing — and it was what made the panel too wide to fit beside the
  toolbar.

## 0.4.0

The link is the diagram, and the back button undoes it.

### Breaking

- **`?groups=` and `?memos=` changed shape.** They carried the whole set and
  replaced `groups.json` / `memos.json`; they now carry only the difference,
  keyed by id, with a tombstone list for deletions. A link made by 0.3.0 or
  earlier still opens, and its schema edits, positions and colours still apply
  — but its **group and memo edits are ignored**, and what the deploy ships is
  shown instead. There is no fallback: rebuild the link, or pin the arrangement
  into the sidecar files with 0.3.0's `erd from-link` before upgrading.
- **`erd from-link` needs the deployed sidecars to be in `--output-dir`.** A
  link no longer carries the whole set, so reproducing `groups.json` and
  `memos.json` means applying its difference to the files that were on screen
  when it was made — which in the documented workflow are already there, from
  the build or a previous `from-link`. Records the link never mentions survive
  it; before, they would have been deleted. A link from 0.3.0 or earlier is
  refused with a message rather than misread.
  - `layout.json` is missing from that sentence because it was missing from the
    code: it kept being written from the link alone, which deleted the position
    of every table the link did not mention. Fixed in 0.4.2 — **all three files
    are merged.**
- The browser-storage working copies (`crowfoot:tableLayout`, `crowfoot:memos`,
  `crowfoot:groups`, and their `erdkit:` / `liam:` ancestors) are no longer read
  at all, and are deleted the first time an edit is made. An arrangement that
  only ever existed in one browser and was never copied into a link or a
  sidecar file is **gone**. Nothing that was shared is affected.

### Added

- **The back button is undo, and forward is redo** — `Cmd`/`Ctrl` + `Z` and
  `Cmd`/`Ctrl` + `Shift` + `Z` as well. Every edit is already the whole of the
  diagram's state written into the link, so the state before an edit is simply
  the entry before it: there is no separate history to keep in step, and redo
  costs nothing. Typing into a memo writes over the current entry rather than
  adding one per character, and commits the sentence when you leave the field.
  Inside a memo `Cmd`+`Z` is still the browser undoing text.
- **The viewer says when a link's edits were written against a different
  deploy.** `?base=` records which documents an edit was made against, and a
  mismatch raises a notice naming what the edits refer to that has since gone:
  a group's table that is no longer in the schema, a deletion with nothing left
  to delete. The edits are still applied.
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

### Changed

- **A link carries only what it changed.** `?groups=` and `?memos=` used to
  carry the entire set and replace what `groups.json` and `memos.json` said, so
  touching one group meant a redeployed sidecar could never reach anyone
  holding that link again. They now carry the difference — including a
  tombstone for a deletion, which is the part a plain merge could not express —
  and `?positions=` drops entries that say what `layout.json` already says.
- **An edit lives in the link and nowhere else.** Browser storage used to hold
  a third copy of the diagram alongside the canvas and the URL; it now holds
  only a copy of the deployed files, used to describe the mismatch above, and
  is not touched at all on a plain load. Working copies written by releases up
  to 0.3.0 are cleared the first time an edit is made. `crowfootLayout.reset()`
  and friends drop the edit out of the link, which is the equivalent act.
- **Selecting a group and selecting the tables in it are two different
  things.** Clicking a group's label selects the group; double-clicking steps
  inside and hands you its tables, as does clicking any of them directly. They
  used to be one act — the label put every member into the selection — so
  nothing on screen could say which one a command was about to apply to, and
  `Cmd`+`Shift`+`G` quietly did nothing whenever a group was what you had in
  mind.
- Going back no longer re-runs the automatic layout or moves the camera. It
  restored the diagram by rearranging it, which is not what going back means.

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
