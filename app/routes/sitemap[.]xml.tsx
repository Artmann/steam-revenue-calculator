import slugify from 'slugify'

import { fetchGames } from '~/games'

export const loader = async () => {
  const games = await fetchGames()

  const urlBlock = (path: string): string => `
<url>
  <loc>https://steam-revenue-calculator.com${path}</loc>
  <lastmod>2023-09-25T23:59:59+02:00</lastmod>
  <priority>1.0</priority>
</url>
  `

  const gameXml = games
    .map((game) =>
      urlBlock(`/app/${game.id}/${slugify(game.name, { lower: true })}`)
    )
    .join('\n')

  const content = `
<urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>
  ${urlBlock('/')}
  ${urlBlock('/games')}
  ${gameXml}
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
