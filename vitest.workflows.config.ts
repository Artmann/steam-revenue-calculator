import path from 'node:path'
import { workflow } from '@workflow/vitest'
import { defineConfig } from 'vitest/config'

// Runs the compiled workflows in-process on the Local World. The plugin scans
// the whole project for directives and cannot ignore build/, so the
// test:workflows script deletes build/ first.
export default defineConfig({
  plugins: [workflow()],
  resolve: {
    alias: { '~': path.resolve(__dirname, 'app') }
  },
  test: {
    environment: 'node',
    globalSetup: ['./vitest.global-setup.ts'],
    include: ['workflows/**/*.spec.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000
  }
})
