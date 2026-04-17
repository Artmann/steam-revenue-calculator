import type { HeadersFunction } from '@remix-run/node'

import { getCollection } from '~/db'
import { GameService } from '~/services/game-service.server'

export const headers: HeadersFunction = () => {
  return {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control':
      'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
  }
}

export const loader = async () => {
  const collection = await getCollection('games')

  const games = (await collection
    .find({})
    .sort({ name: 1 })
    .project({ _id: 0, gameId: 1, slug: 1 })
    .toArray()) as { gameId: number; slug: string }[]

  const gameCount = await new GameService().getGameCount()
  const pageSize = 48
  const pageCount = Math.ceil(gameCount / pageSize)

  const lastmod = new Date().toISOString()

  const urlBlock = (path: string, priority = '1.0'): string => `
<url>
  <loc>https://steam-revenue-calculator.com${path}</loc>
  <lastmod>${lastmod}</lastmod>
  <priority>${priority}</priority>
</url>
  `

  const gameXml = games
    .map((game) => urlBlock(`/app/${game.gameId}/${game.slug}`))
    .join('\n')

  const pageBlocks: string[] = []

  for (let i = 1; i <= pageCount; i++) {
    pageBlocks.push(urlBlock(`/games?page=${i}`, '0.5'))
  }

  const pagesXml = pageBlocks.join('\n')

  const content = `
<urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>
  ${urlBlock('/')}
  ${urlBlock('/about')}
  ${urlBlock('/blog')}
  ${urlBlock('/cookies')}
  ${urlBlock('/games')}
  ${urlBlock('/privacy')}

  ${urlBlock(
    '/blog/the-real-talk-on-steams-cut-what-your-game-actually-makes-and-why-its-complicated'
  )}

  ${gameXml}

  ${pagesXml}
</urlset>
`

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control':
        'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    }
  })
}
