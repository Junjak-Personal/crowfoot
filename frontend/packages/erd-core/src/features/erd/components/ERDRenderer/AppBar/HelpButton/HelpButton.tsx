// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import {
  BookText,
  CircleHelp,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@liam-hq/ui'
import type { Ref } from 'react'
import styles from './HelpButton.module.css'
import { ReleaseVersion } from './ReleaseVersion'

type Props = {
  ref?: Ref<HTMLButtonElement>
}

const handleSelect = (url: string) => () => {
  window.open(url, '_blank', 'noreferrer')
}

export const HelpButton = ({ ref }: Props) => {
  return (
    <DropdownMenuRoot>
      <TooltipProvider>
        <TooltipRoot>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button ref={ref} type="button" className={styles.iconWrapper}>
                <CircleHelp className={styles.icon} />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent sideOffset={4}>Help</TooltipContent>
        </TooltipRoot>
      </TooltipProvider>

      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          sideOffset={4}
          className={styles.menuContent}
        >
          <ReleaseVersion />
          {/* Upstream's docs — the parser and schema formats are unchanged in
              this fork, so they still apply. Labelled so it does not read as
              this product's own documentation. */}
          <DropdownMenuItem
            size="sm"
            leftIcon={<BookText />}
            onSelect={handleSelect('https://liambx.com/docs')}
          >
            Parser Docs (upstream)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  )
}

HelpButton.displayName = 'HelpButton'
