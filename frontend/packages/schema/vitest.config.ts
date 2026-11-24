import * as path from 'node:path'
import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    globals: true,
    dir: path.resolve(__dirname, 'src'),
    environment: 'node',
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
