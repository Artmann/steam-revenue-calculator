import { SITE_URL } from '~/market/constants'

// Search engines accept up to 50,000 URLs per sitemap, but smaller files
// render fast enough that crawlers never time out on them.
export const gamesPerSitemap = 10_000

export const gamesSitemapIndex = { gameId: 1, slug: 1, contentUpdatedAt: 1 }

export const sitemapHeaders: Record<string, string> = {
  'Content-Type': 'application/xml; charset=UTF-8',
  'Cache-Control':
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
}

const xmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
}

export const escapeXml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => xmlEntities[character])

export function sitemapPageCount(gameCount: number): number {
  return Math.max(1, Math.ceil(gameCount / gamesPerSitemap))
}

export function renderSitemapIndex(paths: string[]): string {
  const entries = paths
    .map(
      (path) => `
<sitemap>
  <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>
</sitemap>`
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}
</sitemapindex>
`
}

export interface SitemapEntry {
  path: string
  priority: string
  // Only when the content really changed then; a lastmod that is always "now"
  // teaches crawlers to ignore it.
  lastmod?: Date | number
}

export function renderUrlSet(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      ({ path, priority, lastmod }) => `
<url>
  <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>${
    lastmod === undefined
      ? ''
      : `
  <lastmod>${new Date(lastmod).toISOString()}</lastmod>`
  }
  <priority>${priority}</priority>
</url>`
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>
`
}
