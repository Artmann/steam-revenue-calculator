import type { LoaderFunction } from 'react-router'
import { redirect } from 'react-router'

import { createGameSlug } from '~/games'
import { GameService } from '~/services/game-service.server'

// Links and crawlers sometimes drop the slug, so send /app/:id to the game page.
export const loader: LoaderFunction = async ({ params }) => {
  const gameId = parseInt(params.id as string, 10)

  const game = Number.isNaN(gameId)
    ? null
    : await new GameService().findGame(gameId)

  if (!game?.details?.name) {
    throw new Response(null, {
      status: 404,
      statusText: 'Game Not Found.'
    })
  }

  return redirect(`/app/${gameId}/${createGameSlug(game.details.name)}`, {
    status: 301,
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  })
}
