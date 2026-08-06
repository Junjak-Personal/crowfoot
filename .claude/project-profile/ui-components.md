# UI Components

## Component Library
- Name: **`@liam-hq/ui`** — workspace-internal design system built on **Radix UI primitives**
- Import pattern: **manual, named, from the package root** — `import { Button, DropdownMenuRoot } from '@liam-hq/ui'`
  (`src/index.ts` barrels `components`, `icons`, `logos`, `markers`, `styles`)
- Hooks entry: `@liam-hq/ui/hooks`
- CLAUDE.md rule: **import UI components and icons from `@liam-hq/ui` when available** — do not
  hand-roll a button, modal, dropdown, or context menu.

### The 22 components

**Consumed by `erd-core` / `cli` today** (change these carefully — they render):
`Button · ContextMenu · Drawer · DropdownMenu · GridTable · IconButton · RadioGroup · Resizable ·
Sidebar · Spinner · Toast · Tooltip`

**Kept for future feature work, zero consumers** (restored deliberately in `be485b4`):
`Callout · Collapsible · Input · Modal · Popover · RoundBadge · Select · Skeleton · Switch · Tabs`

> 🔴 The second group is **unverified surface**. `tsc` never checks it against real usage, there is no
> storybook to preview it, and **knip cannot flag it** — `ui/src/index.ts` is an entry file, so unused
> exports are invisible without `includeEntryExports`, which the gate does not set. The first time you
> use one of these, treat it as new code: read it, don't trust it.

**Deleted with the upstream app** (`444f80d`) — do not resurrect without reason:
`Avatar · ArrowTooltip · BaseAppBar · BaseGlobalNav · BaseLayout · Code · CookieConsent · RemoveButton`
(`CookieConsent` additionally carried Liam branding in its heading.)

Radix primitives in use (12): context-menu, collapsible, dialog, dropdown-menu, popover, radio-group,
select, slot, switch, tabs, toast, tooltip. Plus `vaul` (drawer) and `react-resizable-panels`.

**Restoring something from history** is one command — the components live in `444f80d^`:
```bash
git checkout 444f80d^ -- frontend/packages/ui/src/components/<Name>/
git rm frontend/packages/ui/src/components/<Name>/<Name>.stories.tsx   # no storybook hosts these
# then: add its @radix-ui dep to ui/package.json, re-export from components/index.ts,
#       pnpm install && pnpm --filter @liam-hq/ui gen:css
```

## Icons
- Library: **`lucide-react` 0.511.0**, re-exported through `@liam-hq/ui` (`src/icons/`)
- Usage: `import { ChevronDown } from '@liam-hq/ui'` → `<ChevronDown />`
- The re-export list was pruned to what is actually used — **adding an icon means adding it to
  `icons/index.ts`**, it is not a blanket re-export of lucide.
- ⚠️ Some components import icons by **internal relative path** (`Sidebar.tsx` → `'../../icons'`,
  `Select.tsx` → `'../..'`). A cross-package usage scan will miss those; `tsc` catches it as TS2305.

## Brand mark and colour (fork-owned)
- **`CrowfootLogoMark`** (`ui/src/logos/CrowfootLogoMark.tsx`) — one table joined to a crow's foot.
  4 elements, 2 strokes, **`currentColor`** so `LeftPane`'s `color: var(--overlay-70)` applies.
  Constraints: must read at **12px** (`LeftPane.module.css:73`), single-colour silhouette, **no green**
  (upstream's `#1DED83` is Liam's brand green — a green mark inherits the trade dress).
- **Brand colour `#F59E0B` (amber), flat — no gradient.** Used by `banner.ts` and `cli/public/favicon.ico`.
  Chosen deliberately over sky→indigo, the default palette of generated work.
- Remaining logos: `CrowfootLogoMark`, `GithubLogo`. The Liam marks, `LinkedInLogo` and `XLogo` are gone.
- **`markers/` (3) are load-bearing** — `erd-core`'s `CardinalityMarkers.tsx` renders them on edges.
  The matching *icons* were deleted; the markers were not. Do not confuse them.
