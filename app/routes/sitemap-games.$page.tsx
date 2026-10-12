import type { HeadersFunction, LoaderFunctionArgs } from 'react-router'

import { getCollection } from '~/db'
import { gamesPerSitemap, renderUrlSet, sitemapHeaders } from '~/sitemap/xml'

export const headers: HeadersFunction = () => sitemapHeaders

function notFound(): Response {
  return new Response(null, { status: 404, statusText: 'Sitemap Not Found.' })
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const page = Number(params.page)

  // Only canonical page numbers: no zero, padding, signs or words.
  if (!Number.isInteger(page) || page < 1 || String(page) !== params.page) {
    throw notFound()
  }

  const collection = await getCollection('games')
  const games = (await collection
    .find({})
    .sort({ gameId: 1 })
    .skip((page - 1) * gamesPerSitemap)
    .limit(gamesPerSitemap)
    .project({ _id: 0, gameId: 1, slug: 1 })
    .toArray()) as { gameId: number; slug: string }[]

  if (games.length === 0 && page > 1) {
    throw notFound()
  }

  const entries = games.map(({ gameId, slug }) => ({
    path: `/app/${gameId}/${slug}`,
    priority: '1.0'
  }))

  return new Response(renderUrlSet(entries, new Date().toISOString()), {
    status: 200,
    headers: sitemapHeaders
  })
}
