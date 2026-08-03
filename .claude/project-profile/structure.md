# Project Structure

## Directory Layout

```
liam-custom/
├── frontend/
│   ├── apps/
│   │   ├── app/            @liam-hq/app        Next.js 15 web app (upstream — fork does NOT touch)
│   │   ├── docs/           @liam-hq/docs       docs site (upstream)
│   │   ├── assets/                             shared static assets
│   │   └── erd-sample/     @liam-hq/erd-sample smoke target: builds an ERD from mastodon schema.rb
│   ├── packages/
│   │   ├── cli/            @liam-hq/cli        ★ the publishable CLI (src = ~1,440 lines)
│   │   ├── erd-core/       @liam-hq/erd-core   ★ the ERD viewer (React + xyflow)
│   │   ├── schema/         @liam-hq/schema     ★ parsers + deparsers (incl. fork's MySQL deparser)
│   │   ├── ui/             @liam-hq/ui         design system (Radix + CSS Modules + tokens)
│   │   └── db-structure/
│   └── internal-packages/
│       ├── agent/  db/  github/  mcp-server/  security/  pglite-server/
│       ├── configs/        @liam-hq/configs    shared biome/tsconfig/eslint presets
│       ├── e2e/            @liam-hq/e2e        Playwright — targets the Next.js app (upstream)
│       ├── storybook/  schema-bench/  neverthrow/  figma-to-css-variables/
├── docs/
│   └── fork/HANDOFF.md     ★ fork-only handoff. `docs/` otherwise is upstream docs — do not mix.
├── .github/workflows/      upstream CI (17 workflows) — mostly inert for the fork
├── NOTICE                  ★ Apache-2.0 §4(d) attribution + change summary — keep in sync
├── LICENSE                 Apache-2.0
├── biome.jsonc  turbo.json  vitest.config.ts  lefthook.yml  knip.jsonc  .syncpackrc
└── pnpm-workspace.yaml  .npmrc  .node-version
```

## Fork work surface (read this before touching anything)

The fork's 40 changed files live in **exactly three packages**. Everything else is inherited upstream code.

| Package | Fork's role |
|---|---|
| `frontend/packages/erd-core` | Table-position persistence, memos, colour coding, edit mode, `?show=` param, MySQL entry in export menu |
| `frontend/packages/schema` | `src/deparser/mysql/` — the MySQL DDL deparser (new) |
| `frontend/packages/cli` | `src/App.tsx` — wires `layout.json` / `memos.json` into the viewer |

`git diff --stat 92156eac5..HEAD` is the authoritative list of what the fork owns.

### 🔴 Apache-2.0 file-header convention (MANDATORY — §4(b))

Every file the fork touches carries a header. **Agents MUST add it when creating or modifying files here.**

Modified upstream file (TS/TSX):
```ts
// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
```
New fork-only file:
```ts
// Added in liam-custom; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
```
CSS uses the same text in a `/* … */` block. When the *nature* of a change changes, update the
numbered change summary in `NOTICE` too.

## Routing Pattern
- **Fork surface**: no router. The viewer is a single-page canvas; **URL query params are the state
  transport** (`?positions=`, `?colors=`, `?memos=`, `?hidden=`, `?active=`, `?show=`, `?edit=`).
- Upstream `frontend/apps/app`: Next.js App Router (`app/` dir, `[id]` dynamic segments) — out of scope.
- Artifact paths are all relative (`./assets/…`, `fetch("./schema.json")`), so the build mounts under any
  subpath (e.g. `/erd/`) **without a rebuild**.

## Module Organization (erd-core — the pattern to mirror)
```
src/
├── features/<feature>/          # erd, diff, gtm, reactflow
│   ├── components/<Component>/  # PascalCase dir: Component.tsx + Component.module.css + index.ts
│   ├── hooks/
│   ├── utils/<util>/            # util.ts + util.test.ts + index.ts  ← fork's new logic lives here
│   └── types.ts
├── stores/<store>/              # context.ts + Provider.tsx + hooks.ts + index.ts
├── schemas/                     # valibot schemas (queryParam, hash, showMode, version)
├── styles/                      # globals.css, variables.css
├── hooks/  providers/  utils/  types/
└── index.ts                     # package entry, re-exports
```
- Page logic: N/A (no pages in the fork surface)
- Shared components: `@liam-hq/ui`
- Utilities: `src/features/<feature>/utils/<name>/` — **one directory per util, with a colocated test and an `index.ts`**
- Types: `src/features/<feature>/types.ts` or colocated with the module

## Naming Conventions
- Directories (components): `PascalCase/` (`MemoLayer/`, `ViewColorMenu/`, `TableNode/`)
- Directories (utils/features/stores): `camelCase/` (`tableLayout/`, `viewColor/`, `userEditing/`)
- Component files: `PascalCase.tsx` + `PascalCase.module.css` (+ generated `PascalCase.module.css.d.ts`)
- Util files: `camelCase.ts`
- Barrels: every module dir has an `index.ts` re-exporting the public surface (named exports only)
- Tests: `*.test.ts` / `*.test.tsx`, **colocated** next to the subject (no `__tests__/`)
- Providers: `Provider.tsx` (erd-core) — note `stores/schema/` uses `SchemaProvider.tsx`; prefer the
  local convention of the store you are editing
