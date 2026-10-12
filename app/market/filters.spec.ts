import { describe, it, expect } from 'vitest'

import {
  buildMarketQuery,
  isFiltered,
  parseMarketFilters
} from '~/market/filters'

const slugs = new Map([
  ['roguelike', 1],
  ['deckbuilder', 2],
  ['turn-based', 3]
])

function parse(query: string) {
  return parseMarketFilters(new URLSearchParams(query), slugs, 1)
}

describe('parseMarketFilters', () => {
  it('parses a dollar price range into cents.', () => {
    expect(parse('price=10-20')).toMatchObject({ minPrice: 1000, maxPrice: 2000 })
    expect(parse('price=30-')).toMatchObject({ minPrice: 3000, maxPrice: undefined })
    expect(parse('price=-5')).toMatchObject({ minPrice: undefined, maxPrice: 500 })
    expect(parse('price=9.99-14.5')).toMatchObject({ minPrice: 999, maxPrice: 1450 })
  })

  it('swaps an inverted price range.', () => {
    expect(parse('price=20-10')).toMatchObject({ minPrice: 1000, maxPrice: 2000 })
  })

  it.each(['abc', '15', '-', '', '10-20-30'])('ignores the malformed price %p.', (price) => {
    const filters = parse(`price=${price}`)

    expect(filters.minPrice).toBeUndefined()
    expect(filters.maxPrice).toBeUndefined()
  })

  it('parses release years and swaps an inverted range.', () => {
    expect(parse('since=2021')).toMatchObject({ since: 2021, until: undefined })
    expect(parse('since=2024&until=2020')).toMatchObject({ since: 2020, until: 2024 })
  })

  it.each(['99', '20211', 'abc', '1900', ''])('ignores the malformed year %p.', (year) => {
    expect(parse(`since=${year}`).since).toBeUndefined()
  })

  it('resolves with-tags from commas and repeated params, case-insensitively, deduped.', () => {
    expect(parse('with=Deckbuilder,turn-based&with=deckbuilder').withTagIds).toEqual([2, 3])
  })

  it("drops the page's own tag silently and reports unknown slugs.", () => {
    const filters = parse('with=roguelike,nope,deckbuilder')

    expect(filters.withTagIds).toEqual([2])
    expect(filters.unknownTags).toEqual(['nope'])
  })
})

describe('isFiltered', () => {
  it('is false for a blank form submission.', () => {
    expect(isFiltered(parse('price=&since=&until=&with='))).toBe(false)
  })

  it('is true when any filter applies.', () => {
    expect(isFiltered(parse('since=2021'))).toBe(true)
    expect(isFiltered(parse('with=deckbuilder'))).toBe(true)
  })

  it('is false when only unknown tags were given.', () => {
    expect(isFiltered(parse('with=nope'))).toBe(false)
  })
})

describe('buildMarketQuery', () => {
  it('matches the tag only when no filters apply.', () => {
    expect(buildMarketQuery(1, parse(''))).toEqual({ tagIds: { $all: [1] } })
  })

  it('combines tags, price and year bounds.', () => {
    expect(
      buildMarketQuery(1, parse('price=10-20&since=2021&with=deckbuilder'))
    ).toEqual({
      tagIds: { $all: [1, 2] },
      basePrice: { $gte: 1000, $lt: 2000 },
      releaseYear: { $gte: 2021 }
    })
  })

  it('keeps the release year upper bound inclusive.', () => {
    expect(buildMarketQuery(1, parse('since=2020&until=2022'))).toEqual({
      tagIds: { $all: [1] },
      releaseYear: { $gte: 2020, $lte: 2022 }
    })
  })
})
