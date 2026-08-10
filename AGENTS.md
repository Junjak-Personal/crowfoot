# Repository Guidelines

Read `CLAUDE.md` first — it carries the rules that override defaults. Test
philosophy is in `docs/test-principles.md`; plans and findings live in `_docs/`
(start at `_docs/index.md`).

## Project Structure & Modules
- frontend/packages/*: Shared libraries and tools (`schema`, `erd-core`, `cli`, `ui`).
- frontend/internal-packages/*: Shared tooling (`configs`, `neverthrow`).
- assets/: Images and media. docs/: Documentation.

## Build, Test, and Development
- Install: `pnpm install`
- All packages (Turbo):
  - Dev: `pnpm dev` (or one package: `pnpm -F crowfoot dev`)
  - Build: `pnpm build`
  - Test (unit): `pnpm test`
  - Coverage: `pnpm test:coverage`

## Coding Style & Naming
- Language: TypeScript/TSX; React components in PascalCase (e.g., `App.tsx`); utilities in camelCase (e.g., `mergeSchema.ts`).
- CSS Modules: `*.module.css` with typed CSS via `typed-css-modules`.
- Lint/Format: Biome and ESLint. Run `pnpm fmt` and `pnpm lint`. Pre-commit hooks run `pnpm lint` (see `lefthook.yml`).

## Testing Guidelines
- Unit tests: Vitest. Place near source as `*.test.ts(x)` or in `__tests__/`.
- Commands: `pnpm test` for unit, `pnpm test:coverage` for V8 coverage.

## Commit & Pull Requests
- Commit style: **gitmoji** — the emoji itself (`✨`), not `:sparkles:`. `.claude/commands/commit.md` is the convention this repo follows and is checked in. History up to `59f5a77` predates it and uses Conventional Commits; do not mix the two going forward.
- Before pushing: `pnpm fmt && pnpm lint && pnpm test`.
- PRs: clear description, linked issues, screenshots for UI changes, and note any env or migration impacts. Template: `.github/pull_request_template.md`.

## Releasing
Bump `version` in `frontend/packages/cli/package.json`, add the section to `CHANGELOG.md`, commit, then push a `v<version>` tag.

`.github/workflows/release-crowfoot.yml` is triggered by that tag. It verifies the tag matches the manifest, runs lint and both test suites, builds, checks the generated site still carries its attribution, then publishes to npm over OIDC trusted publishing and opens the GitHub Release.

There are **no npm tokens anywhere**, by design — a lefthook hook rejects `_authToken` committed to `.npmrc`. The root `release` script publishes straight from a laptop, bypassing every check above; it is not the path this project uses.

## Security & Configuration
- Environment: use `.env`/`.env.local` (created automatically by `pnpm prebuild`). Never commit secrets.

## Tips
- Target a single package with `pnpm -F <package-name> <script>`.
- Use Turbo filters when running large tasks locally for faster feedback.
