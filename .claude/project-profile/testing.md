# Testing

Project principles: `docs/test-principles.md` (Khorikov's four pillars + t-wada's "test pain reveals
design issues"). **Test observable behaviour, not implementation.**

## Frameworks
| Type | Framework | Config | Location |
|------|-----------|--------|----------|
| Unit | **Vitest 3.2.4** | root `vitest.config.ts` (projects) + per-package `vitest.config.ts` | colocated `*.test.ts(x)` |
| Component | Vitest + `@testing-library/react` 16.3.0 + `jest-dom` 6.9.1, `happy-dom` 20 | `frontend/packages/erd-core/vitest.config.ts` | colocated |
| E2E | **NONE** | — | — |

> 🔴 **There is no E2E framework in this repository.** Playwright and the `@liam-hq/e2e` harness were
> deleted in `444f80d` — they only ever targeted upstream's Next.js app. Any E2E work starts from an
> empty harness. `pnpm test:e2e` no longer exists.

Root `vitest.config.ts` `projects`: `frontend/internal-packages/!(e2e)`, `frontend/packages/*`.
(The `!(e2e)` exclusion is now vestigial — that package is gone. Harmless; a zero-match project glob
is silently dropped by vitest as long as at least one glob matches.)

## Test Commands

```bash
# 🔴 On a fresh clone these two come FIRST, or test files fail at collection. See stack.md.
pnpm install
pnpm exec turbo build --filter=@liam-hq/schema --filter=@liam-hq/ui
```

- All: `pnpm test` (turbo; `dependsOn: ["^build", "gen"]` — which is why the turbo path works from cold)
- Per package: `pnpm --filter @liam-hq/erd-core test` etc.
- Coverage: `pnpm test:coverage` (v8 → `./coverage`)

## Verified baseline (measured 2026-08-06 @ `be485b4`, macOS)

| Package | Result |
|---|---|
| `@liam-hq/schema` | **562 passed** |
| `@liam-hq/erd-core` | **303 passed, 4 todo** |
| `crowfoot` | **31 passed** |
| `@liam-hq/ui` | **30 passed** |

Type-check exit 0 on `erd-core`, `crowfoot`, `ui`; root `pnpm lint` exit 0. Gate on net-new against this.

> ⚠️ **Platform caveat.** `crowfoot` shows **27 passed / 4 failed on Windows** — 4 tests in
> `runPreprocess.test.ts` feed `os.tmpdir()` (an absolute Windows path) into `getInputContent`, which
> parses it as a URL. On macOS/Linux the suite is green. **Never report a macOS run as evidence about
> the Windows path.**

> ⚠️ **CI does not run everything.** `frontend-ci.yml` runs `pnpm lint` plus `@liam-hq/erd-core` and
> `crowfoot` tests only — **`@liam-hq/schema` (562) and `@liam-hq/ui` (30) never run in CI.** Run
> them locally before claiming a change is safe.

## Patterns
- File naming: `*.test.ts(x)`, **colocated** with the subject
- `globals: true` is configured, **but every fork-owned suite imports explicitly anyway** —
  `import { describe, expect, it } from 'vitest'`. Follow the code, not the config.
- Test data: **builder factories** from `@liam-hq/schema` — `aSchema`, `aTable`, `aColumn`, `anIndex`,
  `aPrimaryKeyConstraint`, `aForeignKeyConstraint`, `aUniqueConstraint`. Do not hand-roll schema literals.
- Mocks: `vi.mock` inline. (The old workspace-level `frontend/packages/__mocks__/*` no longer exists.)
- String assertions: prefer `toMatchInlineSnapshot()` over stacked `toContain`
- ❌ Do not test re-export barrels, type-only files, or config constants

### Deleting a feature? Replace its test, don't just delete it
House precedent, applied twice: when the CommandPalette preview was removed its test became one
asserting the preview pane stays empty; when the "Send a signal" callout was removed its test became
`does not send the user to upstream discussions`. **Deleting the assertion with the code removes the
regression detector.** Leave something that fails if the surface returns.

### What unit tests structurally cannot reach
CSS Modules are not injected into happy-dom, so `pointer-events`, z-index and cursor are only verified
as *class names present*. Real behaviour needs a browser — two real defects were found that way
(`6c112432a`, `68e37114c`). **Do not claim a CSS-dependent fix is verified from unit tests.**

### `@liam-hq/ui` has un-exercised surface
Many components (`Modal`, `Popover`, `Select`, `Input`, `Callout`, `Skeleton`, `RoundBadge`, `Switch`,
`Tabs`, `Collapsible`) have **no consumer in `erd-core` or `cli`** — they are kept for future feature
work. Consequences: `tsc` never checks them against real usage, there is no storybook to preview them,
and **knip cannot flag them** (`ui/src/index.ts` is an entry file, so its unused exports are invisible
without `includeEntryExports`). Treat the first real use of one as unverified code.

## Coverage
- Target: **none configured** — reported, not enforced. Report: `./coverage` (v8).

## E2E Fixtures
- E2E account: **N/A** — the artifact is a static SPA with no auth, no DB, no shared services.
- Test-data seed: not applicable. The fixture is a built artifact:
  ```bash
  pnpm exec turbo build --filter=crowfoot --force
  node frontend/packages/cli/dist-cli/bin/cli.js \
    erd build --input ./schema.sql --format postgres --output-dir ./erd-out
  cd erd-out && python3 -m http.server 5199 --bind 127.0.0.1
  ```
  **`file://` does not work** — the CLI says so on every build.
- Target env: **local only.** Pick a free port; 5199–5201 used by convention.
- Teardown: delete the output dir.
- Host-OS gate: N/A (web).

## Agentic Testing Adapter
- Surface: **web**
- Driver: **agent-browser** — gate verified 2026-08-06 (CLI `0.31.1` present, skill listed). Falls back
  to `playwright-mcp` only if that gate fails.
- Emitter house-style: `reference/e2e-testing.md`
- Concurrency: **serial-shared-browser**
- Generated spec dir: **`[FILL: no E2E harness exists]`** — the old
  `frontend/internal-packages/e2e/tests/e2e/` was deleted. A first spec must also choose where the
  harness lives and add its own Playwright dependency. Do not assume a location.
- Precondition: a built artifact served over HTTP (above). Exercise edit-mode paths with `?edit=1` —
  without it the UI is read-only by design and every mutation correctly does nothing.

### 🔴 Two false-failure traps when driving a browser
1. **`turbo build --filter=crowfoot` without `--force` can serve a stale bundle.** erd-core is consumed
   as TS source, so its files are not in `crowfoot`'s cache key — change erd-core only and the old
   bundle comes back out of cache. `release-crowfoot.yml` pins `--force`; the root `release` script
   does **not**.
2. **A backgrounded tab stalls ResizeObserver.** React Flow can't measure nodes, `data-loading` stays
   `true`, and the canvas looks blank. Check `document.visibilityState` before calling it a product
   defect; screenshots return stale frames for the same reason.
