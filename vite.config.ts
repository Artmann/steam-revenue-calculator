import mdx from '@mdx-js/rollup'
import { reactRouter } from '@react-router/dev/vite'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { workflow } from 'workflow/vite'

import reactRouterConfig from './react-router.config'

const buildDirectory = reactRouterConfig.buildDirectory

export default defineConfig({
  plugins: [
    mdx(),
    reactRouter(),
    nitro({
      serverDir: './server',
      // mongodb 3 (used directly and by esix 3) is CommonJS and loads
      // optional modules with dynamic requires. Leave those as plain
      // requires so a missing optional module is skipped, not fatal.
      commonJS: { ignoreDynamicRequires: true },
      output: {
        dir: buildDirectory,
        serverDir: `${buildDirectory}/server`,
        publicDir: `${buildDirectory}/client`
      }
    }),
    workflow({ dirs: ['workflows'] }),
    tsconfigPaths()
  ],
  environments: {
    ssr: {
      build: {
        rollupOptions: {
          input: './server/ssr.ts'
        }
      }
    }
  }
})
