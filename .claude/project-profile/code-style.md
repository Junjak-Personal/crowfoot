# Code Style

Derived from `frontend/internal-packages/configs/biome.jsonc` (the SSOT) + 8 sampled source files
in `erd-core` / `schema` / `cli`.

## Formatting — Biome 2.2.6 (formatter AND linter; Prettier is NOT used)
- Indent: **2 spaces**
- Line width: **80**
- Quotes: **single** (JS and CSS)
- Semicolons: **asNeeded** (i.e. effectively no trailing semicolons)
- Self-closing elements: required (`useSelfClosingElements`)
- Import organization: **on** (Biome assist `source.organizeImports`) — do not hand-sort
- `package.json` and `eslint-suppressions.json` are excluded from the formatter (syncpack owns them)
- CSS: `cssModules: true` parser. **Stylelint was removed in `444f80d`** — property ordering and
  `value-no-unknown-custom-properties` are no longer enforced anywhere. What does still apply is
  eslint's `css-modules-kit/no-unused-class-names`, which cannot see dynamic `styles[variant]`
  access; those files are listed in `<pkg>/eslint-suppressions.json`.

Commands: `pnpm fmt` (write) · `pnpm lint` (check). `lefthook` runs `pnpm lint` on **pre-commit**
with `stage_fixed: true`.

## Import Patterns
- Style: **named imports only** — `export default` is banned by project convention (CLAUDE.md)
- Type imports use the inline form: `import { type FC, useCallback } from 'react'`,
  `import type { TableNodeType } from '../../features/erd/types'`
- Paths: **relative** within a package (`'../viewColor'`, `'./context'`); **package specifiers**
  across packages (`'@crowfoot/ui'`, `'@crowfoot/schema/parser'`)
- `@/` alias exists in `erd-core`'s vitest config but source code uses relative paths — **follow the
  relative-path convention**
- Node builtins are prefixed: `import { cpSync } from 'node:fs'`
- Barrel `index.ts` per module dir re-exports the public surface

## Naming
- Variables / functions: `camelCase`
- Types / Interfaces / Components: `PascalCase`
- Module-level constants: `SCREAMING_SNAKE_CASE` (`VIEW_COLORS`, `DEFAULT_MEMO_WIDTH`, `STORAGE_KEY`)
- Event handlers: **`handle` prefix** (`handleClick`, `handleShiftSelection`) — enforced by CLAUDE.md
- Type guards: `isXxx` returning `value is T` (`isViewColorKey`)
- Private module locals: leading `_` for the shadowed original (`_setActiveTableName`)

## Code Ordering (consistent across sampled files)
1. License header (see `structure.md` → Apache-2.0 header convention) — **before** `'use client'`
2. `'use client'` directive (erd-core components/providers)
3. Imports (Biome-organized)
4. Module-level constants / parsers / types
5. Exported `const` arrow functions and components
6. Local helpers below their first use, or above if shared

## Conventions the codebase actually enforces
- **`const` arrow functions, not `function` declarations** — `export const foo = () => {}`
- Explicit return types on exported utils (`(key: string | undefined): string | null`)
- `as const` on literal tables (`VIEW_COLORS`), then derive types from them
  (`type ViewColorKey = (typeof VIEW_COLORS)[number]['key']`) — do not hand-write the union
- **Early returns** over nested conditionals (CLAUDE.md; `noUselessElse` is an error)
- **Runtime validation with Valibot** at every external boundary (URL params, JSON files, parser input)
- `noConsole: error` — only `warn` / `error` / `info` / `debug` are allowed. `console.log` fails lint.
- `noExcessiveCognitiveComplexity: error` — long functions must be decomposed (see how
  `updateSelectedNodeIds` splits into `handleShiftSelection` / `handleCtrlSelection` / `handleSingleSelection`)
- `useExhaustiveDependencies: error` — hook dep arrays are lint-enforced, not advisory
- `noCommonJs: error`, `useDateNow: error`, `noInferrableTypes: error`, `useAsConstAssertion: error`
- Comments explain **why**, not what — and they are used sparingly, for non-obvious decisions
  (e.g. *"'replace' rather than 'push': editing the view should not fill up the back button"*).
  CLAUDE.md: *"If you need a multi-paragraph comment, refactor until intent is obvious."*
- **No backward-compat shims.** Update all call sites together; no optional-param fallbacks.
- Exact dependency versions only (`save-exact=true`) — never write `^x.y.z` into a `package.json`.
