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

// dictionary_entries is deliberately ungrouped: it has no foreign key at all, so the
// viewer corrals it into its own built-in "non-related tables" group and ignores any
// position given here. Grouping it anyway stretches its box across the whole canvas.
const grouped = new Set(groups.flatMap((g) => g.tables))
const missing = groups.flatMap((g) => g.tables).filter((t) => !schema.tables[t])
if (missing.length) {
  console.error(`grouped tables not in the schema: ${missing.join(', ')}`)
  process.exit(1)
}
const ungrouped = Object.keys(schema.tables).filter((t) => !grouped.has(t))

// The viewer parks that non-related group at a low x of its own choosing, so the
// grouped columns start clear of it. Without the offset the orphan lands inside
// whichever group happens to own that x.
const X0 = 3100
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

const CARD_W = 1560
const CARD_GAP = 120
const col = (i) => X0 + i * (CARD_W + CARD_GAP)
let seq = 0
const memo = (text, x, y, width, h, color, fontSize) => ({
  id: `d0000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
  text, x, y, width, height: h, color, fontSize,
})

const memos = [
  memo(
    'crowfoot — a demo\n\n' +
      'This is the database behind nivoca, a Japanese vocabulary app.\n' +
      'The version drawn here is its legacy build: Next.js + Supabase, shipped as a PWA.\n' +
      'The app has since been rebuilt on Flutter with a Kotlin/Spring backend, and this\n' +
      'earlier codebase was opened as github.com/Junjak-Personal/nivoca-legacy.\n\n' +
      '23 tables · 27 foreign keys, parsed straight from 37 Supabase migration files:\n' +
      "    npx crowfoot erd build --input 'migrations/*.sql' --format postgres",
    col(0), -1180, CARD_W * 2 + CARD_GAP, 620, 'vermilion', 40),

  memo(
    'Everything you see is editable\n\n' +
      'Add ?edit=1 to the URL. Without it the diagram is read-only on purpose, so a\n' +
      'link you share cannot be rearranged by whoever opens it.\n\n' +
      'Drag tables to move them. Drag across empty canvas — or Ctrl/Cmd-click — to\n' +
      'select several at once, then move, tint or delete them together.',
    col(0), -480, CARD_W, 420, 'sky', 32),

  memo(
    'Grouping\n\n' +
      'Select the tables you want, right-click one of them, and choose to group them.\n' +
      'A named, tinted box is drawn behind the members — the box is derived from where\n' +
      'they sit, so it follows them. Drag the group label to move the whole set.\n\n' +
      'A table may belong to more than one group. The toolbar switches between group\n' +
      'view and a plain alphabetical list without touching the data.',
    col(1), -480, CARD_W, 420, 'gold', 32),

  memo(
    'Memos and colour\n\n' +
      'Ctrl/Cmd + right-click empty canvas to drop a memo like this one. Memos resize,\n' +
      'recolour, change font size, and copy-paste — including into another browser tab.\n\n' +
      'Tables, memos and groups all take a tint from the same 12-colour palette, so the\n' +
      'diagram stays consistent with the app it documents.',
    col(2), -480, CARD_W, 420, 'orange', 32),

  memo(
    'Making an arrangement permanent\n\n' +
      'Your layout lives in the URL, which makes it shareable but not durable. Copy the\n' +
      '?edit=1 URL and turn it into files the viewer loads on every visit:\n\n' +
      "    npx crowfoot erd from-link --input '<the URL>' --output-dir dist\n\n" +
      'That writes layout.json, memos.json and groups.json next to schema.json. Commit\n' +
      'them, and this arrangement is what everyone sees — this demo included.',
    col(0), 1180, CARD_W * 2 + CARD_GAP, 520, 'green', 32),

  memo(
    'Where this runs\n\n' +
      'A static site: no server, no database connection. crowfoot parses the schema once\n' +
      'and emits HTML, CSS and JSON you can host anywhere — S3, nginx, GitHub Pages.\n' +
      'This page is nginx on a mini PC behind a Cloudflare tunnel.\n\n' +
      'github.com/Junjak-Personal/crowfoot   ·   npm i -g crowfoot',
    col(2), 1180, CARD_W, 520, 'steel', 32),
]

const write = (name, data) =>
  writeFileSync(join(outDir, name), `${JSON.stringify(data, null, 2)}\n`)

write('layout.json', layout)
write('groups.json', groups.map(({ id, name, color, tables }) => ({ id, name, color, tableNames: tables })))
write('memos.json', memos)

console.info(`${Object.keys(layout).length} tables positioned across ${groups.length} groups`)
if (ungrouped.length) console.info(`ungrouped (drawn by the viewer's own group): ${ungrouped.join(', ')}`)
