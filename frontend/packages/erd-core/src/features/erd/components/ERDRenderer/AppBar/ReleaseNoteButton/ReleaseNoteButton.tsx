// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import {
  Megaphone,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@liam-hq/ui'
import type { FC } from 'react'
import styles from './ReleaseNoteButton.module.css'

export const ReleaseNoteButton: FC = () => {
  return (
    <TooltipProvider>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <a
            href="https://github.com/Junjak-Personal/crowfoot/releases"
            target="_blank"
            rel="noreferrer"
            className={styles.iconWrapper}
          >
            <Megaphone className={styles.icon} />
          </a>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent sideOffset={4}>Release Notes</TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  )
}
