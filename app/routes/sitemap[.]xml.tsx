import type { HeadersFunction } from 'react-router'

import { getCollection } from '~/db'
import {
  renderSitemapIndex,
  sitemapHeaders,
  sitemapPageCount
} from '~/sitemap/xml'

export const headers: HeadersFunction = () => sitemapHeaders

export const loader = async () => {
  const games = await getCollection('games')
  const pageCount = sitemapPageCount(await games.estimatedDocumentCount())

  const paths = [
    '/sitemap-tags.xml',
    '/sitemap-pages.xml',
    ...Array.from({ length: pageCount }, (_, index) => `/sitemap-games/${index + 1}`)
  ]

  return new Response(renderSitemapIndex(paths, new Date().toISOString()), {
    status: 200,
    headers: sitemapHeaders
  })
}
