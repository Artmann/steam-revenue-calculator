import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'

import { GameService } from '~/services/game-service.server'

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  const expectedKey = process.env.SCRAPE_KEY

  if (!expectedKey || !key || key !== expectedKey) {
    return new Response('Unauthorized.', { status: 401 })
  }

  const gameService = new GameService()

  await gameService.migrateGamesToDatabase()

  return json({
    status: 'success'
  })
}
