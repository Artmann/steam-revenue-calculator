import { toMarketGame } from '~/market/market-game'

describe('toMarketGame', () => {
  it('flattens the stored document.', () => {
    expect(
      toMarketGame({
        gameId: 1,
        slug: 'hades',
        grossRevenue: 100,
        basePrice: 2499,
        releaseYear: 2019,
        tagIds: [1, 2],
        reviewCount: 10,
        details: {
          name: 'Hades',
          developers: ['Supergiant Games'],
          publishers: ['Supergiant Games']
        }
      })
    ).toEqual({
      gameId: 1,
      name: 'Hades',
      slug: 'hades',
      grossRevenue: 100,
      basePrice: 2499,
      releaseYear: 2019,
      tagIds: [1, 2],
      reviewCount: 10,
      developers: ['Supergiant Games'],
      publishers: ['Supergiant Games']
    })
  })

  it('defaults fields missing on documents scraped before tags existed.', () => {
    expect(
      toMarketGame({ gameId: 2, slug: 'old', grossRevenue: 5 })
    ).toEqual({
      gameId: 2,
      name: '',
      slug: 'old',
      grossRevenue: 5,
      basePrice: 0,
      releaseYear: undefined,
      tagIds: [],
      reviewCount: 0,
      developers: [],
      publishers: []
    })
  })
})
