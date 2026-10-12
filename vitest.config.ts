import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '~': path.resolve(__dirname, 'app') }
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['app/**/*.spec.{ts,tsx}']
  }
})
