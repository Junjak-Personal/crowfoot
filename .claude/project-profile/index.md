# Project Profile — crowfoot

> Generated: 2026-08-03
> Last updated: 2026-08-06 (full regeneration after the upstream-package removal)
> Profile-Generated-At: `be485b4`
> Branch: `master` · working tree clean at generation time

## What this repo is

A **fork of [Liam ERD](https://github.com/liam-hq/liam)** (ROUTE06, Inc., Apache-2.0), taken from
upstream `92156eac5` (2026-06-18) and **not tracking upstream**. It adds six things to the ERD viewer:
persisted table positions, canvas memos, colour coding, table grouping, an explicit `?edit=1` edit
mode, and MySQL DDL export. It is packaged for npm as **`crowfoot`** — but see below: it is **not
published yet**.

The repo is standalone — `Junjak-Personal/crowfoot`, public, `isFork: false`, default branch `master`.
History was rewritten 2026-08-06: upstream's 11,849 commits are squashed into one root (`f4dd6c4`) with
the fork's own commits replayed on top. The old `Junjak-Personal/erdkit` repo is kept archived as the
provenance record.

**The monorepo now contains only what the CLI needs — 6 packages, down from 20.** There is no Next.js
app, no docs site, no Supabase layer, no AI agent, no Playwright harness, no storybook.

Project docs live in **`_docs/`** (start at `_docs/index.md`). `docs/` is upstream's and keeps only
four files — see `structure.md`.

## Quick Summary
- **Stack**: TypeScript 5.9.3 + React 19 + Vite/Rollup (static SPA) — pnpm/Turborepo monorepo
- **Package manager**: pnpm 10.18.3 (Node 22.21.0, `save-exact=true`)
- **Test framework**: Vitest 3.2.4 — **no E2E framework at all**
- **State management**: React Context + `nuqs` URL params — no store library
- **API layer**: no HTTP API — a file-based parse/deparse contract (`@crowfoot/schema`)
- **CI/CD**: 7 GitHub Actions workflows; the fork's own is `release-crowfoot.yml` (tag → npm, OIDC)

## Profile Files

Relevance: REQUIRED (always read) > HIGH (read if related) > MEDIUM (optional) > SKIPPED

| File | Relevance | Status | Contents |
|------|-----------|--------|----------|
| [stack.md](./stack.md) | REQUIRED | ✅ | The 6 packages, fresh-clone bootstrap, authoritative build/verify, `pnpm.overrides` |
| [structure.md](./structure.md) | REQUIRED | ✅ | Layout, **§4-vs-§6 rule**, naming, the `git rm` residue trap |
| [code-style.md](./code-style.md) | HIGH | ✅ | Biome config, imports, naming, enforced lint rules |
| [api-layer.md](./api-layer.md) | HIGH | ✅ | Parser/deparser contract, CLI ingest, codegen (no HTTP client) |
| [state-management.md](./state-management.md) | MEDIUM | ✅ | Context + nuqs, URL encoding, 2-hop storage migration |
| [testing.md](./testing.md) | HIGH | ✅ | Vitest baseline, **no E2E**, CI gap, browser traps |
| [ui-components.md](./ui-components.md) | MEDIUM | ✅ | 22 components (12 used / 10 held), brand mark + colour, restore recipe |
| [deployment.md](./deployment.md) | MEDIUM | ✅ | Trusted-Publishing release, env surface, repo hygiene findings |

## Key Conventions for Agents

1. **🔴 §4 attribution and §6 trademark pull in OPPOSITE directions.** The per-file
   `// Modified from the original Liam ERD source…` notices (**92 files**) are **required by §4(b)** —
   a blanket "Liam" find-and-replace strips them and turns a branding cleanup into a licence violation.
   **Branding is removed; attribution stays.** Count with BOTH wordings scoped to `frontend/packages`,
   or you get 43 and a false alarm. Detail: `structure.md`.
2. **🔴 A fresh clone needs a build before tests will collect.** `pnpm install` alone leaves test files
   failing on `Failed to resolve entry for package "@crowfoot/schema"` — a missing `dist`, not a
   regression. Run `pnpm exec turbo build --filter=@crowfoot/schema --filter=@crowfoot/ui`.
3. **🔴 `git rm` leaves directories behind.** Gitignored `*.module.css.d.ts` survive deletion, the
   directory persists, and knip then fails root lint on the residue. Sweep for zero-tracked-file
   directories after any removal — never with `git clean -xdf`. Recipe in `structure.md`.
4. **Verify per package with the authoritative commands.** There is **no root `tsconfig.json`**, so
   root `tsc --noEmit` is vacuous — use `pnpm --filter <pkg> exec tsc --noEmit`. Baseline (macOS,
   `be485b4`): `schema` **562**, `erd-core` **303 + 4 todo**, `cli` **31**, `ui` **30**, typechecks **0**,
   root `pnpm lint` **exit 0**, `turbo lint` **10 tasks**. Gate on net-new, never absolutes.
   ⚠️ CI runs only `erd-core` + `cli` tests — `schema` and `ui` are local-only.
5. **Named exports only, `const` arrow functions, `handle*` for event handlers.** No default exports.
   No backward-compat shims — update all call sites together.
6. **CSS Modules + `pnpm gen:css`.** A missing `*.module.css.d.ts` surfaces as `TS2307 Cannot find
   module './X.module.css'` — a stale generated file, not a type error. Colours come from
   `@crowfoot/ui` design tokens — never a raw hex.
7. **`console.log` fails lint** (`noConsole: error`; only `warn`/`error`/`info`/`debug`). So does an
   incomplete hook dep array (`useExhaustiveDependencies: error`).
8. **URL is the state transport.** Use the existing `nuqs` parsers; `history: 'push'` for navigation,
   `'replace'` for editing. Gate every mutation on `editMode` — read-only is the default.
9. **Validate external data with Valibot; return `neverthrow` Results instead of throwing.**
10. **Exact versions only** (`save-exact=true`) — never write `^` or `~` into a `package.json`.
11. **Deleting a feature? Replace its test, don't just delete it.** House precedent applied twice —
    a deleted assertion removes the regression detector.
12. **`@crowfoot/ui` has 10 components with no consumer**, kept for future work. knip cannot flag them
    (entry-file exports), so nothing verifies them. Treat the first real use as new code.

## Known gotchas (all hit for real)
- `erd build --input <absolute path>` is parsed as a URL → `fetch failed`. **Relative paths only.**
- `dist/schema.json` (deploy this) ≠ the input `schema.json` (don't) — same name, different files.
- **`turbo build --filter=crowfoot` without `--force` can serve a stale bundle** — erd-core is consumed
  as TS source and is not in crowfoot's cache key. The release workflow pins `--force`; the root
  `release` script does not.
- **A backgrounded browser tab stalls ResizeObserver** → blank canvas, `data-loading` stuck true.
  Check `document.visibilityState` before calling it a product defect.
- **Unit tests cannot reach CSS Modules** (not injected into happy-dom) — browser smoke is the only
  real check; 2 defects found that way.
- **knip is only half an oracle**: a stale `ignoreDependencies` entry errors, but a stale `ignore[]`
  **path produces no output and exits 0**. Dead ignore paths must be found by hand.
- **pnpm 11 silently ignores `pnpm.overrides`** in root `package.json` (10.18.3 honours it). Move the
  block to `pnpm-workspace.yaml` before bumping `packageManager`, or six CVE pins evaporate.
- Windows: `crowfoot` is 27 passed / 4 failed (`runPreprocess.test.ts`, `os.tmpdir()` absolute path
  parsed as URL) and the lefthook hook needs a **full** `pnpm install`. Watch `core.autocrlf`.
- tbls: DSN must be plain `mysql://` (strip `+pymysql` and query string); a `viewpoints.id` key makes
  the parser exit 1 with `ZodError: unrecognized_keys ["id"]`.

## Open items

See `_docs/index.md` for current status. `_docs/active/` holds exactly one document.

- **No E2E coverage of any fork feature**, and **no harness to put it in** — Playwright was deleted
  with the upstream packages. Tracked with six other items in
  `_docs/active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md`; item 3's cost estimate is now
  higher than written.
- ✅ **Published.** `crowfoot@0.1.0` shipped 2026-08-06, Trusted Publisher registered, `erdkit`
  deprecated. Releases are now tag-driven: `git tag v<x> && git push origin v<x>`.
- **Owner-only, never delegated**: pushing a release tag, and keeping the `erdkit` repo archived.
- **Registered, not actioned** (from the 2026-08-06 audit): move `pnpm.overrides` before a pnpm 11
  bump · `.npmrc` is tracked but not gitignored for credentials · `route06/actions` reusable-workflow
  dependency · `setEnv.ts` `envName` never resolves to `production` on the detached release checkout ·
  `knip.jsonc`'s `@swc/core` comment still cites Vercel · `.vscode/settings.json` still points at the
  deleted `.stylelintrc.json`.

## Agent Loading Guide
- **All agents**: read this `index.md` (REQUIRED)
- **Read additional files when**: the file's relevance is REQUIRED/HIGH for your role, or your task
  touches that domain. All eight are ✅ scanned-from-code — none skipped.

## Changelog
- 2026-08-06 (`be485b4`): Full regeneration after `444f80d` removed 14 upstream packages. Workspace
  20 → 6; `frontend/apps/` and all but two internal packages are gone, as are Playwright, storybook,
  stylelint, `.env.template` and `CONTRIBUTING.md`. Root package renamed `crowfoot-monorepo`. Added:
  the `git rm` residue trap, the knip half-oracle limitation, the pnpm 11 overrides hazard, the CI
  test gap, and the un-consumed `@crowfoot/ui` surface. `testing.md`'s agentic adapter now records
  **no spec dir** rather than a deleted one.
- 2026-08-06 (`3865cc0`): Full regeneration at `04dff30`. Previous profile was pinned to `d2fb6638c`,
  a commit the history rewrite erased.
