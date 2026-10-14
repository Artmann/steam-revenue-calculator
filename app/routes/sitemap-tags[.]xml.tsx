import type { HeadersFunction } from 'react-router'

import { getCollection } from '~/db'
import { renderUrlSet, sitemapHeaders } from '~/sitemap/xml'

export const headers: HeadersFunction = () => sitemapHeaders

const staticPaths = [
  '/',
  '/about',
  '/blog',
  '/cookies',
  '/games',
  '/privacy',
  '/tags',
  '/wishlist-calculator',
  '/blog/the-real-talk-on-steams-cut-what-your-game-actually-makes-and-why-its-complicated',
  '/blog/what-112000-steam-games-taught-us-about-pricing-your-indie-game'
]

export const loader = async () => {
  const tagsCollection = await getCollection('tags')
  const tags = (await tagsCollection
    .find({ stats: { $exists: true } })
    .sort({ slug: 1 })
    .project({ _id: 0, slug: 1, statsUpdatedAt: 1 })
    .toArray()) as { slug: string; statsUpdatedAt?: Date }[]

  const entries = [
    ...staticPaths.map((path) => ({ path, priority: '1.0' })),
    ...tags.map((tag) => ({
      path: `/tags/${tag.slug}`,
      priority: '0.8',
      lastmod: tag.statsUpdatedAt
    }))
  ]

  return new Response(renderUrlSet(entries), {
    status: 200,
    headers: sitemapHeaders
  })
}
