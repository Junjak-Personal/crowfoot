// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import * as ToolbarPrimitive from '@radix-ui/react-toolbar'
import type { FC, ReactNode } from 'react'
import styles from './DesktopToolbar.module.css'
import { DetailSettings } from './DetailSettings'
import { FitviewButton } from './FitviewButton'
import { GroupToggleButton } from './GroupToggleButton'
import { ShowModeMenu } from './ShowModeMenu'
import { TidyUpButton } from './TidyUpButton'
import { ZoomControls } from './ZoomControls'

type Props = {
  customActions?: ReactNode
}

export const DesktopToolbar: FC<Props> = ({ customActions }) => {
  return (
    <ToolbarPrimitive.Root
      className={styles.root}
      aria-label="Toolbar"
      data-testid="toolbar"
    >
      <ZoomControls />
      <ToolbarPrimitive.Separator className={styles.separator} />
      <div className={styles.buttons}>
        <FitviewButton />
        <TidyUpButton />
        <GroupToggleButton />
        <DetailSettings />
        {customActions}
      </div>
      <ToolbarPrimitive.Separator className={styles.separator} />
      <ShowModeMenu />
    </ToolbarPrimitive.Root>
  )
}
