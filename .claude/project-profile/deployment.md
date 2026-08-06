# Deployment

The fork's delivery is **npm**, tag-triggered, via Trusted Publishing. Nothing else here deploys.

## CI/CD
- Platform: GitHub Actions — **7 workflows**
- Repo: `Junjak-Personal/crowfoot` (PUBLIC, `isFork: false`), default + working branch **`master`**

| Workflow | Purpose | Status |
|---|---|---|
| `release-crowfoot.yml` | **the release path** — tag `v*` → npm publish via OIDC | ★ active |
| `frontend-ci.yml` | `pnpm lint` + `erd-core` and `crowfoot` tests on PR | active (see gap below) |
| `codeql · dependency_review · ghalint · license · license-report-update` | inherited hygiene | inert |

> ⚠️ **CI test gap:** `frontend-ci.yml` runs only `pnpm --filter @crowfoot/erd-core test` and
> `pnpm --filter crowfoot test`. **`@crowfoot/schema` (562 tests) and `@crowfoot/ui` (30) never run in
> CI.** Run them locally.

> ⚠️ **Supply chain:** `codeql.yml` and `dependency_review.yml` call reusable workflows from
> **`route06/actions`** — upstream's org — pinned by full commit SHA. The SHA pin is the right control,
> so tampering is not the risk; availability and transitive resolution are. This is the last runtime
> tie to the upstream org after the repo split. Inlining them is ~25 lines. **Registered, not actioned.**

### `release-crowfoot.yml` — how publishing works
- **Trigger is a tag (`v*`), not a push** — the tag is both the release record and the deliberate act,
  so merging a version bump ships nothing on its own.
- **No npm token exists.** npm exchanges the workflow's OIDC identity (`id-token: write`) for a
  short-lived publish token and signs provenance with it.
- Node 22.21 ships npm 10.9, which predates trusted publishing — the workflow upgrades to
  `npm@^11.5.1` first. **Do not remove that step.**
- The tag is checked against `package.json` version; a mismatch fails the run.
- Build uses `--force` (see the stale-cache trap in `testing.md`).
- `concurrency` with `cancel-in-progress: false` — never cancel a half-finished publish.

### 🔴 First release — nothing has shipped yet

Measured 2026-08-06: `npm view crowfoot` → **404**, `git tag -l` → **empty**, so
`release-crowfoot.yml` has **never run**. The name is unclaimed. Only `erdkit` (≤ `0.4.1`) is on npm.

**The open question, and it must be answered before anything else:** npm Trusted Publishing is
configured *per package*, and this package does not exist on the registry. Either npm now permits
pre-registering a trusted publisher for an unpublished name, or the first `0.1.0` has to go out by
another route (a granular token, or `npm publish` by hand) and trusted publishing is configured
afterwards. **UNVERIFIED — check npm's current docs rather than assuming; this changed recently.**

Once that is settled, the mechanical part is small because the workflow already exists:
1. Owner registers the Trusted Publisher: `crowfoot` / GitHub Actions / `Junjak-Personal` / `crowfoot`
   / `release-crowfoot.yml`.
2. `git tag v0.1.0 && git push origin v0.1.0` — the workflow checks the tag against
   `package.json` version, builds with `--force`, and publishes via OIDC.
3. Verify: `npm view crowfoot version` and `npx crowfoot@0.1.0 erd build …` from a clean directory.
4. `npm deprecate erdkit "renamed to crowfoot; install crowfoot instead"`.

**Owner-only, never delegated:** every step above. The old `Junjak-Personal/erdkit` repo is **kept
archived** as the provenance record — do not delete it.

- Local gate: **lefthook `pre-commit` runs `pnpm lint`** with `stage_fixed: true`.
  ⚠️ On Windows the hook needs a **full** `pnpm install`. Watch `core.autocrlf`.

## Environments
| Env | Trigger | Notes |
|-----|---------|-------|
| Local | — | build → `erd build` → serve over HTTP (see `testing.md` → E2E Fixtures) |
| npm | tag `v*` | `crowfoot@0.1.0`, public, `bin=crowfoot` |

There is **no hosted environment owned by this repo.** Consumers (e.g. the carbon project) take the
CLI and deploy their own output; that delivery lives in their repo, not here.

## Environment Variables
- The viewer needs **no runtime env** — everything is a query param or a shipped JSON file.
- `turbo.json` `build.env` is **`[]`**. The Sentry / `NEXT_PUBLIC_ENV_NAME` variables went with the
  upstream app.
- `.env.template` was deleted (all 21 variables were upstream-app credentials). `pnpm create-env-files`
  still `touch`es `.env` / `.env.local` via `prebuild`/`prelint`; both are gitignored.
- Build-time only: `cli/vite-plugins/setEnv.ts` injects `VITE_CLI_VERSION_*` from local git —
  version, commit hash, commit date, branch-derived env name, and whether the local tag `v<version>`
  points at HEAD. **It performs no network I/O**; that was removed in `444f80d` along with an
  upstream git remote it used to add during builds.

> ⚠️ Known limit: `fetchGitBranch` uses `git rev-parse --abbrev-ref HEAD`, which returns `HEAD` on the
> detached tag checkout the release workflow performs — so published builds stamp `envName: 'preview'`,
> never `'production'`. Harmless (`envName` only reaches an in-page `dataLayer` array with no network
> egress) but the branch check never fires on the release path. Registered.

## Build Output
- Command: `pnpm build` (turbo) → `rollup -c` (CLI bin) + `vite build` (viewer SPA)
- Output: `dist-cli/bin/cli.js` (erd-core + schema inlined) and `dist-cli/html/`
  — main JS ~2.39 MB, `dist-cli` ~7.6 MB total
- Type: **SPA, fully static, relative paths** — mountable at any subpath without a rebuild
- Published tarball: **13 files**, including `LICENSE` and `NOTICE`. Declares **no `@radix-ui`** —
  `@crowfoot/ui` is a workspace dependency that gets inlined.

## 🟠 Repository hygiene findings (from the 2026-08-06 security audit)
- **`.npmrc` is tracked and not gitignored for credential lines.** A `pnpm login` at repo root would
  write an auth token straight into a tracked file. Add credential lines to `.gitignore`, or keep
  registry auth in `~/.npmrc` only.
- `.npmrc` `minimum-release-age-exclude` still lists `@electric-sql/pglite` (0 lockfile entries) and
  `next` / `@next/swc-*`. Note `next@15.4.8` + a ~124 MB swc binary are still **installed**, pulled by
  `nuqs`'s optional `next` peer under `autoInstallPeers`.
- `.github/CODEOWNERS` (`* @liam-hq/liam-dev`) and `SECURITY.md` still point at upstream. Pre-existing.
