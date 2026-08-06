// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { ComponentPropsWithoutRef, FC } from 'react'

type Props = ComponentPropsWithoutRef<'svg'>

// A table joined to a crow's foot — the smallest thing that is still an ERD.
// The second table is left out on purpose: the crow's foot already says "many
// on the other end", so the relationship reads as continuing off-canvas, and
// one table gets the whole 24 grid instead of two splitting it. That matters
// because LeftPane renders this at 12px (LeftPane.module.css:73), where a
// 24-unit grid is half a pixel per unit and a second box would collapse the
// prongs into each other. Drawn in currentColor so that pane's
// `color: var(--overlay-70)` still applies.
export const CrowfootLogoMark: FC<Props> = (props) => {
  return (
    <svg
      role="img"
      aria-label="crowfoot"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x={1.5} y={5} width={10} height={14} rx={1.8} />
      <path d="M11.5 12H15M15 12H22M15 12L22 6.8M15 12L22 17.2" />
    </svg>
  )
}
