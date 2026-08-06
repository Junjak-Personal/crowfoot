# Tech Stack

> **This repo is a fork.** `crowfoot` = a modified fork of [Liam ERD](https://github.com/liam-hq/liam)
> (ROUTE06, Inc., Apache-2.0), taken from upstream `92156eac5` (2026-06-18) and **not tracking upstream**.
> The upstream tree is a single squashed root commit, **`f4dd6c4`** — `git diff f4dd6c4..HEAD` is the
> authoritative list of what the fork owns.
>
> As of `444f80d` the monorepo carries **only what the CLI needs**: 14 upstream packages were deleted.
> There is no Next.js app, no docs site, no Supabase layer, no AI agent, and no Playwright harness.

## Runtime
- Language: TypeScript 5.9.3 (React 19.1.1)
- Runtime: Node 22.21.0 (`.node-version`)
- Package manager: **pnpm 10.18.3** (`packageManager` field in root `package.json`)
- Monorepo orchestrator: **Turborepo 2.5.8** (`turbo.json`)
- Root package name: **`crowfoot-monorepo`** (private, never published)
- Workspaces (`pnpm-workspace.yaml`): `frontend/packages/*`, `frontend/internal-packages/*`
- `.npmrc`: `save-exact=true` — **all versions pinned exact, no `^`/`~`**. Keep it that way.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 2880` (2 days), with **no exclusions**.

## The 6 packages (this is the whole workspace)

| Package | Path | Role |
|---|---|---|
| **`crowfoot`** | `frontend/packages/cli` | ★ the published CLI + viewer host |
| `@crowfoot/erd-core` | `frontend/packages/erd-core` | the ERD viewer (React + xyflow) |
| `@crowfoot/schema` | `frontend/packages/schema` | parsers + deparsers (incl. the fork's MySQL deparser) |
| `@crowfoot/ui` | `frontend/packages/ui` | design system (Radix + CSS Modules + tokens) |
| `@crowfoot/configs` | `frontend/internal-packages/configs` | shared biome/tsconfig/eslint presets |
| `@crowfoot/neverthrow` | `frontend/internal-packages/neverthrow` | Result-type helpers |

### 🔴 `crowfoot` is the ONLY publishable package

The other five are `private: true` with no `publishConfig`. They exist purely as workspace links —
the CLI inlines them at build time, and the published tarball declares none of them.

They were `@liam-hq/*` until 2026-08-06 and were **`private: false` with `access: public`** — a
footgun, since a stray `pnpm publish -r` would have tried to publish fork code under ROUTE06's npm
scope. Renaming alone would have made that *worse* (an owned scope means the accidental publish
**succeeds**), which is why the rename and `private: true` landed together.

> To be clear about the licence: the rename was **not** required by Apache-2.0. §6 explicitly permits
> using the licensor's names "as required for reasonable and customary use in describing the origin
> of the Work", and an unpublished workspace identifier is exactly that. The rename is for the
> readability of a public repo; the `private: true` is the part that removes real risk. §4(b) is
> unaffected either way — the per-file notices say "Liam ERD source", never `@liam-hq/`, which is
> what made the string replacement safe (same reasoning as the `erdkit` rename).

## Framework
- Framework: **none** — the shipped artifact is a Vite-built static SPA emitted by the CLI.
- Canvas / rendering: `@xyflow/react` 12.8.6 (React Flow) + `elkjs` 0.10.0 (auto-layout)
- CSS: **CSS Modules** + `typed-css-modules` (`tcm`) generating `*.module.css.d.ts`
- Validation: **Valibot** 1.1.0 · URL state: `nuqs` 2.4.3 · Errors: `neverthrow` 8.2.0
- Pattern matching: `ts-pattern` 5.7.1

## Key Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `@xyflow/react` | 12.8.6 | ERD canvas — nodes, edges, viewport |
| `elkjs` | 0.10.0 | Auto-layout (`nodePlacement/layering: INTERACTIVE`) |
| `nuqs` | 2.4.3 | Query-param-backed state |
| `valibot` | 1.1.0 | Runtime schema validation |
| `neverthrow` | 8.2.0 | Result-typed error handling |
| `pako` | 2.1.0 | Deflate for compressed URL params |
| `commander` | 13.1.0 | CLI arg parsing |
| `ink` / `inquirer` | 6.0.1 / 12.6.3 | CLI TUI + prompts |
| `@prisma/internals` | 6.8.2 | Prisma schema parsing |
| `lucide-react` | 0.511.0 | Icons (via `@crowfoot/ui`) |
| `rollup` | 4.52.5 | Bundles the CLI (`dist-cli/bin/cli.js`) |
| `vite` | 6.4.1 | Builds the viewer SPA into `dist-cli/html` |

Root devDependencies are down to **9**: `@types/node` `@vitest/coverage-v8` `concurrently` `knip`
`lefthook` `syncpack` `turbo` `typescript` `vitest`. No `vercel`, no `stylelint`, no `@turbo/gen`.

## 🔴 `pnpm.overrides` — do not touch, and know where it lives

Six pinned resolutions (`@radix-ui/react-dialog`, `cookie`, `esbuild`, `path-to-regexp`, `prismjs`,
`undici`). Two are live in the tree; the rest match nothing today. **All six are kept deliberately** —
a no-op override costs nothing, and removing one silently unpins a CVE if the dependency returns
transitively. `cookie: ^0.7.0` is the only non-exact spec in a repo that pins everything, which is
what a security pin looks like.

> ⚠️ They sit in root `package.json`, a location **pnpm 11 ignores** (you will see a WARN on every
> command; pnpm 10.18.3 still honours it, verified). **Before bumping `packageManager` to pnpm 11,
> move `overrides` into `pnpm-workspace.yaml`**, which already hosts `minimumReleaseAge`.

## 🔴 Fresh-clone bootstrap — `pnpm install` is NOT enough

A clean clone that installs and runs `vitest` gets test files failing at collection:

```
Error: Failed to resolve entry for package "@crowfoot/schema".
```

`erd-core` and `cli` import the *built* `@crowfoot/schema` / `@crowfoot/ui`. This looks exactly like a
product regression and is not one. Always:

```bash
pnpm install
pnpm exec turbo build --filter=@crowfoot/schema --filter=@crowfoot/ui
```

(`pnpm test` via turbo works from cold because its task declares `dependsOn: ["^build", "gen"]`.)

## Build & Verify — AUTHORITATIVE commands (vacuity-checked 2026-08-06 @ `be485b4`)

- **Type-check (per package)**: `pnpm --filter <pkg> exec tsc --noEmit`
  - There is **no root `tsconfig.json`**, so a root `tsc --noEmit` is meaningless. Always filter.
  - Baseline: **0 errors** on `erd-core`, `crowfoot`, `ui`.
  - ⚠️ Needs `pnpm gen:css` to have run — a missing `*.module.css.d.ts` shows up as `TS2307
    Cannot find module './X.module.css'`, which is a stale generated file, not a type error.
- **Lint (authoritative)**: `pnpm lint` → `turbo lint` (**10 tasks**) + `syncpack lint` + `knip --treat-config-hints-as-errors`
  - Baseline **exit 0**. This is the gate; lefthook runs it on pre-commit.
  - Per package: `biome check .` (Biome 2.2.6) + `eslint .`
  - **stylelint is gone** — script and dependencies removed in `444f80d`.
- **Test**: `pnpm --filter <pkg> test` — see `testing.md` for the per-package baseline.
- **Build**: `pnpm exec turbo build --filter=crowfoot --force` → **6 tasks**.
  Artifact: `dist-cli/bin/cli.js` + `dist-cli/html/` (main JS ~2.39 MB, `dist-cli` ~7.6 MB).

## Publishing — LIVE

**`crowfoot@0.1.0` published 2026-08-06.** The first release went out by hand, because npm Trusted
Publishing is configured *per package* and [requires the package to already
exist](https://docs.npmjs.com/cli/v11/commands/npm-trust/) — there is no way to pre-register a
publisher for an unclaimed name. The Trusted Publisher was registered immediately after, so
**every subsequent release is tag-driven** (`git tag v<x> && git push origin v<x>`) through
`.github/workflows/release-crowfoot.yml` via OIDC, with no token anywhere.

The old name **`erdkit`** (≤ `0.4.1`) is deprecated on npm, pointing at `crowfoot`.

Packaging: `npm pack --dry-run` → **15 files**, with `LICENSE` and `NOTICE` both at the package root
(§4(a)/(d) for the package) **and** inside `dist-cli/html/` (so `erd build` output carries them — see
`deployment.md`). `scripts/pack-cli.js` strips `workspace:*` on `prepack` and restores on `postpack`
— **never remove that step**. The manifest declares no `@radix-ui`; `@crowfoot/ui` is inlined.

> The root `release` script (`turbo build --filter=crowfoot && pnpm publish`) is a manual fallback and
> **omits `--force`** — see the stale-cache trap in `testing.md`. The workflow does pin `--force`.
