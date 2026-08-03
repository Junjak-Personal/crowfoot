// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import { render, Text } from 'ink'
import Gradient from 'ink-gradient'
import React from 'react'

const ourColors = ['#1DED83', '#B4FED7']

// Check if colors should be disabled
const shouldDisableColors = () => {
  // Check NO_COLOR environment variable (see https://no-color.org/)
  if (process.env.NO_COLOR) return true

  // NOTE: `chalk` already handles `FORCE_COLOR=0`
  // NOTE: `chalk` already handles `TERM=dumb`

  return false
}

// The ASCII art is based on the output of `oh-my-logo`.
// see https://github.com/shinshin86/oh-my-logo

// ponytail: 45 cols fits any terminal, so the upstream long/short variant split is gone
const asciiArt = `
 ███████╗██████╗ ██████╗ ██╗  ██╗██╗████████╗
 ██╔════╝██╔══██╗██╔══██╗██║ ██╔╝██║╚══██╔══╝
 █████╗  ██████╔╝██║  ██║█████╔╝ ██║   ██║
 ██╔══╝  ██╔══██╗██║  ██║██╔═██╗ ██║   ██║
 ███████╗██║  ██║██████╔╝██║  ██╗██║   ██║
 ╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝   ╚═╝
`

const Banner = () => {
  // If colors are disabled, render plain text
  if (shouldDisableColors()) {
    return React.createElement(Text, {}, asciiArt)
  }

  // Otherwise, render with gradient
  return React.createElement(Gradient, {
    colors: ourColors,
    // biome-ignore lint/correctness/noChildrenProp: TypeScript requires explicit children prop for this component
    children: React.createElement(Text, {}, asciiArt),
  })
}

export const generateBanner = (): Promise<void> => {
  return new Promise<void>((resolve) => {
    const { unmount } = render(React.createElement(Banner))

    // Wait for rendering to complete before unmounting
    setTimeout(() => {
      unmount()
      resolve(undefined)
    }, 200)
  })
}
