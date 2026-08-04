// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import { useSubscribeShowModeCommand } from './useSubscribeSwitchShowMode'
import { useSubscribeTableVisibility } from './useSubscribeTableVisibility'
import { useSubscribeTidyUpCommand } from './useSubscribeTidyUpCommand'
import { useSubscribeZoomToFitCommand } from './useSubscribeZoomToFitCommand'

// ⌘C is deliberately not bound here: it belongs to the selection on the
// canvas. Copying the page link is a command-palette entry instead.
export const useSubscribeCommands = () => {
  useSubscribeShowModeCommand()
  useSubscribeTidyUpCommand()
  useSubscribeZoomToFitCommand()
  useSubscribeTableVisibility()
}
