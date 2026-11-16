import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import mdx from '@mdx-js/rollup'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import remarkGfm from 'remark-gfm'
import { defineConfig } from 'vite'
import { workflow } from 'workflow/vite'

import reactRouterConfig from './react-router.config.ts'

const buildDirectory = reactRouterConfig.buildDirectory
const clientDirectory = `${buildDirectory}/client`

// Nitro picks its `vercel` preset on Vercel (VERCEL is set) or when asked to.
const onVercel =
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.NITRO_PRESET?.startsWith('vercel'))

function copyClientToVercelStatic(outputDirectory: string) {
  if (!existsSync(clientDirectory)) {
    throw new Error(`Missing client build in ${clientDirectory}`)
  }

  cpSync(clientDirectory, join(outputDirectory, 'static'), {
    recursive: true,
    filter: (source) => !source.split(/[\\/]/).includes('.vite')
  })
}

export default defineConfig({
  plugins: [
    mdx({ remarkPlugins: [remarkGfm] }),
    tailwindcss(),
    reactRouter(),
    nitro({
      serverDir: './server',
      // Backstop for server/ssr.ts, which answers first at eight seconds.
      vercel: { functions: { maxDuration: 10 } },
      routeRules: {
        // Crawlers fetch each of the ~112k game pages about once. The CDN
        // cache is per region and drops rarely read pages, so most of those
        // requests ran the function. ISR keeps one durable copy for all
        // regions, so a game renders at most once a day per deployment.
        '/app/**': {
          isr: {
            expiration: 86400,
            // Ignore junk query strings (utm tags, cache busters). Keep
            // `_routes`, which React Router can add to .data requests.
            allowQuery: ['_routes']
          }
        }
      },
      // React Router always reads its client manifest from `build/client`, so
      // the client assets land there. Locally the server goes to `build/server`.
      // On Vercel the preset keeps its `.vercel/output` defaults (config.json,
      // functions/) and the client assets are copied into `.vercel/output/static`.
      output: onVercel
        ? { publicDir: clientDirectory }
        : {
            dir: buildDirectory,
            serverDir: `${buildDirectory}/server`,
            publicDir: clientDirectory
          },
      modules: [
        (nitro) => {
          if (!onVercel) {
            return
          }

          nitro.hooks.hook('compiled', () => {
            copyClientToVercelStatic(nitro.options.output.dir)
          })
        }
      ]
    }),
    workflow({ dirs: ['workflows'] })
  ],
  resolve: {
    tsconfigPaths: true
  },
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
