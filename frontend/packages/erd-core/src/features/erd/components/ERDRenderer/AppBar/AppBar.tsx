// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import {
  CrowfootLogoMark,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@liam-hq/ui'
import type { FC } from 'react'
import { CommandPaletteTriggerButton } from '../CommandPalette'
import styles from './AppBar.module.css'
import { CopyLinkButton } from './CopyLinkButton'
import { ExportDropdown } from './ExportDropdown'
import { GithubButton } from './GithubButton'
import { HelpButton } from './HelpButton'
import { MenuButton } from './MenuButton'
import { ReleaseNoteButton } from './ReleaseNoteButton'

export const AppBar: FC = () => {
  return (
    <header className={styles.wrapper}>
      <div className={styles.menuButtonWrapper}>
        <MenuButton />
      </div>
      <div className={styles.logoWrapper}>
        <TooltipProvider>
          <TooltipRoot>
            <TooltipTrigger asChild>
              <a
                href="https://github.com/Junjak-Personal/crowfoot"
                target="_blank"
                rel="noreferrer"
                className={styles.iconWrapper}
              >
                <CrowfootLogoMark className={styles.logo} />
              </a>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent sideOffset={4}>
                Go to the repository
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
        </TooltipProvider>
      </div>

      <h1 className={styles.title}>Crowfoot</h1>

      <div className={styles.rightSide}>
        <div className={styles.iconButtonGroup}>
          <CommandPaletteTriggerButton />
          <GithubButton />
          <ReleaseNoteButton />
          <HelpButton />
        </div>
        <ExportDropdown />
        <CopyLinkButton />
      </div>
    </header>
  )
}
