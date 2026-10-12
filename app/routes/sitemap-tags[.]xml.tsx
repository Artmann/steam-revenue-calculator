import type { HeadersFunction } from 'react-router'

import { getCollection } from '~/db'
import { SITE_URL } from '~/market/constants'

export const headers: HeadersFunction = () => {
  return {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control':
      'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
  }
}

const xmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
}

const escapeXml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => xmlEntities[character])

export const loader = async () => {
  const tagsCollection = await getCollection('tags')
  const tags = (await tagsCollection
    .find({ stats: { $exists: true } })
    .sort({ slug: 1 })
    .project({ _id: 0, slug: 1 })
    .toArray()) as { slug: string }[]

  const lastmod = new Date().toISOString()

  const urlBlock = (path: string, priority = '1.0'): string => `
<url>
  <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>
  <lastmod>${lastmod}</lastmod>
  <priority>${priority}</priority>
</url>
  `

  const tagXml = tags
    .map((tag) => urlBlock(`/tags/${tag.slug}`, '0.8'))
    .join('\n')

  const content = `
<urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>
  ${urlBlock('/')}
  ${urlBlock('/about')}
  ${urlBlock('/blog')}
  ${urlBlock('/cookies')}
  ${urlBlock('/games')}
  ${urlBlock('/privacy')}
  ${urlBlock('/tags')}
  ${tagXml}

  ${urlBlock(
    '/blog/the-real-talk-on-steams-cut-what-your-game-actually-makes-and-why-its-complicated'
  )}
</urlset>
`

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control':
        'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    }
  })
}
