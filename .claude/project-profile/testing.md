# Testing

Project principles: `docs/test-principles.md` (Khorikov's four pillars + t-wada's "test pain reveals
design issues"). **Test observable behaviour, not implementation.**

## Frameworks
| Type | Framework | Config | Location |
|------|-----------|--------|----------|
| Unit | **Vitest 3.2.4** | root `vitest.config.ts` (projects) + per-package `vitest.config.ts` | colocated `*.test.ts(x)` next to the subject |
| Component | Vitest + `@testing-library/react` 16.3.0 + `jest-dom` 6.9.1, `happy-dom` 20 | `frontend/packages/erd-core/vitest.config.ts` | colocated |
| E2E | **Playwright 1.56.1** | `frontend/internal-packages/e2e/playwright.config.ts` | `frontend/internal-packages/e2e/tests/` |
| VRT | Playwright snapshots | same | `tests/vrt/` (linux-only baselines) |

> ⚠️ The Playwright suite targets **upstream's Next.js app** (`baseURL` default `http://localhost:5173`,
> `storageState.json`, Vercel bypass header, mastodon sample route). It does **not** cover the fork's
> features. There is currently **no E2E coverage of positions / memos / colours / edit mode /
> MySQL export** — those are covered by unit tests only.

## Test Commands
- All: `pnpm test` (turbo fan-out; `dependsOn: ["^build", "gen"]`)
- Per package: `pnpm --filter @liam-hq/erd-core test` · `pnpm --filter @liam-hq/schema test`
- Coverage: `pnpm test:coverage` (v8 → `./coverage`, `text|json|html`)
- E2E: `pnpm test:e2e` (turbo) or `pnpm --filter @liam-hq/e2e test:e2e`

## Verified baseline (run 2026-08-03 @ `d2fb6638c`)
| Package | Files | Result |
|---|---|---|
| `@liam-hq/schema` | 37 | **562 passed** |
| `@liam-hq/erd-core` | 29 | **195 passed, 4 todo** |

Fork-owned suites: `utils/tableLayout/tableLayout.test.ts` (19) · `utils/memo/memo.test.ts` (15) ·
`deparser/mysql/schemaDeparser.test.ts` · `AppBar/ExportDropdown/ExportDropdown.test.tsx` (8, 4 skipped).

## Patterns
- File naming: `*.test.ts` / `*.test.tsx`, **colocated** with the subject — no `__tests__/` in
  erd-core or cli (`schema/src/parser/__tests__/` and `__snapshots__/` are the upstream exception)
- `globals: true` — `describe`/`it`/`expect` are ambient, do not import them
- Test data: **builder factories** exported from `@liam-hq/schema` — `aSchema`, `aTable`, `aColumn`,
  `anIndex`, `aPrimaryKeyConstraint`, `aForeignKeyConstraint`, `aUniqueConstraint`. Use these; do not
  hand-roll schema literals.
- Mocks: `vi.mock` inline; workspace-level mock packages live in `frontend/packages/__mocks__/*`
- String assertions: prefer `toMatchInlineSnapshot()` over stacked `toContain` (per `docs/test-principles.md`)
- ❌ Do not test re-export barrels, type-only files, or config constants

## Coverage
- Target: **none configured** — no threshold gate. Coverage is reported, not enforced.
- Report: `./coverage` (v8; excludes tests, stories, configs, `dist`, `.next`)

## E2E Fixtures
- E2E account: **N/A for the fork surface** — the artifact is a static SPA with no auth.
  (The upstream Playwright suite expects a `storageState.json` produced by
  `frontend/internal-packages/e2e/globalSetup.ts`; unused by the fork.)
- Credentials source: `VERCEL_PROTECTION_BYPASS_SECRET`, `URL`, `DEFAULT_TEST_URL` env vars — upstream only
- Test-data seed: **not applicable.** The fork's fixture is a built artifact:
  `pnpm build --filter @liam-hq/cli` → `node frontend/packages/cli/dist-cli/bin/cli.js erd build
  --format schemarb --input <relative path> --output-dir dist` → serve `dist/` over HTTP
  (`npx serve dist/`). **`file://` does not work.**
- Target env: **local only.** Never point automated tests at `carbon-stage.qesg.co.kr`.
- Shared-resource caution: none (no DB, no shared services)
- Teardown: none needed — delete `dist/`
- Device targets: N/A (web)
- Launch command: `npx serve dist/` (or `npx http-server -c-1 dist/`) · version pin: `.node-version` = 22.21.0
- Host-OS gate: N/A (web, Chromium/WebKit)

> `[FILL: …]` none outstanding — but note the **absent** rows above are absent because the fork's
> surface genuinely has no accounts/DB, not because they are unknown.

## Agentic Testing Adapter
- Surface: **web**
- Driver: **agent-browser** (skill available in this harness; verify the CLI is installed before the
  first run — fall back to `playwright-mcp` if not)
- Emitter house-style: `reference/e2e-testing.md`
- Concurrency: **serial-shared-browser**
- Generated spec dir: `frontend/internal-packages/e2e/tests/e2e/`
- Precondition for any agentic run: a built `dist/` served over HTTP (see E2E Fixtures above).
  Exercise edit-mode paths with `?edit=1` — without it the UI is read-only by design and every
  mutation attempt will correctly do nothing.
