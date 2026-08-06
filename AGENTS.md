# Repository Guidelines

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
- Commit style: Conventional Commits (e.g., `feat:`, `fix:`, `chore(deps): ...`).
- Before pushing: `pnpm fmt && pnpm lint && pnpm test`.
- PRs: clear description, linked issues, screenshots for UI changes, and note any env or migration impacts.
- Versioning: bump `version` in `frontend/packages/cli/package.json` by hand, then `pnpm release` (build + `npm publish`). There is no changesets/CI publish path.

## Security & Configuration
- Environment: use `.env`/`.env.local` (created automatically by `pnpm prebuild`). Never commit secrets.

## Tips
- Target a single package with `pnpm -F <package-name> <script>`.
- Use Turbo filters when running large tasks locally for faster feedback.
