import { SITE_URL } from '~/market/constants'

// Search engines accept at most 50,000 URLs per sitemap.
export const gamesPerSitemap = 40_000

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

export function renderSitemapIndex(paths: string[], lastmod: string): string {
  const entries = paths
    .map(
      (path) => `
<sitemap>
  <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>
  <lastmod>${lastmod}</lastmod>
</sitemap>`
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}
</sitemapindex>
`
}

export function renderUrlSet(
  entries: { path: string; priority: string }[],
  lastmod: string
): string {
  const urls = entries
    .map(
      ({ path, priority }) => `
<url>
  <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>
  <lastmod>${lastmod}</lastmod>
  <priority>${priority}</priority>
</url>`
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>
`
}
