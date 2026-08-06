# Deployment

> Two distinct realities. **Upstream CI** is inherited and largely inert for this fork. **The fork's
> own delivery is npm** (tag-triggered, Trusted Publishing) plus a **manual** S3/CloudFront push for
> the carbon ERD. Do not assume a workflow run means something shipped.

## CI/CD
- Platform: GitHub Actions — **7 workflows** (down from upstream's 17; the rest were dropped with the repo split)
- Repo: `Junjak-Personal/crowfoot` (PUBLIC, `isFork: false`), default + working branch **`master`**

| Workflow | Purpose | Fork status |
|---|---|---|
| `release-crowfoot.yml` | **the fork's release path** — tag `v*` → npm publish via OIDC | ★ active |
| `frontend-ci.yml` | `pnpm lint` + build/test on PR; `dorny/paths-filter` gates on `frontend/**` | usable |
| `codeql · ghalint · dependency_review · license · license-report-update` | inherited hygiene | inert |

### `release-crowfoot.yml` — how publishing actually works
- **Trigger is a tag (`v*`), not a push to master** — the tag is both the release record and the
  deliberate act, so merging a version bump ships nothing on its own.
- **No npm token exists anywhere.** npm exchanges the workflow's OIDC identity (`id-token: write`)
  for a short-lived publish token and signs provenance with it.
- Node 22.21 ships npm 10.9, which predates trusted publishing — the workflow upgrades to
  `npm@^11.5.1` first. Do not remove that step.
- The tag is checked against `package.json` version; a disagreement fails the run.
- Build uses `--force` (see `testing.md` → stale-bundle trap).
- `concurrency` is set with `cancel-in-progress: false` — never cancel a half-finished publish.

**Remaining manual step (owner, not agent):** register the npm Trusted Publisher —
`crowfoot` / GitHub Actions / `Junjak-Personal` / `crowfoot` / `release-crowfoot.yml`.
Also `npm deprecate erdkit "renamed to crowfoot; install crowfoot instead"`.
The old `Junjak-Personal/erdkit` repo is **kept as an archive** — original history is the provenance
record. Do not delete it.

- Local gate: **lefthook `pre-commit` runs `pnpm lint`** with `stage_fixed: true` (skipped on merge/rebase).
  ⚠️ On Windows the hook needs a **full `pnpm install`**, not a filtered one. Watch `core.autocrlf`.

## Environments
| Env | Branch | URL/Config |
|-----|--------|------------|
| Local | any | build → `erd build` → serve over HTTP (see `testing.md` → E2E Fixtures) |
| npm | tag `v*` | `crowfoot@0.1.0`, public, `bin=crowfoot` |
| carbon **stage** | manual | **https://carbon-stage.qesg.co.kr/erd/** — S3 `s3://carbon-estimate-dev/erd-stage/` behind CloudFront. Deployed by hand; 86 tables / 128 FKs. |
| carbon **dev** | — | **not configured** — CloudFront origin path is pinned to `/erd-stage`, so the dev domain shows the stage ERD |
| Production | — | none |

### CloudFront subpath mounting — the traps (all hit for real)
- CloudFront **does not strip the path-pattern prefix** before hitting the origin. `/erd/assets/x.js`
  + origin path `/erd-stage` → looks up `erd-stage/erd/assets/x.js`. A CF Function must remove the prefix.
- **Default root object applies only to the distribution root**, not `/erd/`. The function must append
  `index.html` itself.
- **S3 without `ListBucket` returns AccessDenied instead of 404** for missing keys — an apparent
  permissions error is usually a wrong path. Check the behavior's target origin first.
- **301 redirects drop the query string.** `/erd?edit=1` → `/erd/` loses `edit=1`. CF Functions expose
  `request.querystring` only as an object, so it must be reassembled by hand — lossless here because
  every param value is URL-safe base64 (verified).
- Invalidate **`/erd/*`, never `/*`** when the distribution is shared with the web app.

### carbon CI integration — reverted
Added to the backend repo as PR#368, fully reverted by PR#369 because it broke stage deploys.
- Direct cause: `COPY --from=amazon/aws-cli:2` — **the `:2` tag does not exist** (only `2.34.x` / `latest`).
- Root cause: the ERD image build sat on the deployment critical path (`docker/flyway.Dockerfile`),
  so an ERD failure halted migrations and the ECS deploy.
- Resume gate: **ECR permissions** (requested from infra) **+ the npm publish above**, which removes
  the clone-and-build chain entirely.
- Planned change-detection (measured, not implemented): fingerprint =
  `sha256(schema.json) + sha256(layout.json/memos.json) + CLI version`, stored at
  `<prefix>/_build/erd.fingerprint`. tbls output is deterministic (verified: identical sha256 across
  two extractions, zero timestamp fields). The fingerprint does **not** cover row counts, and
  "run only when flyway applied a migration" is explicitly rejected — the seed CLI mutates schema
  outside migrations.

## Environment Variables
- Access pattern: `process.env` (CLI/Node), `import.meta.env` (Vite viewer)
- Config files: `.env`, `.env.local` (both gitignored; `.env.template` is committed).
  `pnpm create-env-files` touches them and runs automatically via `prebuild` / `prelint`.
- Turbo-declared build env: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_DSN`,
  `NEXT_PUBLIC_ENV_NAME` (upstream app only)
- The fork's viewer needs **no runtime env** — everything is a query param or a shipped JSON file

## Build Output
- Command: `pnpm build` (turbo) → per package `rollup -c` (CLI bin) + `vite build` (viewer SPA)
- Output dirs: `dist-cli/bin/cli.js` (~3.4MB, erd-core + schema inlined) and `dist-cli/html/`
  (the SPA, copied over the user's `--output-dir` at `erd build` time)
- Type: **SPA, fully static, relative paths** — mountable at any subpath without a rebuild
- Deployed set: the whole `erd build` output including `dist/schema.json`, plus `LICENSE` and `NOTICE`
