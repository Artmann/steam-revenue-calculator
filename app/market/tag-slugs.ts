import slugify from 'slugify'

import type { SteamTag } from '~/steam/types'

export interface TagSlug {
  tagId: number
  name: string
  slug: string
}

export function createTagSlugs(tags: SteamTag[]): TagSlug[] {
  const taken = new Set<string>()

  return [...tags]
    .sort((a, b) => a.tagid - b.tagid)
    .map(({ tagid, name }) => {
      const base = slugify(name, { lower: true, strict: true }) || `tag-${tagid}`
      const slug = taken.has(base) ? `${base}-${tagid}` : base

      taken.add(slug)

      return { tagId: tagid, name, slug }
    })
}
