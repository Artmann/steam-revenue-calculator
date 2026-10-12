import type { HeadersFunction } from 'react-router'

import { GameService } from '~/services/game-service.server'
import { renderUrlSet, sitemapHeaders } from '~/sitemap/xml'

// Matches the page size of the /games listing.
const gamesPageSize = 48

export const headers: HeadersFunction = () => sitemapHeaders

export const loader = async () => {
  const gameCount = await new GameService().getGameCount()
  const pageCount = Math.ceil(gameCount / gamesPageSize)

  const entries = Array.from({ length: pageCount }, (_, index) => ({
    path: `/games?page=${index + 1}`,
    priority: '0.5'
  }))

  return new Response(renderUrlSet(entries, new Date().toISOString()), {
    status: 200,
    headers: sitemapHeaders
  })
}
