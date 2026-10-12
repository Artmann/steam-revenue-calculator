import mdx from '@mdx-js/rollup'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { workflow } from 'workflow/vite'

import reactRouterConfig from './react-router.config'

const buildDirectory = reactRouterConfig.buildDirectory

export default defineConfig({
  plugins: [
    mdx(),
    tailwindcss(),
    reactRouter(),
    nitro({
      serverDir: './server',
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
