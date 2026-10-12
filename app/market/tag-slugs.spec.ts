import { describe, it, expect } from 'vitest'

import { assignTagSlugs, createTagSlugs } from '~/market/tag-slugs'

describe('createTagSlugs', () => {
  it('produces lowercase, punctuation-free slugs.', () => {
    const slugs = createTagSlugs([
      { tagid: 1, name: 'Rogue-like' },
      { tagid: 2, name: "Beat 'em up" },
      { tagid: 3, name: 'Design & Illustration' },
      { tagid: 4, name: '4X' }
    ])

    expect(slugs.map(({ slug }) => slug)).toEqual([
      'rogue-like',
      'beat-em-up',
      'design-and-illustration',
      '4x'
    ])
  })

  it('suffixes the tag id on collisions, keeping the lowest id unsuffixed regardless of input order.', () => {
    const slugs = createTagSlugs([
      { tagid: 9999, name: 'Sci fi' },
      { tagid: 3942, name: 'Sci-fi' }
    ])

    expect(slugs).toEqual([
      { tagId: 3942, name: 'Sci-fi', slug: 'sci-fi' },
      { tagId: 9999, name: 'Sci fi', slug: 'sci-fi-9999' }
    ])
  })

  it('falls back to the tag id when the name has no sluggable characters.', () => {
    expect(createTagSlugs([{ tagid: 5, name: '!!!' }])[0].slug).toBe('tag-5')
  })

  it('keeps the published slug of an existing tag and updates its name.', () => {
    expect(
      assignTagSlugs(
        [{ tagid: 19, name: 'Action Games' }],
        [{ tagId: 19, name: 'Action', slug: 'action' }]
      )
    ).toEqual([{ tagId: 19, name: 'Action Games', slug: 'action' }])
  })

  it('suffixes a new lower-id tag instead of taking an existing slug.', () => {
    expect(
      assignTagSlugs(
        [
          { tagid: 500, name: 'Indie' },
          { tagid: 3, name: 'Indie' }
        ],
        [{ tagId: 500, name: 'Indie', slug: 'indie' }]
      )
    ).toEqual([
      { tagId: 3, name: 'Indie', slug: 'indie-3' },
      { tagId: 500, name: 'Indie', slug: 'indie' }
    ])
  })
})
