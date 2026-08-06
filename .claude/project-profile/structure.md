# Project Structure

## Directory Layout

```
crowfoot/
├── frontend/
│   ├── packages/
│   │   ├── cli/            crowfoot            ★ the published CLI + viewer host
│   │   ├── erd-core/       @crowfoot/erd-core   the ERD viewer (React + xyflow)
│   │   ├── schema/         @crowfoot/schema     parsers + deparsers (incl. fork's MySQL deparser)
│   │   └── ui/             @crowfoot/ui         design system (Radix + CSS Modules + tokens)
│   └── internal-packages/
│       ├── configs/        @crowfoot/configs    shared biome/tsconfig/eslint presets
│       └── neverthrow/     @crowfoot/neverthrow Result-type helpers
├── _docs/                  ★ project docs — plans, findings. Start at `_docs/index.md`.
├── _note/                  human-owned scratch notes — agent READ-ONLY
├── docs/                   upstream documentation. Only 4 files survive; see below.
├── config/                 license_finder config (dependency_decisions.yml)
├── scripts/                (empty of upstream helpers — the Supabase scripts were removed)
├── .github/workflows/      7 workflows — `release-crowfoot.yml` is the fork's; rest inherited
├── NOTICE                  ★ Apache-2.0 §4(d) attribution + numbered change summary (12 items)
├── LICENSE                 Apache-2.0
├── biome.jsonc  turbo.json  vitest.config.ts  lefthook.yml  knip.jsonc  .syncpackrc
└── pnpm-workspace.yaml  .npmrc  .node-version
```

**No `.gitmodules`** — plain monorepo, `submodule-worktree` does not apply.
**There is no `frontend/apps/`.** All four upstream apps were deleted in `444f80d`.

`docs/` retains exactly four files, all deliberately: `test-principles.md` (CLAUDE.md references it),
`packages-license.md` (§4 reference), `usage.md` + `usage_en.md` (fork-owned). Everything else in
`docs/` was upstream-product documentation and is gone. **Do not add fork docs to `docs/` — use `_docs/`.**

## Fork work surface

**Base commit `f4dd6c4`** ("Liam ERD at 92156eac5, the base this fork was taken from") — the squashed
upstream root. `git diff f4dd6c4..HEAD` is the authoritative diff.

Every one of the 6 packages is now the fork's work surface — there is no longer an "upstream half"
to stay out of. What remains of upstream is *inside* these packages, marked by the §4(b) headers.

### 🔴 Apache-2.0 — attribution (§4) and trademark (§6) pull in OPPOSITE directions

The single most dangerous thing to get wrong here.

**§4(b) headers are MANDATORY and must survive** — currently **92 files**. Add one to any file you
create or modify.

Modified upstream file (TS/TSX):
```ts
// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
```
New fork-only file:
```ts
// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
```
CSS uses the same text in `/* … */`. When the *nature* of a change shifts, update `NOTICE` too.

**Counting them correctly matters** — the gate is a diff, not a number:
```bash
git grep -lE "Modified from the original Liam ERD source|Added in crowfoot; not part of the original Liam ERD source" \
  -- frontend/packages | sort            # => 92 files
```
Both wordings, scoped to `frontend/packages`. Grepping only `"Modified from"` returns **43** and looks
like catastrophic loss.

> **A blanket "Liam" find-and-replace turns a §6 cleanup into a §4 violation** — it strips these
> headers. **Branding is removed; attribution stays.** `LICENSE`, `NOTICE`, `docs/packages-license.md`
> and `frontend/packages/cli/scripts/pack-cli.js` are preserved for the same reason.
>
> The `erdkit` → `crowfoot` rename was safe only because the §4 wording never contained that word.
> **Do not generalise from it.**

Legitimate remaining `Liam` references, all of which must stay: attribution headers · the banner and
`--help` attribution strings · upstream doc links that are still accurate (labelled `(upstream)`) ·
upstream issue citations in `schema` parser comments.

## Routing Pattern
- No router. The viewer is a single-page canvas; **URL query params are the state transport**
  (`?positions=`, `?colors=`, `?memos=`, `?hidden=`, `?active=`, `?show=`, `?edit=`).
- Artifact paths are all relative (`./assets/…`, `fetch("./schema.json")`), so the build mounts under
  any subpath (e.g. `/erd/`) **without a rebuild**.

## Module Organization (erd-core — the pattern to mirror)
```
src/
├── features/<feature>/          # erd, diff, gtm, reactflow
│   ├── components/<Component>/  # PascalCase dir: Component.tsx + Component.module.css + index.ts
│   ├── hooks/
│   ├── utils/<util>/            # util.ts + util.test.ts + index.ts  ← fork's new logic lives here
│   └── types.ts
├── stores/<store>/              # context.ts + Provider.tsx + hooks.ts + index.ts
├── schemas/                     # valibot schemas (queryParam, hash, showMode, version)
├── styles/  hooks/  providers/  utils/  types/  nextjs/
└── index.ts                     # package entry, re-exports
```
- Utilities: `src/features/<feature>/utils/<name>/` — **one directory per util, colocated test, `index.ts`**
- Shared components: `@crowfoot/ui`

## Naming Conventions
- Directories (components): `PascalCase/` · (utils/features/stores): `camelCase/`
- Component files: `PascalCase.tsx` + `PascalCase.module.css` (+ generated `.d.ts`)
- Barrels: every module dir has an `index.ts` re-exporting the public surface (named exports only)
- Tests: `*.test.ts(x)`, **colocated** (no `__tests__/`, except upstream's `schema/src/parser/__tests__/`)

## 🔴 `git rm` leaves directories behind

Deleting a component or package removes only **tracked** files. The gitignored `*.module.css.d.ts`
generated next to each stylesheet stays, so the directory survives and every tool still sees it —
knip will report the residue as unused files and root lint fails. This bit twice during `444f80d`.

After any deletion, check for directories with zero tracked files and `rm -rf` them:
```bash
find frontend -type d -not -path "*/node_modules/*" -not -path "*/dist*" | while read -r d; do
  [ -z "$(ls -A "$d" 2>/dev/null)" ] && continue
  [ "$(git ls-files "$d" | wc -l)" -eq 0 ] && echo "$d"
done
```
Never reach for `git clean -xdf` here — it also removes `node_modules` and `.claude/session-state/`.
