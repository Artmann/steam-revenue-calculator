import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { loader as gamesSitemapLoader } from '~/routes/sitemap-games.$page'
import { loader as indexLoader } from '~/routes/sitemap[.]xml'
import { gamesSitemapIndex } from '~/sitemap/xml'

beforeAll(async () => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`

  await (await getCollection('games')).insertMany([
    { gameId: 20, slug: 'second', contentUpdatedAt: Date.UTC(2026, 9, 12) },
    { gameId: 10, slug: 'first' },
    { gameId: 30, slug: 'gone', delistedAt: 1 }
  ])
})

afterAll(async () => {
  await resetDatabaseConnection()
})

function gamesSitemap(page: string) {
  return gamesSitemapLoader({
    params: { page },
    request: new Request(`http://localhost/sitemap-games/${page}`),
    context: {}
  } as any)
}

describe('sitemaps (real MongoDB)', () => {
  it('indexes the tag and game sitemaps.', async () => {
    const response = await indexLoader()
    const xml = await response.text()

    expect(response.headers.get('Content-Type')).toContain('application/xml')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/sitemap-tags.xml</loc>')
    expect(xml).not.toContain('/sitemap-pages.xml')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/sitemap-games/1</loc>')
    expect(xml).not.toContain('/sitemap-games/2')
  })

  it('lists games in id order, including delisted ones.', async () => {
    const xml = await (await gamesSitemap('1')).text()

    expect(xml.indexOf('/app/10/first')).toBeGreaterThan(-1)
    expect(xml.indexOf('/app/10/first')).toBeLessThan(xml.indexOf('/app/20/second'))
    expect(xml).toContain('/app/30/gone')
  })

  it('uses the content change time as lastmod, and omits it when unknown.', async () => {
    const xml = await (await gamesSitemap('1')).text()

    expect(xml).toContain(
      '/app/20/second</loc>\n  <lastmod>2026-10-12T00:00:00.000Z</lastmod>'
    )
    expect(xml.match(/<lastmod>/g)).toHaveLength(1)
  })

  it('reads game sitemaps from the index alone, never the documents.', async () => {
    const games = await getCollection('games')
    const explained = await games
      .find({})
      .hint(gamesSitemapIndex)
      .sort({ gameId: 1 })
      .project({ _id: 0, gameId: 1, slug: 1, contentUpdatedAt: 1 })
      .explain('executionStats')

    expect(explained.executionStats.nReturned).toBe(3)
    expect(explained.executionStats.totalDocsExamined).toBe(0)
  })

  it('returns 404 for pages that do not exist.', async () => {
    for (const page of ['0', '2', 'abc', '01', '-1']) {
      await expect(gamesSitemap(page)).rejects.toMatchObject({ status: 404 })
    }
  })
})
