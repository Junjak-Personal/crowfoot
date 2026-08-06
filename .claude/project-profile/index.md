# Project Profile — crowfoot

> Generated: 2026-08-03
> Last updated: 2026-08-06 (full regeneration)
> Profile-Generated-At: `04dff30`
> Branch: `master` · working tree clean at generation time

## What this repo is

A **fork of [Liam ERD](https://github.com/liam-hq/liam)** (ROUTE06, Inc., Apache-2.0), taken from
upstream `92156eac5` (2026-06-18) and **not tracking upstream**. It adds six things to the ERD viewer:
persisted table positions, canvas memos, colour coding, table grouping, an explicit `?edit=1` edit
mode, and MySQL DDL export. It ships to npm as **`crowfoot`** and its first consumer is the carbon
project's ERD at https://carbon-stage.qesg.co.kr/erd/.

The repo is now **standalone** — `Junjak-Personal/crowfoot`, public, `isFork: false`, default branch
`master`. History was rewritten 2026-08-06: upstream's 11,849 commits are squashed into one root
(`f4dd6c4`) with the fork's own commits replayed on top (42 total). The old `Junjak-Personal/erdkit`
repo is kept archived as the provenance record.

Fork-only project docs live in **`_docs/`** (start at `_docs/index.md`). `docs/` is upstream's and
takes no new fork docs — **except `docs/usage.md` and `docs/usage_en.md`, which the fork owns**.

## Quick Summary
- **Stack**: TypeScript 5.9.3 + React 19 + Vite/Rollup (static SPA) — pnpm/Turborepo monorepo
- **Package manager**: pnpm 10.18.3 (Node 22.21.0, `save-exact=true`)
- **Test framework**: Vitest 3.2.4 (unit/component) · Playwright 1.56.1 (E2E, upstream app only)
- **State management**: React Context + `nuqs` URL params — **no store library**
- **API layer**: no HTTP API — a file-based parse/deparse contract (`@liam-hq/schema`)
- **CI/CD**: 7 GitHub Actions workflows; the fork's own is `release-crowfoot.yml` (tag → npm, OIDC)

## Profile Files

Relevance: REQUIRED (always read) > HIGH (read if related) > MEDIUM (optional) > SKIPPED

| File | Relevance | Status | Contents |
|------|-----------|--------|----------|
| [stack.md](./stack.md) | REQUIRED | ✅ | Runtime, deps, **fresh-clone bootstrap**, authoritative build/verify commands |
| [structure.md](./structure.md) | REQUIRED | ✅ | Layout, **fork work surface**, **§4-vs-§6 rule**, naming, known config defect |
| [code-style.md](./code-style.md) | HIGH | ✅ | Biome config, imports, naming, enforced lint rules |
| [api-layer.md](./api-layer.md) | HIGH | ✅ | Parser/deparser contract, CLI ingest, codegen (no HTTP client) |
| [state-management.md](./state-management.md) | MEDIUM | ✅ | Context + nuqs, URL encoding, **2-hop storage migration** |
| [testing.md](./testing.md) | HIGH | ✅ | Vitest/Playwright, **verified baseline**, agentic adapter, browser traps |
| [ui-components.md](./ui-components.md) | MEDIUM | ✅ | `@liam-hq/ui`, CSS Modules, tokens, **brand mark + colour** |
| [deployment.md](./deployment.md) | MEDIUM | ✅ | Trusted-Publishing release, CloudFront traps, carbon delivery |

## Key Conventions for Agents

1. **🔴 §4 attribution and §6 trademark pull in OPPOSITE directions.** Per-file
   `// Modified from the original Liam ERD source…` headers (92 files) are **required by §4(b)** — a
   blanket "Liam" find-and-replace would strip them and turn a branding cleanup into a licence
   violation. **Branding gets removed; attribution stays.** The `erdkit`→`crowfoot` rename was safe
   only because §4's wording never contained that word — do not generalise from it.
   Add the header to any file you create or modify. Detail: `structure.md`.
2. **🔴 A fresh clone needs a build before tests will even collect.** `pnpm install` alone leaves 27
   test files failing on `Failed to resolve entry for package "@liam-hq/schema"` — that is a missing
   `dist`, not a regression. Run `pnpm exec turbo build --filter=@liam-hq/schema --filter=@liam-hq/ui`.
3. **Stay on the fork's work surface**: `packages/{erd-core, schema, cli, ui}`. `frontend/apps/app`
   (Next.js + Supabase) is upstream and out of scope — if a task reaches it, stop and re-scan.
4. **Verify with the authoritative commands, per package.** There is **no root `tsconfig.json`**, so
   root `tsc --noEmit` is vacuous — use `pnpm --filter <pkg> exec tsc --noEmit`. Baseline (macOS,
   `04dff30`): `schema` **562**, `erd-core` **303 + 4 todo**, `crowfoot` **31**, typecheck **0**, root
   `pnpm lint` **exit 0**. Gate on net-new, never on absolutes. `pnpm lint:stylelint` is **not** in the
   gate and is **not** clean (79 findings) — do not chase it.
5. **Named exports only, `const` arrow functions, `handle*` for event handlers.** No default exports.
   No backward-compat shims — update all call sites together.
6. **CSS Modules + `pnpm gen:css`.** Adding a class without regenerating `*.module.css.d.ts` surfaces
   as `TS2307 Cannot find module './X.module.css'` — a stale generated file, not a type error.
   Colours come from `@liam-hq/ui` design tokens — never a raw hex.
7. **`console.log` fails lint** (`noConsole: error`; only `warn`/`error`/`info`/`debug`). So does an
   unknown CSS custom property and an incomplete hook dep array (`useExhaustiveDependencies: error`).
8. **URL is the state transport.** Use the existing `nuqs` parsers; `history: 'push'` for navigation,
   `'replace'` for editing. Gate every mutation on `editMode` — read-only is the default.
9. **Validate external data with Valibot; return `neverthrow` Results instead of throwing.**
10. **Exact versions only** (`save-exact=true`) — never write `^` or `~` into a `package.json`.
11. **Deleting a feature? Replace its test, don't just delete it.** House precedent applied twice —
    a deleted assertion removes the regression detector. Leave something that fails if it comes back.

## Known gotchas (all hit for real)
- `erd build --input <absolute path>` is parsed as a URL → `fetch failed`. **Relative paths only.**
- `dist/schema.json` (deploy this) ≠ the input `schema.json` (don't) — same name, different files.
- **`turbo build --filter=crowfoot` without `--force` can serve a stale bundle** — erd-core is consumed
  as TS source and is not in crowfoot's cache key.
- **A backgrounded browser tab stalls ResizeObserver** → blank canvas, `data-loading` stuck true.
  Check `document.visibilityState` before calling it a product defect.
- **Unit tests cannot reach CSS Modules** (not injected into happy-dom) — `pointer-events`, z-index and
  cursor are only verified as class names. Browser smoke is the only real check; 2 defects found that way.
- Windows: `crowfoot` shows 27 passed / 4 failed (`runPreprocess.test.ts`, `os.tmpdir()` absolute path
  parsed as URL) and the lefthook hook needs a **full** `pnpm install`. Watch `core.autocrlf`.
- tbls: DSN must be plain `mysql://` (strip `+pymysql` and query string); a `viewpoints.id` key makes
  the parser exit 1 with `ZodError: unrecognized_keys ["id"]`.

## Open items

Tracked as plans in `_docs/` — see `_docs/index.md` for current status.

- **Debranding, steps 6–8** (`_docs/active/processing/2026-08-05/2026-08-05-cli-distribution-debranding.md`)
  — app branding, links and favicon are **done**; what remains is removing unused upstream packages
  (dependency graph first — deleting them wholesale breaks root `pnpm lint`), the README attribution
  line, and a final §4 re-verification.
- **carbon delivery automation** (`_docs/active/planning/2026-08-03/2026-08-03-carbon-erd-delivery.md`)
  — blocked on ECR permissions.
- **No E2E coverage of any fork feature**; unit tests only. Tracked with six other items in
  `_docs/active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md`.
- **Owner-only, never delegated**: npm Trusted Publisher registration, `npm deprecate erdkit`,
  keeping the `erdkit` repo archived.
- **`turbo.json:33` has a dead `@liam-hq/cli#dev` key** — flagged in `structure.md`, one-line fix,
  left for the owner to schedule.

## Agent Loading Guide
- **All agents**: read this `index.md` (REQUIRED)
- **Read additional files when**: the file's relevance is REQUIRED/HIGH for your role, or your task
  touches that domain. All eight files are ✅ scanned-from-code — none are skipped.

## Changelog
- 2026-08-06: Full regeneration at `04dff30`. Previous profile was pinned to `d2fb6638c`, **a commit
  the history rewrite erased**. Corrected: repo is now standalone `Junjak-Personal/crowfoot` on
  `master` (was a branch of the old repo); 7 workflows not 17, and `release-crowfoot.yml` exists
  (the old profile said both publish workflows were deleted); npm publish is **done**, not blocked;
  test baseline re-measured on macOS (`crowfoot` is green at 31, not the 27/4 Windows figure);
  storage migration is a 2-hop chain; the §4-vs-§6 rule promoted to convention #1; fresh-clone
  build prerequisite added as convention #2.
