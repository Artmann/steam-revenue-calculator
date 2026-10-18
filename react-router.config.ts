import type { Config } from '@react-router/dev/config'

export default {
  ssr: true,
  buildDirectory: 'build',
  // With only a handful of routes the full manifest is tiny. Lazy discovery
  // would call the server function for every new set of links on a page.
  routeDiscovery: { mode: 'initial' },
  future: {
    v8_viteEnvironmentApi: true
  }
} satisfies Config
