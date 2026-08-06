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
> features. There is currently **no E2E coverage of positions / memos / colours / groups / edit mode /
> MySQL export** — those are covered by unit tests only. Tracked in
> `_docs/active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md`.

## Test Commands

```bash
# 🔴 On a fresh clone these two come FIRST or 27 files fail at collection. See stack.md.
pnpm install
pnpm exec turbo build --filter=@liam-hq/schema --filter=@liam-hq/ui
```

- All: `pnpm test` (turbo fan-out; `dependsOn: ["^build", "gen"]` — which is why the turbo path works
  from cold and a bare `vitest` does not)
- Per package: `pnpm --filter @liam-hq/erd-core test` · `pnpm --filter @liam-hq/schema test`
- Coverage: `pnpm test:coverage` (v8 → `./coverage`, `text|json|html`)
- E2E: `pnpm test:e2e` (turbo) or `pnpm --filter @liam-hq/e2e test:e2e`

## Verified baseline (measured 2026-08-06 @ `04dff30`, macOS)

| Package | Files | Result |
|---|---|---|
| `@liam-hq/schema` | 37 | **562 passed** |
| `@liam-hq/erd-core` | 36 | **303 passed, 4 todo** |
| `crowfoot` | 5 | **31 passed** |

All three are **green on macOS**. Type-check exit 0 on both `erd-core` and `crowfoot`;
root `pnpm lint` exit 0. Gate on net-new against this.

> ⚠️ **Platform caveat.** An earlier profile recorded `crowfoot` as "27 passed / 4 FAILED, never green
> on Windows" — those 4 failures were in `runPreprocess.test.ts`, where `os.tmpdir()` yields an
> absolute Windows path that `getInputContent` parses as a URL. On macOS/Linux the suite is fully
> green. If you are on Windows, expect 27/4 and do not chase it; **do not report a macOS run as
> proof the Windows path works.**

Fork-owned suites: `utils/group/group.test.ts` · `utils/tableLayout/tableLayout.test.ts` ·
`utils/memo/memo.test.ts` · `utils/storage/storage.test.ts` · `components/ERDContent/ErdContent.test.tsx` ·
`.../TableGroupNode/TableGroupNode.test.tsx` · `.../LeftPane/LeftPane.test.tsx` ·
`.../ErrorDisplay/ErrorDisplay.test.tsx` · `hooks/useGroupNodes/useGroupNodes.test.tsx` ·
`hooks/useCommitTablePositions/useCommitTablePositions.test.tsx` ·
`deparser/mysql/schemaDeparser.test.ts` · `AppBar/ExportDropdown/ExportDropdown.test.tsx`.

## Patterns
- File naming: `*.test.ts` / `*.test.tsx`, **colocated** with the subject — no `__tests__/` in
  erd-core or cli (`schema/src/parser/__tests__/` and `__snapshots__/` are the upstream exception)
- `globals: true` is configured, **but every fork-owned suite imports explicitly anyway** —
  `import { beforeEach, describe, expect, it } from 'vitest'`. Follow the code, not the config.
- Test data: **builder factories** exported from `@liam-hq/schema` — `aSchema`, `aTable`, `aColumn`,
  `anIndex`, `aPrimaryKeyConstraint`, `aForeignKeyConstraint`, `aUniqueConstraint`. Use these; do not
  hand-roll schema literals.
- Mocks: `vi.mock` inline; workspace-level mock packages live in `frontend/packages/__mocks__/*`
- String assertions: prefer `toMatchInlineSnapshot()` over stacked `toContain` (per `docs/test-principles.md`)
- ❌ Do not test re-export barrels, type-only files, or config constants

### Deleting a feature? Replace its test, don't just delete it
House precedent, applied twice: when the CommandPalette preview was removed, its test became one
asserting the preview pane stays empty; when the "Send a signal" callout was removed, its test became
`does not send the user to upstream discussions`. **Deleting the assertion along with the code
removes the regression detector** — leave something that fails if the surface comes back.

### What unit tests structurally cannot reach
CSS Modules are not injected into happy-dom, so `pointer-events`, z-index and cursor are only ever
verified as *class names present*. Real behaviour there needs a browser smoke — two real defects were
found that way (`6c112432a`, `68e37114c`). Do not claim a CSS-dependent fix is verified from unit tests.

## Coverage
- Target: **none configured** — no threshold gate. Coverage is reported, not enforced.
- Report: `./coverage` (v8; excludes tests, stories, configs, `dist`, `.next`)

## E2E Fixtures
- E2E account: **N/A for the fork surface** — the artifact is a static SPA with no auth.
  (The upstream Playwright suite expects a `storageState.json` from
  `frontend/internal-packages/e2e/globalSetup.ts`; unused by the fork.)
- Credentials source: `VERCEL_PROTECTION_BYPASS_SECRET`, `URL`, `DEFAULT_TEST_URL` env vars — upstream only
- Test-data seed: **not applicable.** The fork's fixture is a built artifact:
  ```bash
  pnpm exec turbo build --filter=crowfoot --force
  node frontend/packages/cli/dist-cli/bin/cli.js \
    erd build --input ./schema.sql --format postgres --output-dir ./erd-out
  cd erd-out && python3 -m http.server 5199 --bind 127.0.0.1
  ```
  **`file://` does not work** — the CLI says so on every build.
- Target env: **local only.** Never point automated tests at `carbon-stage.qesg.co.kr`.
- Shared-resource caution: none (no DB, no shared services) — but pick a free port; 5199/5200 used by convention.
- Teardown: none needed — delete the output dir.
- Device targets: N/A (web)
- Launch command: `python3 -m http.server` or `npx serve dist/` · version pin: `.node-version` = 22.21.0
- Host-OS gate: N/A (web, Chromium/WebKit)

> No `[FILL: …]` outstanding. The absent rows are absent because this surface genuinely has no
> accounts or DB, not because they are unknown.

## Agentic Testing Adapter
- Surface: **web**
- Driver: **agent-browser** — gate verified 2026-08-06 (CLI `0.31.1` present, skill listed). Falls back
  to `playwright-mcp` only if the gate fails.
- Emitter house-style: `reference/e2e-testing.md`
- Concurrency: **serial-shared-browser**
- Generated spec dir: `frontend/internal-packages/e2e/tests/e2e/`
- Precondition for any agentic run: a built artifact served over HTTP (see E2E Fixtures).
  Exercise edit-mode paths with `?edit=1` — without it the UI is read-only by design and every
  mutation attempt will correctly do nothing.

### 🔴 Two false-failure traps when driving the browser
1. **`turbo build --filter=crowfoot` without `--force` can serve a stale bundle.** erd-core is consumed
   as TS source, so its files are not in `crowfoot`'s cache key — change erd-core only and the old
   bundle comes back out of cache. The release workflow pins `--force` for this reason.
2. **A backgrounded tab stalls ResizeObserver.** React Flow can't measure nodes, `data-loading` stays
   `true`, and the canvas looks blank. Check `document.visibilityState` before calling it a product
   defect; screenshots return stale frames for the same reason.
