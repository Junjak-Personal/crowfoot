# Project Profile — erdkit

> Generated: 2026-08-03
> Last updated: 2026-08-03
> Profile-Generated-At: `d2fb6638c`
> Branch: `feature/erd-view-customization` · working tree clean at generation time

## What this repo is

A **fork of [Liam ERD](https://github.com/liam-hq/liam)** (ROUTE06, Inc., Apache-2.0), pinned to
upstream `92156eac5` (2026-06-18) and **not tracking upstream**. It adds five things to the ERD
viewer: persisted table positions, canvas memos, colour coding, an explicit `?edit=1` edit mode, and
MySQL DDL export. Its first consumer is the carbon project's ERD at
https://carbon-stage.qesg.co.kr/erd/. The next milestone is renaming and publishing the CLI to npm so
it can be used as `npx <pkg> erd build …` from any project.

Fork-only project docs live in **`_docs/`** (start at `_docs/index.md`); `docs/` is upstream
documentation and is not ours. To pick the work back up, read `_docs/handoff/2026-08-03-erd-viewer-handoff.md`.

## Quick Summary
- **Stack**: TypeScript 5.9.3 + React 19 + Vite/Rollup (static SPA) — pnpm/Turborepo monorepo
- **Package manager**: pnpm 10.18.3 (Node 22.21.0, `save-exact=true`)
- **Test framework**: Vitest 3.2.4 (unit/component) · Playwright 1.56.1 (E2E, upstream app only)
- **State management**: React Context + `nuqs` URL params — **no store library**
- **API layer**: no HTTP API — a file-based parse/deparse contract (`@liam-hq/schema`)
- **CI/CD**: GitHub Actions inherited from upstream; the fork's real delivery is **manual S3 + CloudFront**

## Profile Files

Relevance: REQUIRED (always read) > HIGH (read if related) > MEDIUM (optional) > SKIPPED

| File | Relevance | Status | Contents |
|------|-----------|--------|----------|
| [stack.md](./stack.md) | REQUIRED | ✅ | Runtime, deps, **authoritative build/verify commands (vacuity-checked)** |
| [structure.md](./structure.md) | REQUIRED | ✅ | Layout, **fork work surface**, **Apache-2.0 file-header rule**, naming |
| [code-style.md](./code-style.md) | HIGH | ✅ | Biome config, imports, naming, enforced lint rules |
| [api-layer.md](./api-layer.md) | HIGH | ✅ | Parser/deparser contract, CLI ingest, codegen (no HTTP client) |
| [state-management.md](./state-management.md) | MEDIUM | ✅ | Context + nuqs, URL param encoding, persistence precedence |
| [testing.md](./testing.md) | HIGH | ✅ | Vitest/Playwright, **verified test baseline**, agentic adapter |
| [ui-components.md](./ui-components.md) | MEDIUM | ✅ | `@liam-hq/ui`, CSS Modules, design tokens, colour-tint pattern |
| [deployment.md](./deployment.md) | MEDIUM | ✅ | Inherited CI vs manual delivery, CloudFront traps, npm publish blockers |

## Key Conventions for Agents

1. **🔴 Apache-2.0 headers are mandatory.** Every file the fork creates or modifies gets a two-line
   header (`// Added in erdkit…` or `// Modified from the original Liam ERD source…`) pointing at
   `NOTICE`. §4(b) requires it. When the nature of a change shifts, update `NOTICE`'s change summary.
   Exact text: `structure.md` → "Apache-2.0 file-header convention".
2. **🔴 Never name anything `liam-*`.** §6 grants no trademark rights. The CLI ships as `erdkit`
   (package, bin, repo, banner, generated page title). `prepack` copies the root `LICENSE` and
   `NOTICE` into the tarball — do not remove that, it is what satisfies §4(a) and §4(d).
3. **Stay on the fork's work surface**: `packages/erd-core`, `packages/schema`, `packages/cli`.
   `frontend/apps/app` (Next.js + Supabase) is upstream and out of scope — if a task reaches it, stop
   and re-scan rather than assuming this profile applies.
4. **Verify with the authoritative commands, per package.** There is **no root `tsconfig.json`**, so
   root `tsc --noEmit` is vacuous. Use `pnpm --filter <pkg> exec tsc --noEmit`. Baseline is **0 errors,
   0 lint findings, 562 + 195 tests green** — gate on net-new against that.
5. **Named exports only, `const` arrow functions, `handle*` for event handlers.** No default exports.
   No backward-compat shims — update all call sites together.
6. **CSS Modules + `pnpm gen:css`.** Adding a class without regenerating `*.module.css.d.ts` breaks
   `lint:tsc`. Colours come from `@liam-hq/ui` design tokens — never a raw hex.
7. **`console.log` fails lint** (`noConsole: error`; only `warn`/`error`/`info`/`debug` allowed).
   So does an unknown CSS custom property, and an incomplete hook dep array.
8. **URL is the state transport.** Use the existing `nuqs` parsers; pick `history: 'push'` for
   navigation and `'replace'` for editing. Gate every mutation on `editMode` — read-only is the default.
9. **Validate external data with Valibot; return `neverthrow` Results instead of throwing.**
10. **Exact versions only** (`save-exact=true`) — never write `^` or `~` into a `package.json`.

## Known gotchas (all hit for real)
- `erd build --input <absolute path>` is parsed as a URL → `fetch failed`. **Relative paths only.**
- `dist/schema.json` (deploy this) ≠ the input `schema.json` (don't) — same name, different files.
- Windows: the lefthook pre-commit hook needs a **full** `pnpm install`, not a filtered one. Watch `core.autocrlf`.
- tbls: DSN must be plain `mysql://` (strip `+pymysql` and query string); a `viewpoints.id` key makes
  Liam exit 1 with `ZodError: unrecognized_keys ["id"]`.

## Open items (not started)

Tracked as plans in `_docs/` — see `_docs/index.md` for the current status of each.

- **npm publish** (`_docs/active/planning/2026-08-03/2026-08-03-cli-distribution.md`) — rename off
  `liam-*`, add `NOTICE` to the tarball, verify with `npm pack`. The path is **entirely unverified**;
  `npm pack` has never been run. Includes deferred `--layout` / `--memos` CLI options.
- **carbon delivery automation** (`_docs/active/planning/2026-08-03/2026-08-03-carbon-erd-delivery.md`)
  — blocked on ECR permissions and on the publish above.
- **No E2E coverage of any fork feature**; unit tests only. Not yet planned.

## Agent Loading Guide
- **All agents**: read this `index.md` (REQUIRED)
- **Read additional files when**: the file's relevance is REQUIRED/HIGH for your role, or your task
  touches that domain. All eight files are ✅ scanned-from-code — none are skipped.
