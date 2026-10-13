import { describe, it, expect } from 'vitest'

import { buildGameUpsert } from '~/steam/build-game-upsert'
import type { ScrapedGame } from '~/steam/map-store-item'

const game: ScrapedGame = {
  gameId: 646570,
  name: 'Slay the Spire',
  description: 'Deckbuilder.',
  developers: ['Mega Crit'],
  publishers: ['Mega Crit'],
  screenshots: ['https://example.com/a.jpg'],
  tagIds: [1091588, 1666],
  releaseDate: new Date('2019-01-23T00:00:00Z'),
  releaseYear: 2019,
  reviewCount: 192403,
  percentPositive: 97,
  price: 1249,
  basePrice: 2499,
  grossRevenue: 1000
}

describe('buildGameUpsert', () => {
  it('upserts by gameId, setting top-level fields and the details the game page reads.', () => {
    const operation = buildGameUpsert(game, 1700000000000, 'abc123', 1690000000000)

    expect(operation.updateOne.filter).toEqual({ gameId: 646570 })
    expect(operation.updateOne.upsert).toBe(true)
    expect(operation.updateOne.update.$set).toEqual({
      contentHash: expect.any(String),
      contentUpdatedAt: 1700000000000,
      slug: 'slay-the-spire',
      grossRevenue: 1000,
      tagIds: [1091588, 1666],
      releaseDate: new Date('2019-01-23T00:00:00Z'),
      releaseYear: 2019,
      reviewCount: 192403,
      percentPositive: 97,
      price: 1249,
      basePrice: 2499,
      updatedAt: 1700000000000,
      listedAt: 1690000000000,
      'details.id': 646570,
      'details.name': 'Slay the Spire',
      'details.description': 'Deckbuilder.',
      'details.developers': ['Mega Crit'],
      'details.publishers': ['Mega Crit'],
      'details.screenshots': ['https://example.com/a.jpg'],
      'details.price': 2499,
      'details.numberOfReviews': 192403
    })
  })

  it('bumps contentUpdatedAt only when the page content changed.', () => {
    const { contentHash } = buildGameUpsert(game, 1, 'id', 1).updateOne.update
      .$set as { contentHash: string }

    const unchanged = buildGameUpsert(game, 2, 'id', 2, contentHash).updateOne
      .update.$set
    const changed = buildGameUpsert(
      { ...game, reviewCount: game.reviewCount + 1 },
      2,
      'id',
      2,
      contentHash
    ).updateOne.update.$set

    expect(unchanged.contentHash).toBe(contentHash)
    expect(unchanged).not.toHaveProperty('contentUpdatedAt')
    expect(changed.contentHash).not.toBe(contentHash)
    expect(changed.contentUpdatedAt).toBe(2)
  })

  it('initialises esix and legacy detail fields only on insert.', () => {
    const operation = buildGameUpsert(game, 1700000000000, 'abc123', 1690000000000)

    expect(operation.updateOne.update.$setOnInsert).toEqual({
      _id: 'abc123',
      createdAt: 1700000000000,
      'details.categories': [],
      'details.genres': [],
      'details.metacritic': {}
    })
  })

  it('unsets optional fields Steam no longer reports instead of keeping stale values.', () => {
    const operation = buildGameUpsert(
      {
        ...game,
        releaseDate: undefined,
        releaseYear: undefined,
        percentPositive: undefined
      },
      1,
      'id',
      1
    )

    const keys = Object.keys(operation.updateOne.update.$set)

    expect(keys).not.toContain('releaseDate')
    expect(keys).not.toContain('releaseYear')
    expect(keys).not.toContain('percentPositive')
    expect(operation.updateOne.update.$unset).toEqual({
      releaseDate: '',
      releaseYear: '',
      percentPositive: ''
    })
  })

  it('leaves out $unset when every field is present.', () => {
    expect(
      buildGameUpsert(game, 1, 'id', 1).updateOne.update.$unset
    ).toBeUndefined()
  })
})
