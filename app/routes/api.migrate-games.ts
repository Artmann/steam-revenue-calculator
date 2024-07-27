import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'

import { GameService } from '~/services/game-service.server'

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')

  if (!key || key !== 'YTViNDlkMGMtNTZiYi00Y2ExLWFhOGItZmE5NDNhM2E3ZWYyIA') {
    return new Response('Unauthorized.', { status: 401 })
  }

  const gameService = new GameService()

  await gameService.migrateGamesToDatabase()

  return json({
    status: 'success'
  })
}
