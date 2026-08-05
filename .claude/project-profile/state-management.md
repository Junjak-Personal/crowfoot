# State Management

## Library
- **No external store library.** No Redux, Zustand, Jotai, or Pinia anywhere on the fork's work surface.
- Stack: **React Context + `useState`/`useCallback`** for local state, **`nuqs` 2.4.3** for anything
  that must survive a reload or be shareable via link.
- Store types: two providers in `frontend/packages/erd-core/src/stores/`.

## Store Patterns

### Pattern 1: `userEditing` — URL-synchronized view state
- Scope: app-wide (wraps the ERD renderer)
- Lifecycle: persistent for the page; **state lives in the URL**, not in memory
- Files: `src/stores/userEditing/{context.ts, Provider.tsx, hooks.ts, index.ts}`
- Reference: `frontend/packages/erd-core/src/stores/userEditing/Provider.tsx`

The provider splits its value into two labelled groups — copy this shape:
```
// URL synchronized state
activeTableName, showMode, hiddenNodeIds, tablePositions, tableColors, memoEntries, editMode
// Local state
selectedNodeIds, isPopstateInProgress, showDiff
```

### Pattern 2: `schema` — injected read-only data
- Scope: app-wide; the parsed schema handed in by the host (CLI viewer / Next.js app)
- Files: `src/stores/schema/{context.ts, SchemaProvider.tsx, hooks.ts, index.ts}`

## URL-state rules (the fork's core mechanic)

Custom `nuqs` parsers wrap every non-trivial param — **do not put raw JSON in the URL**:

| Parser | Used by | Why |
|---|---|---|
| `parseAsCompressedStringArray` | `hidden`, `positions`, `colors` | pako-deflate + URL-safe base64, then comma-joined |
| `parseAsCompressedString` | `memos` | one compressed JSON blob — memo text is free-form and the array parser's `split(',')` would shred it |
| `parseAsShowMode` | `show` | maps short public values `all\|table\|key` ⇄ internal `ALL_FIELDS\|TABLE_NAME\|KEY_ONLY` |

**History mode is a deliberate choice, not a default:**
- `history: 'push'` — user *navigation* (`active`, `show`, `hidden`)
- `history: 'replace'` — user *editing* (`positions`, `colors`, `memos`). Editing must not fill the back button.

**Edit gate:** `editMode` is derived, never stored — `editParam === '1' || editParam === 'true'`.
Every mutating interaction must check it. Read-only is the default so a shared link cannot be
rearranged by accident.

**Encoding is URL-safe base64** (`+`→`-`, `/`→`_`, `=` stripped) — verified lossless through
CloudFront query-string reassembly.

## Persistence precedence (table positions / memos)
```
URL (?positions=)  >  localStorage  >  layout.json (shipped with build)  >  ELK auto-layout
```
Unpinned tables always fall through to ELK, so **a newly added table never breaks an existing layout**.
ELK runs with `nodePlacement/layering: INTERACTIVE`, so seeded coordinates are honoured as placement hints.
`localStorage` key namespace: **`erdkit:*`** (`erdkit:tableLayout`, `erdkit:memos`,
`erdkit:groups`). These were `liam:*` up to 0.4.0; a value under an old key is moved to the new one
on first read and the old key deleted — `.../utils/storage/storage.ts`, shared by all three modules.
Any reset must clear **both** names or the migration resurrects the old value.

Implementations: `src/features/erd/utils/tableLayout/tableLayout.ts` · `.../utils/memo/memo.ts` ·
`.../utils/group/group.ts` · `.../utils/storage/storage.ts`

## Reactivity Rules
- `useCallback` on every handler passed through context (the provider value is a fresh object each
  render; unstable callbacks would cascade re-renders across the canvas)
- `useExhaustiveDependencies` is a **lint error** — dep arrays are enforced
- `useEffect` is used only for genuine external subscriptions (`hashchange` listener) and prop→state
  sync. Prefer event/callback triggers over effects.
- Set-typed state (`selectedNodeIds: Set<string>`) is always replaced with a **new `Set`**, never mutated

## Cross-Store Dependencies
- `userEditing` and `schema` are independent; components consume both via hooks and compose in the view layer.
- Anti-pattern to avoid: writing derived data back into the URL. Derive it (like `editMode`) instead.
