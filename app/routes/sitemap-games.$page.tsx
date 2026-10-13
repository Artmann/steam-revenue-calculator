import type { HeadersFunction, LoaderFunctionArgs } from 'react-router'

import { getCollection } from '~/db'
import {
  gamesPerSitemap,
  gamesSitemapIndex,
  renderUrlSet,
  sitemapHeaders
} from '~/sitemap/xml'

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
  // Covered by the index, so this never loads the (large) game documents.
  const games = (await collection
    .find({})
    .hint(gamesSitemapIndex)
    .sort({ gameId: 1 })
    .skip((page - 1) * gamesPerSitemap)
    .limit(gamesPerSitemap)
    .project({ _id: 0, gameId: 1, slug: 1, contentUpdatedAt: 1 })
    .toArray()) as {
    gameId: number
    slug: string
    // Covered queries return null, not a missing key, for absent fields.
    contentUpdatedAt: number | null
  }[]

  if (games.length === 0 && page > 1) {
    throw notFound()
  }

  const entries = games.map(({ gameId, slug, contentUpdatedAt }) => ({
    path: `/app/${gameId}/${slug}`,
    priority: '1.0',
    lastmod: contentUpdatedAt ?? undefined
  }))

  return new Response(renderUrlSet(entries), {
    status: 200,
    headers: sitemapHeaders
  })
}
