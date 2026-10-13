import { describe, expect, it } from 'vitest'

import { renderSitemapIndex, renderUrlSet, sitemapPageCount } from '~/sitemap/xml'

describe('sitemap xml', () => {
  it('needs one game sitemap per 10,000 games, and at least one.', () => {
    expect(sitemapPageCount(0)).toBe(1)
    expect(sitemapPageCount(10_000)).toBe(1)
    expect(sitemapPageCount(10_001)).toBe(2)
  })

  it('renders a sitemap index with absolute locations.', () => {
    const xml = renderSitemapIndex(['/sitemap-games/1'])

    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/sitemap-games/1</loc>')
    expect(xml).not.toContain('<lastmod>')
  })

  it('renders url entries with escaped locations.', () => {
    const xml = renderUrlSet([{ path: '/app/1/a&b', priority: '1.0' }])

    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/app/1/a&amp;b</loc>')
    expect(xml).toContain('<priority>1.0</priority>')
    expect(xml).not.toContain('<lastmod>')
  })

  it('renders lastmod only for entries that have one.', () => {
    const xml = renderUrlSet([
      { path: '/a', priority: '1.0', lastmod: Date.UTC(2026, 9, 12) },
      { path: '/b', priority: '1.0', lastmod: new Date('2026-10-13T00:00:00Z') }
    ])

    expect(xml).toContain('<lastmod>2026-10-12T00:00:00.000Z</lastmod>')
    expect(xml).toContain('<lastmod>2026-10-13T00:00:00.000Z</lastmod>')
  })
})
