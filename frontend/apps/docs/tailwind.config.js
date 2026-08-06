import { createPreset } from 'fumadocs-ui/tailwind-plugin'

/** @type {import('tailwindcss').Config} */
const config = {
  presets: [
    createPreset({
      cssPrefix: 'fd',
    }),
  ],
}

export default config
