// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { Group, type IconButton, Ungroup } from '@liam-hq/ui'
import {
  type ComponentProps,
  type FC,
  type ReactNode,
  useCallback,
} from 'react'
import { useVersionOrThrow } from '../../../../../../providers'
import { useUserEditingOrThrow } from '../../../../../../stores'
import { toolbarActionLogEvent } from '../../../../../gtm/utils'
import { ToolbarIconButton } from '../ToolbarIconButton'

type GroupToggleButtonProps = {
  children?: ReactNode
  size?: ComponentProps<typeof IconButton>['size']
}

/**
 * Switches between group view (boxes + labels on the canvas, sections in
 * the sidebar) and single view (today's flat list). A view preference, not
 * a mutation (F10), so — like FitviewButton and TidyUpButton — this never
 * gates on editMode.
 *
 * The label always names the action the click performs, not the current
 * state, mirroring LeftPane's Show All / Hide All swap: group view offers
 * "Single View", single view offers "Group View".
 */
export const GroupToggleButton: FC<GroupToggleButtonProps> = ({
  children = '',
  size = 'md',
}) => {
  const { showGroups, setShowGroups, showMode } = useUserEditingOrThrow()
  const { version } = useVersionOrThrow()

  const handleClick = useCallback(() => {
    toolbarActionLogEvent({
      element: 'toggleGroups',
      showMode,
      platform: version.displayedOn,
      gitHash: version.gitHash,
      ver: version.version,
      appEnv: version.envName,
    })
    setShowGroups(!showGroups)
  }, [showGroups, setShowGroups, showMode, version])

  const label = showGroups ? 'Single View' : 'Group View'

  return (
    <ToolbarIconButton
      onClick={handleClick}
      size={size}
      tooltipContent={label}
      label={label}
      icon={showGroups ? <Ungroup /> : <Group />}
    >
      {children}
    </ToolbarIconButton>
  )
}
