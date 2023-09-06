import { json } from '@remix-run/node'
import type { LoaderFunction } from '@remix-run/node'
import fs from 'fs'
import type { GameDetails } from '~/games'

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')

  if (!key || key !== 'YTViNDlkMGMtNTZiYi00Y2ExLWFhOGItZmE5NDNhM2E3ZWYyIA') {
    return new Response('Unauthorized.', { status: 401 })
  }

  const raw = await fs.promises.readFile('./data/games.json', 'utf-8')
  const games = JSON.parse(raw) as GameDetails[]

  const filteredGames = games.filter(game => game.numberOfReviews > 0).filter(game => game.price > 0)

  await fs.promises.writeFile('./data/games-filtered.json', JSON.stringify(filteredGames, null, 2))

  return json({ games: filteredGames })
}