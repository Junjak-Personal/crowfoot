// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import { Box, render, Text } from 'ink'
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

// Kept to the 45 columns of the art above so it never wraps. The full
// attribution and the list of changes live in NOTICE, as section 4(d) asks.
const attribution = ' A fork of Liam ERD (Apache-2.0, ROUTE06, Inc.)'

const Banner = () => {
  const art = shouldDisableColors()
    ? // If colors are disabled, render plain text
      React.createElement(Text, {}, asciiArt)
    : // Otherwise, render with gradient
      React.createElement(Gradient, {
        colors: ourColors,
        // biome-ignore lint/correctness/noChildrenProp: TypeScript requires explicit children prop for this component
        children: React.createElement(Text, {}, asciiArt),
      })

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    art,
    React.createElement(Text, { dimColor: true }, attribution),
  )
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
