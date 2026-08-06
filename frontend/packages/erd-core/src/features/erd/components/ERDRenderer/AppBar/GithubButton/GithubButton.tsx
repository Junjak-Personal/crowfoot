// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import {
  GithubLogo,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@liam-hq/ui'
import type { FC } from 'react'
import styles from './GithubButton.module.css'

export const GithubButton: FC = () => {
  return (
    <TooltipProvider>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <a
            href="https://github.com/Junjak-Personal/crowfoot"
            target="_blank"
            rel="noreferrer"
            className={styles.iconWrapper}
          >
            <GithubLogo className={styles.icon} />
          </a>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent sideOffset={4}>Go to Github</TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  )
}
