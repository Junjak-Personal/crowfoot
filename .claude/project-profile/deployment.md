# Deployment

> Two distinct realities here. **Upstream CI** (17 GitHub Actions workflows) is inherited and largely
> inert for this fork; the two npm-publish workflows were deleted outright (see CI/CD below). **The fork's actual delivery path is manual.** Do not assume a workflow run
> means anything shipped.

## CI/CD
- Platform: GitHub Actions (`.github/workflows/`, 17 files, inherited)
- Fork repo: `Junjak-Personal/crowfoot`, working branch `feature/erd-view-customization`
- Relevant inherited workflows:

| Workflow | Purpose | Fork status |
|---|---|---|
| `frontend-ci.yml` | `pnpm lint` + build/test on PR; `dorny/paths-filter` gates on `frontend/**` etc. | usable |
| ~~`release.yml`~~ · ~~`released_package_test.yml`~~ | changesets auto-publish + published-tarball smoke test | **deleted** — both were bound to `@liam-hq/cli`, had no secrets under the fork, and npm Trusted Publishing is pinned to `liam-hq/liam`. Publishing is now manual: `pnpm release` at the repo root. |
| `e2e_tests.yml` | Playwright against the Next.js app | not applicable to the fork |
| `codeql · ghalint · dependency_review · license · stale · renovate` | inherited hygiene | inert |
| `database-ci · check-schema-drift · agent-deep-modeling · notify_supabase_failure · discussion-comment-to-slack · figma-to-css-variables · add_assignee_to_pr · license-report-update` | upstream-product specific | inert |

- Local gate: **lefthook `pre-commit` runs `pnpm lint`** with `stage_fixed: true`
  (skipped on merge/rebase). ⚠️ On Windows the hook needs a **full `pnpm install`** — a filtered
  install does not satisfy it.

## Environments
| Env | Branch | URL/Config |
|-----|--------|------------|
| Local | any | `pnpm turbo build --filter=crowfoot` → `erd build` → serve `dist/` over HTTP (`npx serve dist/`) |
| carbon **stage** | manual | **https://carbon-stage.qesg.co.kr/erd/** — S3 `s3://carbon-estimate-dev/erd-stage/` behind CloudFront. Deployed by hand 2026-08-03; 86 tables / 128 FKs. |
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
- Root cause: the ERD image build was placed on the deployment critical path (`docker/flyway.Dockerfile`),
  so an ERD failure halted migrations and the ECS deploy.
- Resume gate: **ECR permissions** (requested from infra).
- Planned change-detection (measured, not implemented): fingerprint =
  `sha256(schema.json) + sha256(layout.json/memos.json) + CLI version`, stored at
  `<prefix>/_build/erd.fingerprint`. tbls output is deterministic (verified: identical sha256 across
  two extractions, zero timestamp fields). Note the fingerprint does **not** cover row counts, and
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
- Output dirs: `dist-cli/bin/cli.js` (~3.5MB, erd-core + schema inlined) and `dist-cli/html/`
  (the SPA, copied over the user's `--output-dir` at `erd build` time)
- Type: **SPA, fully static, relative paths** — mountable at any subpath without a rebuild
- Deployed set: the whole `erd build` output including `dist/schema.json`, plus `LICENSE` and `NOTICE`
  (already satisfied on the S3 path)

## Publishing (next milestone — blocked)
Target: `npx <pkg> erd build --format=tbls --input schema.json --output-dir dist`, replacing the
current 5-step clone→`pnpm install`→`turbo build`→`node …/cli.js` chain.

Before any `npm publish`:
1. 🔴 **Add `NOTICE` to `files`** in `frontend/packages/cli/package.json` (currently
   `["dist-cli/**/*"]`). npm auto-includes LICENSE but **not** NOTICE → Apache-2.0 §4(d) violation.
   NOTICE also lives at the repo root, so it must be copied into the package (extend `prepack`).
2. 🔴 **Rename** `name` / `bin` / `repository` / `homepage` / `bugs`, and reset `version` to `0.1.0`.
   Apache-2.0 §6 grants no trademark rights; "Liam" is ROUTE06's product name.
3. 🔴 **Run `npm pack` and inspect the tarball** — confirm `dist-cli/html/` and `NOTICE` are actually
   in it. The self-contained claim is code-reading only and has **never been executed**.
4. Install the tarball in a temp dir and run `erd build` before publishing.

Also decided: publish **public** (both personal and third-party projects consume it; the fork is
already public). Publishing removes the `LIAM_CUSTOM_REF` hazard in carbon CI, where an empty ref
silently checked out the fork's pristine `main` and "successfully" built an ERD with none of the
customizations — a silent degradation, not a failure.
