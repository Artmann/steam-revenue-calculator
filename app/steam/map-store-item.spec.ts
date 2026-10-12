import { describe, it, expect } from 'vitest'

import { calculateRevenue } from '~/revenue'
import { mapStoreItem } from '~/steam/map-store-item'
import type { StoreItem } from '~/steam/types'

const hades: StoreItem = {
  id: 1145360,
  appid: 1145360,
  success: 1,
  name: 'Hades',
  tags: [
    { tagid: 492, weight: 734 },
    { tagid: 42804, weight: 1051 },
    { tagid: 1646, weight: 750 }
  ],
  reviews: {
    summary_filtered: { review_count: 286667, percent_positive: 97 }
  },
  release: {
    steam_release_date: 1600353507,
    original_steam_release_date: 1575997560
  },
  basic_info: {
    short_description: 'Defy the god of the dead.',
    developers: [{ name: 'Supergiant Games' }],
    publishers: [{ name: 'Supergiant Games' }]
  },
  best_purchase_option: { final_price_in_cents: '2499' },
  screenshots: {
    all_ages_screenshots: [
      { filename: 'steam/apps/1145360/ss_b.jpg', ordinal: 2 },
      { filename: 'steam/apps/1145360/ss_a.jpg', ordinal: 1 }
    ]
  }
}

describe('mapStoreItem', () => {
  it('maps a full-price game.', () => {
    const game = mapStoreItem(hades)

    expect(game).toEqual({
      gameId: 1145360,
      name: 'Hades',
      description: 'Defy the god of the dead.',
      developers: ['Supergiant Games'],
      publishers: ['Supergiant Games'],
      screenshots: [
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/ss_a.jpg',
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/ss_b.jpg'
      ],
      tagIds: [42804, 1646, 492],
      releaseDate: new Date(1575997560 * 1000),
      releaseYear: 2019,
      reviewCount: 286667,
      percentPositive: 97,
      price: 2499,
      basePrice: 2499,
      grossRevenue: calculateRevenue(286667, 24.99)
    })
  })

  it('uses the undiscounted price for revenue when a game is on sale.', () => {
    const game = mapStoreItem({
      ...hades,
      best_purchase_option: {
        final_price_in_cents: '1999',
        original_price_in_cents: '3999'
      }
    })

    expect(game?.price).toBe(1999)
    expect(game?.basePrice).toBe(3999)
    expect(game?.grossRevenue).toBe(calculateRevenue(286667, 39.99))
  })

  it('keeps only the 20 heaviest tags.', () => {
    const tags = Array.from({ length: 25 }, (_, index) => ({
      tagid: index + 1,
      weight: index
    }))

    const game = mapStoreItem({ ...hades, tags })

    expect(game?.tagIds).toHaveLength(20)
    expect(game?.tagIds[0]).toBe(25)
    expect(game?.tagIds[19]).toBe(6)
  })

  it('falls back to steam_release_date and tolerates missing optional data.', () => {
    const game = mapStoreItem({
      id: 7,
      success: 1,
      name: 'Bare',
      release: { steam_release_date: 1600353507 },
      best_purchase_option: { final_price_in_cents: '999' }
    })

    expect(game).toMatchObject({
      gameId: 7,
      description: '',
      developers: [],
      publishers: [],
      screenshots: [],
      tagIds: [],
      releaseYear: 2020,
      reviewCount: 0,
      percentPositive: undefined
    })
  })

  it('leaves the release date undefined when Steam has none.', () => {
    const game = mapStoreItem({ ...hades, release: undefined })

    expect(game?.releaseDate).toBeUndefined()
    expect(game?.releaseYear).toBeUndefined()
  })

  it.each([
    ['free games', { ...hades, is_free: true }],
    ['failed lookups', { ...hades, success: 0 }],
    ['items without a name', { ...hades, name: undefined }],
    ['items with no purchase option', { ...hades, best_purchase_option: undefined }],
    ['zero prices', { ...hades, best_purchase_option: { final_price_in_cents: '0' } }]
  ])('skips %s.', (_, item) => {
    expect(mapStoreItem(item as StoreItem)).toBeUndefined()
  })
})
