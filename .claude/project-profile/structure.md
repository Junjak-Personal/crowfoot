# Project Structure

## Directory Layout

```
crowfoot/
├── frontend/
│   ├── apps/
│   │   ├── app/            @liam-hq/app        Next.js 15 web app (upstream — fork does NOT touch)
│   │   ├── docs/           @liam-hq/docs       docs site (upstream)
│   │   ├── assets/                             shared static assets
│   │   └── erd-sample/     @liam-hq/erd-sample smoke target; depends on `crowfoot` via workspace:*
│   ├── packages/
│   │   ├── cli/            crowfoot            ★ the publishable CLI
│   │   ├── erd-core/       @liam-hq/erd-core   ★ the ERD viewer (React + xyflow)
│   │   ├── schema/         @liam-hq/schema     ★ parsers + deparsers (incl. fork's MySQL deparser)
│   │   ├── ui/             @liam-hq/ui         ★ design system (Radix + CSS Modules + tokens)
│   │   └── db-structure/
│   └── internal-packages/
│       ├── agent/  db/  github/  mcp-server/  security/  pglite-server/
│       ├── configs/        @liam-hq/configs    shared biome/tsconfig/eslint presets
│       ├── e2e/            @liam-hq/e2e        Playwright — targets the Next.js app (upstream)
│       ├── storybook/  schema-bench/  neverthrow/  figma-to-css-variables/
├── _docs/                  ★ fork's project docs — plans, specs, handoff. Start at `_docs/index.md`.
├── _note/                  human-owned scratch notes — agent READ-ONLY
├── docs/                   upstream documentation — do NOT add fork docs here.
│                           Two exceptions the fork owns and may edit: `usage.md` and `usage_en.md`.
│                           Everything else in `docs/` is upstream's.
├── .github/workflows/      7 workflows — `release-crowfoot.yml` is the fork's; rest inherited
├── NOTICE                  ★ Apache-2.0 §4(d) attribution + numbered change summary — keep in sync
├── LICENSE                 Apache-2.0
├── biome.jsonc  turbo.json  vitest.config.ts  lefthook.yml  knip.jsonc  .syncpackrc
└── pnpm-workspace.yaml  .npmrc  .node-version
```

No `.gitmodules` — this is a plain monorepo, not a submodule-monorepo. `submodule-worktree` does not apply.

## Fork work surface (read this before touching anything)

**Base commit: `f4dd6c4`** ("Liam ERD at 92156eac5, the base this fork was taken from") — the squashed
upstream root left by the 2026-08-06 history rewrite. `git diff f4dd6c4..HEAD` is the authoritative
list of what the fork owns: **110 files, ~7,200 insertions**, across 42 total commits.

| Package | Fork's role |
|---|---|
| `frontend/packages/erd-core` | Table-position persistence, memos, colour coding, grouping, edit mode, `?show=` param, MySQL export entry, **app debranding** |
| `frontend/packages/schema` | `src/deparser/mysql/` — the MySQL DDL deparser (new) |
| `frontend/packages/cli` | `src/App.tsx` wiring, banner, urls, init command, **favicon + brand colour** |
| `frontend/packages/ui` | `src/logos/CrowfootLogoMark.tsx` — the fork's own mark |

Everything else is inherited upstream code. `frontend/apps/app` (Next.js + Supabase) is upstream and
out of scope — if a task reaches it, **stop and re-scan** rather than assuming this profile applies.

### 🔴 Apache-2.0 — attribution (§4) and trademark (§6) pull in OPPOSITE directions

This is the single most dangerous thing to get wrong in this repo.

**§4(b) headers are MANDATORY and must survive.** Every file the fork creates or modifies carries one
(currently **92 files**). Agents MUST add it when creating or modifying a file here.

Modified upstream file (TS/TSX):
```ts
// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
```
New fork-only file:
```ts
// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
```
CSS uses the same text in a `/* … */` block. When the *nature* of a change shifts, update the numbered
change summary in `NOTICE` too.

> **A blanket "Liam" find-and-replace turns a §6 cleanup into a §4 violation** — it would strip those
> headers. **Branding gets removed; attribution stays.** `LICENSE`, `NOTICE`,
> `docs/packages-license.md` and `scripts/pack-cli.js` are preserved for the same reason.
>
> The `erdkit` → `crowfoot` rename was safe for the opposite reason: the §4 wording never contained
> that word. **Do not generalise from it.**

Legitimate remaining `Liam` references, all of which must stay:
attribution headers · banner + `--help` attribution strings · upstream doc links that are still
accurate (labelled `(upstream)`) · upstream issue citations in `schema` parser comments.

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
- Directories (components): `PascalCase/` (`MemoNode/`, `ViewColorMenu/`, `TableNode/`)
- Directories (utils/features/stores): `camelCase/` (`tableLayout/`, `viewColor/`, `userEditing/`)
- Component files: `PascalCase.tsx` + `PascalCase.module.css` (+ generated `PascalCase.module.css.d.ts`)
- Util files: `camelCase.ts`
- Barrels: every module dir has an `index.ts` re-exporting the public surface (named exports only)
- Tests: `*.test.ts` / `*.test.tsx`, **colocated** next to the subject (no `__tests__/`)
- Providers: `Provider.tsx` (erd-core) — note `stores/schema/` uses `SchemaProvider.tsx`; prefer the
  local convention of the store you are editing

## Known config defect (flagged, not fixed)
`turbo.json:33` still declares **`"@liam-hq/cli#dev"`**, but that package was renamed to `crowfoot`.
The key is dead: its `dependsOn: ["build"]` no longer binds, so the CLI's dev task falls through to the
generic `dev` task with no build dependency. Partially masked because the package's own `dev` script
runs `pnpm command:build` first. **One-line fix, deliberately left for the owner to schedule.**
