import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { loader as gamesSitemapLoader } from '~/routes/sitemap-games.$page'
import { loader as pagesSitemapLoader } from '~/routes/sitemap-pages[.]xml'
import { loader as indexLoader } from '~/routes/sitemap[.]xml'

beforeAll(async () => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`

  await (await getCollection('games')).insertMany([
    { gameId: 20, slug: 'second' },
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
  it('indexes the tag, page and game sitemaps.', async () => {
    const response = await indexLoader()
    const xml = await response.text()

    expect(response.headers.get('Content-Type')).toContain('application/xml')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/sitemap-tags.xml</loc>')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/sitemap-pages.xml</loc>')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/sitemap-games/1</loc>')
    expect(xml).not.toContain('/sitemap-games/2')
  })

  it('lists games in id order, including delisted ones.', async () => {
    const xml = await (await gamesSitemap('1')).text()

    expect(xml.indexOf('/app/10/first')).toBeGreaterThan(-1)
    expect(xml.indexOf('/app/10/first')).toBeLessThan(xml.indexOf('/app/20/second'))
    expect(xml).toContain('/app/30/gone')
  })

  it('returns 404 for pages that do not exist.', async () => {
    for (const page of ['0', '2', 'abc', '01', '-1']) {
      await expect(gamesSitemap(page)).rejects.toMatchObject({ status: 404 })
    }
  })

  it('lists the paginated games pages.', async () => {
    const xml = await (await pagesSitemapLoader()).text()

    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/games?page=1</loc>')
    expect(xml).not.toContain('/games?page=2')
  })
})
