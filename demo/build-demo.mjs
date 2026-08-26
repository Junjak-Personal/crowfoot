#!/usr/bin/env node
// Regenerates the sidecar files behind https://crowfoot.jun-devlog.win.
//
//   node demo/build-demo.mjs <path-to-schema.json> [outDir]
//
// The committed layout.json / groups.json / memos.json are this script's output.
// They are committed as well as generated because they are the demo — losing them
// means arranging 23 tables by hand again.
//
// Positions are computed rather than hand-placed so the demo survives a schema
// change: add a table to a group below and re-run.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [, , schemaPath, outDir = 'demo'] = process.argv
if (!schemaPath) {
  console.error('usage: node demo/build-demo.mjs <path-to-schema.json> [outDir]')
  process.exit(1)
}
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))

// Node geometry as the viewer renders it at show=all — a fixed header plus one row
// per column. Measured off the built viewer; if the table styling changes, these
// two numbers are what drift.
const W = 340
const HEADER = 52
const ROW = 34
const height = (t) => HEADER + Object.keys(schema.tables[t].columns).length * ROW

const groups = [
  { id: 'vocab', name: 'Vocabulary', color: 'sky', tables: ['words', 'word_examples', 'wordbooks', 'wordbook_items', 'wordbook_subscriptions', 'user_word_state'] },
  { id: 'kanji', name: 'Kanji', color: 'teal', tables: ['kanjis', 'kanji_readings'] },
  { id: 'ai', name: 'AI Chat', color: 'orange', tables: ['ai_sessions', 'ai_messages', 'ai_tool_executions', 'ai_telemetry'] },
  { id: 'study', name: 'Study & Quiz', color: 'gold', tables: ['quiz_settings', 'study_progress', 'daily_stats', 'achievements'] },
  { id: 'user', name: 'User', color: 'green', tables: ['user_settings', 'user_subscription'] },
  { id: 'ops', name: 'Notifications & Ops', color: 'steel', tables: ['push_tokens', 'push_subscriptions', 'api_rate_limits', 'feedback_survey'] },
]

// dictionary_entries is left ungrouped because it belongs with nothing here, not
// because it cannot be placed. It has no foreign key, and up to 0.7.1 the viewer
// corralled such tables into a built-in group and read their positions in that
// group's frame — so a coordinate written here landed somewhere else. It no longer
// does: a table leaves that group the moment something places it.
const grouped = new Set(groups.flatMap((g) => g.tables))
const missing = groups.flatMap((g) => g.tables).filter((t) => !schema.tables[t])
if (missing.length) {
  console.error(`grouped tables not in the schema: ${missing.join(', ')}`)
  process.exit(1)
}
const ungrouped = Object.keys(schema.tables).filter((t) => !grouped.has(t))

// The origin. This used to be 3100, to clear the band the viewer parked its
// built-in group of relationship-less tables in — that group is empty now that
// every table here is placed, so there is nothing to clear.
const X0 = 0
// A gap narrower than twice the app's own group-box padding makes neighbouring
// boxes visibly overlap. 340 was arrived at by looking at the rendered result.
const GROUP_GAP = 340
const GX = 40
const GY = 40

const layout = {}
let x = X0
for (const g of groups) {
  // Three or fewer tables read better in one column; two columns leaves a wide,
  // mostly empty box.
  const twoCol = g.tables.length > 3
  const left = []
  const right = []
  g.tables.forEach((t, i) => (twoCol && i % 2 ? right : left).push(t))

  let ly = 0
  let ry = 0
  for (const t of left) {
    layout[t] = { x, y: ly }
    ly += height(t) + GY
  }
  for (const t of right) {
    layout[t] = { x: x + W + GX, y: ry }
    ry += height(t) + GY
  }
  x += (right.length ? W * 2 + GX : W) + GROUP_GAP
}

// Ungrouped tables get a column of their own, past the last group. They used to
// get no coordinate at all — the viewer would not have honoured one — so the
// only thing that placed them was the viewer's own built-in group.
for (const [i, t] of ungrouped.entries()) {
  layout[t] = { x, y: i * (height(t) + GY) }
}
if (ungrouped.length) x += W + GROUP_GAP

