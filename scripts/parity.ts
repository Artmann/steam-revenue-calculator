import fs from 'node:fs'
import path from 'node:path'

const routes = [
  '/',
  '/games',
  '/about',
  '/privacy',
  '/cookies',
  '/blog',
  '/blog/the-real-talk-on-steams-cut-what-your-game-actually-makes-and-why-its-complicated',
  '/tags',
  '/tags/action',
  '/app/367520/hollow-knight',
  '/robots.txt',
  '/ads.txt',
  '/sitemap.xml',
  '/sitemap-tags.xml',
  '/does-not-exist'
]

interface Capture {
  route: string
  status: number
  contentType: string
  cacheControl: string
  title: string
  metas: string[]
  canonical: string
  body: string[]
}

const root = path.resolve('.parity')

function fileName(route: string): string {
  return (route.replace(/[^a-z0-9]+/gi, '_') || 'root') + '.json'
}

export function normaliseHtml(html: string): string[] {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*\bsrc="\/(build|assets)\/[^"]*"[^>]*><\/script>/g, '')
    .replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(
      /<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?(__remix|__reactRouter|LiveReload)[\s\S]*?<\/script>/g,
      ''
    )
    // ScrollRestoration's inline script is library-internal and reformatted
    // between Remix 2 and React Router 7.
    .replace(
      /<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?window\.history\.replaceState(?:(?!<\/script>)[\s\S])*?<\/script>/g,
      ''
    )
    .replace(/<link\b[^>]*rel="modulepreload"[^>]*\/?>/g, '')
    .replace(/(href|src)="\/(build|assets)\/[^"]*"/g, '$1="ASSET"')
    // Remix 2 lazy route discovery marks every link.
    .replace(/ data-discover="true"/g, '')
    // The default error page was reworded and re-wrapped in Remix 2.
    .replace(
      /<main style="font-family:system-ui, sans-serif;padding:2rem"><h1 style="font-size:24px">([^<]*)<\/h1>(?:<script>[\s\S]*?<\/script>)?<\/main>/g,
      '<h1>$1</h1>'
    )
    .replace(
      /<h1 style="font-family:system-ui, sans-serif;padding:2rem">([^<]*)<\/h1>(?:<script>[\s\S]*?<\/script>)?/g,
      '<h1>$1</h1>'
    )
    .replace(
      /(<meta name="viewport" content="[^"]*")/g,
      (tag) => tag.replace(/,\s+/g, ',')
    )
    .replace(/>\s+</g, '><')
    .replace(/></g, '>\n<')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

// The sitemaps stamp every entry with the current time.
export function normaliseText(text: string): string[] {
  return text
    .replace(/<lastmod>[^<]*<\/lastmod>/g, '<lastmod>TIMESTAMP</lastmod>')
    .split('\n')
}

function extract(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((match) => match[0])
}

async function capture(baseUrl: string, name: string): Promise<void> {
  const directory = path.join(root, name)

  fs.rmSync(directory, { recursive: true, force: true })
  fs.mkdirSync(directory, { recursive: true })

  for (const route of routes) {
    const response = await fetch(new URL(route, baseUrl), {
      redirect: 'manual'
    })
    const text = await response.text()
    const contentType = response.headers.get('content-type') ?? ''
    const isHtml = contentType.includes('text/html')

    const result: Capture = {
      route,
      status: response.status,
      contentType,
      cacheControl: response.headers.get('cache-control') ?? '',
      title: isHtml ? (/<title>([\s\S]*?)<\/title>/.exec(text)?.[1] ?? '') : '',
      metas: isHtml ? extract(text, /<meta\b[^>]*>/g) : [],
      canonical: isHtml
        ? (/<link\b[^>]*rel="canonical"[^>]*>/.exec(text)?.[0] ?? '')
        : '',
      body: isHtml ? normaliseHtml(text) : normaliseText(text)
    }

    fs.writeFileSync(
      path.join(directory, fileName(route)),
      JSON.stringify(result, null, 2)
    )
    console.log(`${result.status} ${route}`)
  }
}

function compare(nameA: string, nameB: string): void {
  let differences = 0

  for (const route of routes) {
    const read = (name: string): Capture =>
      JSON.parse(
        fs.readFileSync(path.join(root, name, fileName(route)), 'utf8')
      )
    // Re-normalise so rules added later also apply to older captures.
    const renormalise = (capture: Capture): Capture =>
      capture.contentType.includes('text/html')
        ? {
            ...capture,
            metas: capture.metas.map((meta) => normaliseHtml(meta).join('')),
            body: normaliseHtml(capture.body.join(''))
          }
        : capture
    const a = renormalise(read(nameA))
    const b = renormalise(read(nameB))

    for (const field of [
      'status',
      'contentType',
      'cacheControl',
      'title',
      'canonical'
    ] as const) {
      // /ads.txt is a static file in public/; the host sets its cache header.
      if (route === '/ads.txt' && field === 'cacheControl') {
        continue
      }

      // Media types and charset names are case-insensitive.
      const normalise = (value: string) =>
        field === 'contentType' ? value.toLowerCase() : value

      if (normalise(String(a[field])) !== normalise(String(b[field]))) {
        differences++
        console.log(`${route} ${field}: ${a[field]} -> ${b[field]}`)
      }
    }

    for (const field of ['metas', 'body'] as const) {
      const length = Math.max(a[field].length, b[field].length)
      let shown = 0

      for (let index = 0; index < length && shown < 10; index++) {
        if (a[field][index] !== b[field][index]) {
          differences++
          shown++
          console.log(`${route} ${field}[${index}]:`)
          console.log(`  - ${a[field][index] ?? '<missing>'}`)
          console.log(`  + ${b[field][index] ?? '<missing>'}`)
        }
      }
    }
  }

  console.log(differences === 0 ? 'No differences.' : `${differences} differences.`)
  process.exit(differences === 0 ? 0 : 1)
}

const [command, first, second] = process.argv.slice(2)

if (command === 'capture' && first && second) {
  capture(first, second).catch((error) => {
    console.error(error)
    process.exit(1)
  })
} else if (command === 'compare' && first && second) {
  compare(first, second)
} else {
  console.error(
    'Usage: parity.ts capture <baseUrl> <name> | compare <nameA> <nameB>'
  )
  process.exit(1)
}
