import slugify from 'slugify'

import { Game } from '~/models/game'

export const loader = async () => {
  const games = await Game.orderBy('name', 'desc').get()

  const pageSize = 48
  const gameCount = await Game.orderBy('grossRevenue', 'desc').count()
  const pageCount = Math.ceil(gameCount / pageSize)

  const urlBlock = (path: string, priority = '1.0'): string => `
<url>
  <loc>https://steam-revenue-calculator.com${path}</loc>
  <lastmod>2023-09-28T09:59:59+02:00</lastmod>
  <priority>${priority}</priority>
</url>
  `

  const gameXml = games
    .map((game) => urlBlock(`/app/${game.id}/${game.slug}`))
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

  ${gameXml}

  ${pagesXml}
</urlset>
`

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'xml-version': '1.0',
      encoding: 'UTF-8'
    }
  })
}
