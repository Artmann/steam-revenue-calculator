import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '~': path.resolve(import.meta.dirname, 'app') }
  },
  test: {
    environment: 'node',
    globalSetup: ['./vitest.global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    setupFiles: ['./vitest.setup.ts'],
    include: ['app/**/*.spec.{ts,tsx}']
  }
})
