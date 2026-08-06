# UI Components

## Component Library
- Name: **`@liam-hq/ui`** — workspace-internal design system built on **Radix UI primitives**
- Import pattern: **manual, named, from the package root** — `import { Button, DropdownMenu } from '@liam-hq/ui'`
  (no auto-import; `src/index.ts` barrels `components`, `icons`, `logos`, `markers`, `styles`, `types`)
- Hooks entry: `@liam-hq/ui/hooks`
- CLAUDE.md rule: **import UI components and icons from `@liam-hq/ui` when available** — do not
  hand-roll a button, modal, dropdown, or context menu.

Available components (`frontend/packages/ui/src/components/`):
`ArrowTooltip · Avatar · BaseAppBar · BaseGlobalNav · BaseLayout · Button · Callout · Code ·
Collapsible · ContextMenu · CookieConsent · Drawer · DropdownMenu · GridTable · IconButton · Input ·
Modal · Popover · RadioGroup · RemoveButton · Resizable · RoundBadge · Select · Sidebar · Skeleton ·
Spinner · Switch · Tabs · Toast · Tooltip`

Radix primitives in use: dialog, dropdown-menu, context-menu, popover, select, tabs, toast, tooltip,
switch, radio-group, collapsible, slot. Plus `vaul` (drawer) and `react-resizable-panels`.

## Icons
- Library: **`lucide-react` 0.511.0**, re-exported through `@liam-hq/ui` (`src/icons/`)
- Usage: `import { ChevronDown } from '@liam-hq/ui'` → `<ChevronDown />`
- Project-specific SVGs live in `@liam-hq/ui/src/icons/` and `src/logos/` — add there, not inline

## Brand mark and colour (fork-owned)
- **`CrowfootLogoMark`** (`ui/src/logos/CrowfootLogoMark.tsx`) — one table joined to a crow's foot.
  4 elements, 2 strokes, drawn in **`currentColor`** so `LeftPane`'s `color: var(--overlay-70)` applies.
  Constraints it was designed against: must read at **12px** (`LeftPane.module.css:73`), single-colour
  silhouette, **no green** (upstream's `#1DED83` is Liam's brand green — a green mark would inherit the
  trade dress the rename exists to drop).
- **Brand colour: `#F59E0B` (amber), flat — no gradient.** Used by `banner.ts` and
  `cli/public/favicon.ico`. Chosen deliberately over sky→indigo, which is the default palette of
  generated work; leaving it would have let the product's colour settle by inaction.
- `LiamLogoMark` still exists but **nothing in the shipped packages imports it** — only `apps/app`
  does. It is scheduled to be deleted with that package, not before (removing it first only breaks
  root lint). Same for `CookieConsent`, which has zero consumers and still says "Liam ERD".
- Regenerating the favicon: render the mark's `rect`/`path` into an SVG wrapped in
  `translate(2.6 2.4) scale(0.8)` on a 24 grid (content bbox is x 0.5..23, y 4..20, so that centres
  it), then `sharp` → PNG → hand-assembled ICO. Recorded in the debranding plan under `_docs/`.

## Styling
- **CSS Modules only.** `Component.module.css` next to `Component.tsx`.
- Type definitions are **generated**, not written: `typed-css-modules` → `Component.module.css.d.ts`.
  Run `pnpm gen:css` (per package: `tcm src`, watch: `tcm src --watch`) after any class change,
  or `lint:tsc` will fail on the missing class.
- Class composition via `clsx`.
- Stylelint enforces `stylelint-config-recess-order` (property order) and
  `value-no-unknown-custom-properties` — **a misspelled CSS variable is a lint failure**.

## Design Tokens
All tokens are CSS custom properties. Two files:
- `@liam-hq/ui/src/styles/variables.css` — structural tokens (`:root`)
- `@liam-hq/ui/src/styles/Dark/variables.css` — the colour/spacing palette (this is the fork's source
  of truth for colour; also a `Mode 1/` set exists)

Token families:
| Family | Examples |
|---|---|
| Spacing | `--spacing-half`, `--spacing-1`, `--spacing-1half`, `--spacing-2` … `--spacing-30` |
| Colour | `--color-green-milk-100/200`, `--color-blue-milk-100/200`, `--color-yellow-milk-100/200`, `--color-gold-300/600`, `--color-teal-600`, `--color-vermilion-900`, `--color-red-milk-200`, `--color-gray-400`, `--overlay-20`, `--global-border`, `--primary-accent` |
| Z-index | `--z-index-toolbar-closed` 800 → `--z-index-cookie-consent` 4000 (**use these, never a literal**) |
| Motion | `--default-timing-function: ease-out`, `--default-animation-duration: 300ms`, `--default-hover-animation-duration: 100ms` |
| Type | `--main-font`, `--code-font` |
| Scrollbar | `--scrollbar-*` |

**CLAUDE.md rule:** use tokens for their intended purpose — `--spacing-*` is for margin/padding only;
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
Rationale (from the source comment): declared once centrally so components just use `var(--view-tint)`,
avoiding per-component duplication and inline style objects that would need a type assertion for a
custom property.

The palette is `VIEW_COLORS` in `erd-core/src/features/erd/utils/viewColor/viewColor.ts` — 12 keys,
**every value lifted from an existing design token**, declared `as const` with the type derived from it.
`--primary-accent` is deliberately excluded: it means "highlighted/hovered" and must not double as a
user-selectable colour. **If you add a colour, take it from the token file — do not invent a hex.**

### Component file shape
```
ComponentName/
├── ComponentName.tsx          // 'use client' when it uses hooks/DOM; named export only
├── ComponentName.module.css
├── ComponentName.module.css.d.ts   // generated — do not hand-edit
├── ComponentName.test.tsx     // colocated
└── index.ts                   // export { ComponentName } from './ComponentName'
```

### Canvas elements (memos, colour menu)
`MemoNode` and `ViewColorMenu` live under
`features/erd/components/ERDContent/components/`. Interactions gate on `editMode` from the
`userEditing` store — see `state-management.md`.

Memos are **React Flow nodes** (`nodeTypes.memo`), not an overlay, so selection,
multi-selection, dragging and `NodeResizer` come from React Flow. Anything that adds a
non-table node has to keep it out of two places: the ELK pass
(`computeAutoLayout` skips `node.type === 'memo'`) and the saved table positions
(`tableLayout.ts` filters to `type === 'table'`). Storage and `?memos=` are mirrors of the
node state, refreshed by `useMemoNodes().commitMemos`.

### Storybook
`frontend/internal-packages/storybook` (Storybook 9.1.15, `@storybook/nextjs`). Upstream-maintained;
the fork has not added stories.
