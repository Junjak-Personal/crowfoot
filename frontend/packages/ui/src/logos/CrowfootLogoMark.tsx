// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { ComponentPropsWithoutRef, FC } from 'react'

type Props = ComponentPropsWithoutRef<'svg'>

// The zero-or-many cardinality marker, promoted to a logo mark. The geometry
// comes from CardinalityZeroOrManyLeftMarker — the ring plus a three-pronged
// fork — but the marker's stroke is ~4% of its viewBox, which disappears at
// the 12px the LeftPane renders an icon at. Stroke is 3/24 here so the mark
// survives down to 12px; the prong spread is widened from the marker's 26-30
// degrees to 35 so a wide-short mark still carries a square slot.
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
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx={7} cy={12} r={4} />
      <path d="M12.5 12h9M12.5 12l9-6.3M12.5 12l9 6.3" />
    </svg>
  )
}