const CARD_W = 1560
const CARD_GAP = 120
const col = (i) => X0 + i * (CARD_W + CARD_GAP)
let seq = 0
const memo = (text, x, y, width, h, color, fontSize) => ({
  id: `d0000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
  text, x, y, width, height: h, color, fontSize,
})

// A line wider than about 79 characters wraps at font size 32, and a card fits
// roughly its height divided by 59 lines. Both were read off the rendered page,
// which is also the only way to check them — see the README.
const memos = [
  memo(
    'crowfoot — a demo\n\n' +
      'This is the database behind nivoca, a Japanese vocabulary app.\n' +
      'The version drawn here is its legacy build: Next.js + Supabase, shipped as a PWA.\n' +
      'The app has since been rebuilt on Flutter with a Kotlin/Spring backend, and this\n' +
      'earlier codebase was opened as github.com/Junjak-Personal/nivoca-legacy.\n\n' +
      '23 tables · 27 foreign keys, parsed straight from 37 Supabase migration files:\n' +
      "    npx crowfoot erd build --input 'migrations/*.sql' --format postgres",
    col(1), -1320, CARD_W * 2 + CARD_GAP, 620, 'vermilion', 40),

  memo(
    'Edit mode\n\n' +
      'Press Edit in the header — or add ?edit=1 to the URL. Without it the diagram is\n' +
      'read-only, so a link you share cannot be rearranged by whoever opens it.\n\n' +
      'Drag tables to move them. Drag across empty canvas to select several, and add to\n' +
      'that selection with Shift-click — Cmd-click on a Mac, Ctrl-click on Windows.\n' +
      'Whatever is selected moves, takes a colour and is deleted together.',
    col(0), -620, CARD_W, 520, 'sky', 32),

  memo(
    'Grouping\n\n' +
      'Select the tables you want and press Cmd/Ctrl + G. A named, tinted box is drawn\n' +
      'behind the members — it is derived from where they sit, so it follows them. Drag\n' +
      'the group label to move the whole set. Cmd/Ctrl + Shift + G ungroups, and asks\n' +
      'before it does.\n\n' +
      'A table may belong to more than one group. The toolbar switches between group\n' +
      'view and a plain alphabetical list without touching the data.',
    col(1), -620, CARD_W, 520, 'gold', 32),

  memo(
    'Memos and colour\n\n' +
      'Ctrl/Cmd + right-click empty canvas to drop a memo like this one. Memos resize,\n' +
      'recolour, change font size, and copy-paste — including into another browser tab.\n\n' +
      'Tables, memos and groups all take a tint from the same 12-colour palette, so the\n' +
      'diagram stays consistent with the app it documents.',
    col(2), -620, CARD_W, 520, 'orange', 32),

  memo(
    'Changing the schema\n\n' +
      "In edit mode the panel on the right becomes a form: a table's name, comment,\n" +
      'columns, keys, indexes and checks. Tables can be added and removed too.\n\n' +
      'Ctrl/Cmd + right-click a table, pick many : 1, 1 : 1, 1 : many or many : many,\n' +
      'then click the table to connect it to — many : many builds the join table.\n\n' +
      'Nothing here rearranges the diagram, and the DDL export reflects every edit.',
    col(3), -620, CARD_W, 520, 'teal', 32),

  memo(
    'Making an arrangement permanent\n\n' +
      'Your layout lives in the URL, which makes it shareable but not durable. Copy the\n' +
      'edit-mode URL and turn it into files the viewer loads on every visit:\n\n' +
      "    npx crowfoot erd from-link --input '<the URL>' --output-dir dist\n\n" +
      'That writes layout.json, memos.json and groups.json next to schema.json. Commit\n' +
      'them, and this arrangement is what everyone sees — this demo included.\n\n' +
      'Schema edits stay in the link on purpose. A diagram is a view of a real schema:\n' +
      'regenerate schema.json from the source rather than pinning an edited copy.',
    col(0), 1180, CARD_W * 2 + CARD_GAP, 660, 'green', 32),

  memo(
    'Where this runs\n\n' +
      'A static site: no server, no database connection. crowfoot parses the schema once\n' +
      'and emits HTML, CSS and JSON you can host anywhere — S3, nginx, GitHub Pages.\n' +
      'This page is nginx on a mini PC behind a Cloudflare tunnel.\n\n' +
      'The sidecar files and the script that generates them are in the repository under\n' +
      'demo/, so this arrangement survives the server it happens to be served from.\n\n' +
      'github.com/Junjak-Personal/crowfoot   ·   npm i -g crowfoot',
    col(2), 1180, CARD_W * 2 + CARD_GAP, 560, 'steel', 32),
]

const write = (name, data) =>
  writeFileSync(join(outDir, name), `${JSON.stringify(data, null, 2)}\n`)

write('layout.json', layout)
write('groups.json', groups.map(({ id, name, color, tables }) => ({ id, name, color, tableNames: tables })))
write('memos.json', memos)

console.info(`${Object.keys(layout).length} tables positioned across ${groups.length} groups`)
if (ungrouped.length) console.info(`in no group, placed in a column of their own: ${ungrouped.join(', ')}`)
