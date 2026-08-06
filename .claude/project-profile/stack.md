# Tech Stack

> **This repo is a fork.** `crowfoot` = a modified fork of [Liam ERD](https://github.com/liam-hq/liam)
> (ROUTE06, Inc., Apache-2.0), taken from upstream `92156eac5` (2026-06-18) and **not tracking upstream**.
> After the 2026-08-06 history rewrite the upstream tree is a single squashed root commit,
> **`f4dd6c4`** — that is the fork's base, and `git diff f4dd6c4..HEAD` is the authoritative list of
> what the fork owns. Most of the monorepo is inherited upstream code the fork does not touch.
> See `structure.md` → "Fork work surface".

## Runtime
- Language: TypeScript 5.9.3 (React 19.1.1)
- Runtime: Node 22.21.0 (`.node-version`)
- Package manager: **pnpm 10.18.3** (`packageManager` field in root `package.json`)
- Detection: `pnpm-lock.yaml` present + explicit `packageManager` field (authoritative)
- Monorepo orchestrator: **Turborepo 2.5.8** (`turbo.json`, 20 packages in scope)
- Workspaces (`pnpm-workspace.yaml`): `frontend/apps/*`, `frontend/packages/*`,
  `frontend/packages/__mocks__/*`, `frontend/internal-packages/*`
- `.npmrc`: `save-exact=true` — **all dependency versions are pinned exact, no `^`/`~`**. Keep it that way.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 2880` (2 days) — brand-new releases are blocked unless allowlisted.

## Framework
- Framework: **none at the fork's work surface** — the shipped artifact is a Vite-built static SPA emitted by the CLI.
  (Upstream also ships a Next.js 15 app at `frontend/apps/app`; the fork does not touch it.)
- Canvas / rendering: `@xyflow/react` 12.8.6 (React Flow) + `elkjs` 0.10.0 (auto-layout)
- UI library: `@liam-hq/ui` (workspace-internal, Radix UI primitives + `lucide-react`)
- CSS: **CSS Modules** + `typed-css-modules` (`tcm`) generating `*.module.css.d.ts`
- Validation: **Valibot** 1.1.0 (runtime validation of external data)
- URL state: `nuqs` 2.4.3
- Errors: `neverthrow` 8.2.0 (Result type)
- Pattern matching: `ts-pattern` 5.7.1

## Key Dependencies (fork work surface only)
| Package | Version | Purpose |
|---------|---------|---------|
| `@xyflow/react` | 12.8.6 | ERD canvas — nodes, edges, viewport |
| `elkjs` | 0.10.0 | Auto-layout (`nodePlacement/layering: INTERACTIVE` — seeded coords are honored as hints) |
| `nuqs` | 2.4.3 | Query-param-backed state (`?positions=`, `?colors=`, `?memos=`, `?edit=`, `?show=`) |
| `valibot` | 1.1.0 | Runtime schema validation |
| `neverthrow` | 8.2.0 | Result-typed error handling |
| `pako` | 2.1.0 | Deflate for the compressed URL params |
| `commander` | 13.1.0 | CLI arg parsing |
| `ink` / `inquirer` | 6.0.1 / 12.6.3 | CLI TUI + prompts |
| `@prisma/internals` | 6.8.2 | Prisma schema parsing |
| `lucide-react` | 0.511.0 | Icons (via `@liam-hq/ui`) |
| `rollup` | 4.52.5 | Bundles the CLI (`dist-cli/bin/cli.js`, ~3.4MB — erd-core/schema inlined, NOT external) |
| `vite` | 6.4.1 | Builds the viewer SPA into `dist-cli/html` |

> `ink-gradient` was removed 2026-08-06 — the banner is one flat colour now, and that dependency
> existed for the single gradient call. Do not reintroduce it.

## Build (pnpm)
- Install: `pnpm install --frozen-lockfile`
- Dev (all): `pnpm dev` · single package: `pnpm --filter crowfoot dev`
- Build (all): `pnpm build` · single: `pnpm turbo build --filter=crowfoot`
- Test: `pnpm test` (turbo fan-out) · single: `pnpm --filter @liam-hq/erd-core test`
- Format: `pnpm fmt` · Lint: `pnpm lint`
- CSS type gen: `pnpm gen:css` (per-package `tcm src`) — **required after adding/changing any `.module.css`**
- Worktree deps fast-path (**family A · copy-based, node_modules**):
  `pnpm install --frozen-lockfile --prefer-offline`
  Hard-links from the pnpm content-addressable store; store and worktree must be on the **same
  filesystem** or pnpm falls back to copying. No re-download.
- Audit: `pnpm audit`

## 🔴 Fresh-clone bootstrap — `pnpm install` alone is NOT enough

A clean clone that runs `pnpm install` and then `vitest` gets **27 test files failing at collection**:

```
Error: Failed to resolve entry for package "@liam-hq/schema".
```

`erd-core` and `cli` import the *built* `@liam-hq/schema` / `@liam-hq/ui`, whose `dist` does not exist
yet. This looks exactly like a product regression and is not one. Always:

```bash
pnpm install
pnpm exec turbo build --filter=@liam-hq/schema --filter=@liam-hq/ui
```

## Build & Verify — AUTHORITATIVE commands (vacuity-checked 2026-08-06 @ `04dff30`)

> Use THESE, never a convenience alias. All were run on this machine and confirmed to exercise real sources.

- **Type-check (authoritative, per package)**: `pnpm --filter <pkg> exec tsc --noEmit`
  - Vacuity-checked: **yes** — each package's `tsconfig.json` has `"include": ["src/**/*"]` extending
    `@liam-hq/configs/tsconfig/base.json`; it compiles real sources. There is **no root `tsconfig.json`**,
    so a root-level `tsc --noEmit` is meaningless — always filter to a package.
  - Pre-existing error baseline: **0** (`@liam-hq/erd-core` exit 0, `crowfoot` exit 0). Gate on net-new vs 0.
  - ⚠️ Requires `pnpm gen:css` to have run — a missing `*.module.css.d.ts` shows up as `TS2307
    Cannot find module './X.module.css'`, which is a stale generated file, not a real type error.
- **Lint (authoritative)**: `pnpm lint` → `turbo lint` + `syncpack lint` + `knip --treat-config-hints-as-errors`
  - Per-package: `biome check .` (Biome 2.2.6; `eslint` is **disabled in `crowfoot`** — its `lint:eslint` is a no-op `echo`)
  - Baseline: **exit 0**. This is the gate.
  - `pnpm lint:stylelint` is **NOT** in that gate and is **NOT clean** — 79 findings, exit 2,
    mostly upstream `frontend/apps/app/*` plus the fork's `--view-tint` custom property. Do not chase it.
- **Test (authoritative)**: `pnpm --filter <pkg> test` (vitest 3.2.4)
  - Verified baseline — see `testing.md` for the per-package table.

## Publishing — DONE
- `frontend/packages/cli` is a **self-contained publishable package**: rollup does *not* mark
  `@liam-hq/erd-core` / `@liam-hq/schema` external (they are inlined), and `scripts/pack-cli.js`
  strips `workspace:*` deps on `prepack` and restores on `postpack`.
- Published as **`crowfoot` 0.1.0** (renamed off `erdkit`, version reset). `npm pack --dry-run` carries
  13 files including `LICENSE` and `NOTICE` — that is what satisfies §4(a) and §4(d). **Never remove
  the `prepack` copy step.**
- Release is tag-triggered via `.github/workflows/release-crowfoot.yml` using npm **Trusted Publishing
  (OIDC)** — no token anywhere. See `deployment.md`.
