import slugify from 'slugify'

import type { SteamTag } from '~/steam/types'

export interface TagSlug {
  tagId: number
  name: string
  slug: string
}

export function assignTagSlugs(
  tags: SteamTag[],
  existing: TagSlug[]
): TagSlug[] {
  const publishedSlugs = new Map(existing.map(({ tagId, slug }) => [tagId, slug]))
  const taken = new Set(existing.map(({ slug }) => slug))

  return [...tags]
    .sort((a, b) => a.tagid - b.tagid)
    .map(({ tagid, name }) => {
      // A tag keeps the slug it was published under, so its URL never moves.
      const published = publishedSlugs.get(tagid)

      if (published) {
        return { tagId: tagid, name, slug: published }
      }

      const base = slugify(name, { lower: true, strict: true }) || `tag-${tagid}`
      const slug = taken.has(base) ? `${base}-${tagid}` : base

      taken.add(slug)

      return { tagId: tagid, name, slug }
    })
}

export function createTagSlugs(tags: SteamTag[]): TagSlug[] {
  return assignTagSlugs(tags, [])
}