- Regenerating the favicon: render the mark's `rect`/`path` into an SVG wrapped in
  `translate(2.6 2.4) scale(0.8)` on a 24 grid (content bbox x 0.5..23, y 4..20 centres it), then
  `sharp` → PNG → hand-assembled ICO. Recipe in the completed debranding plan under `_docs/complete/`.

## Styling
- **CSS Modules only.** `Component.module.css` next to `Component.tsx`.
- Type definitions are **generated**: `typed-css-modules` → `Component.module.css.d.ts`. Run
  `pnpm gen:css` after any class change, or `lint:tsc` fails on the missing class.
- Class composition via `clsx`.
- **stylelint is gone** (`444f80d`) — it was never in the root gate and had ~79 standing findings.
- ⚠️ `eslint`'s `css-modules-kit/no-unused-class-names` cannot see **dynamic** access
  (`styles[variant]`). `Callout` and `RoundBadge` do exactly that, and are listed in
  `ui/eslint-suppressions.json` for it. If you add a variant-indexed component, expect the same.

## Design Tokens
CSS custom properties in `@liam-hq/ui/src/styles/variables.css` (`:root`) and
`styles/Dark/variables.css` (the colour/spacing palette — the fork's source of truth for colour).

| Family | Examples |
|---|---|
| Spacing | `--spacing-half`, `--spacing-1` … `--spacing-30` |
| Colour | `--color-green-milk-100/200`, `--color-gold-300/600`, `--overlay-20`, `--global-border`, `--primary-accent` |
| Z-index | `--z-index-toolbar-closed` 800 → `--z-index-cookie-consent` 4000 (**use these, never a literal**) |
| Motion | `--default-timing-function`, `--default-animation-duration` |
| Type | `--main-font`, `--code-font` |

**CLAUDE.md rule:** use tokens for their intended purpose — `--spacing-*` for margin/padding only;
widths and heights use `rem`/`px`.

## Common Patterns

### Colour tinting (fork pattern — follow this for any new tintable surface)
Colours are applied as a **`data-view-color` attribute**, not an inline style:
```css
/* erd-core/src/styles/globals.css */
[data-view-color='green'] { --view-tint: var(--color-green-milk-200); }
```
```tsx
<div data-view-color={color}> … </div>   /* CSS reads var(--view-tint) */
```
Declared once centrally so components just use `var(--view-tint)` — no per-component duplication and
no inline style object needing a type assertion for a custom property.

The palette is `VIEW_COLORS` in `erd-core/src/features/erd/utils/viewColor/viewColor.ts` — 12 keys,
**every value lifted from an existing design token**, declared `as const` with the type derived from it.
`--primary-accent` is deliberately excluded: it means "highlighted/hovered". **If you add a colour,
take it from the token file — do not invent a hex.**

### Component file shape
```
ComponentName/
├── ComponentName.tsx          // 'use client' when it uses hooks/DOM; named export only
├── ComponentName.module.css
├── ComponentName.module.css.d.ts   // generated — do not hand-edit
└── index.ts                   // export { ComponentName } from './ComponentName'
```
**No `.stories.tsx`** — storybook was removed; an unhostable story file is reported as an unused file
and breaks root lint.

### Canvas elements (memos, colour menu)
`MemoNode` and `ViewColorMenu` live under `features/erd/components/ERDContent/components/`.
Interactions gate on `editMode` from the `userEditing` store — see `state-management.md`.

Memos are **React Flow nodes** (`nodeTypes.memo`), not an overlay, so selection, multi-selection,
dragging and `NodeResizer` come from React Flow. Anything adding a non-table node must keep it out of
two places: the ELK pass (`computeAutoLayout` skips `node.type === 'memo'`) and the saved table
positions (`tableLayout.ts` filters to `type === 'table'`).
