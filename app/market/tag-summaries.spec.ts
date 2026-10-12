import { describe, it, expect } from 'vitest'

import { parseTagSort, sortTagSummaries } from '~/market/tag-summaries'

const summaries = [
  { name: 'B', slug: 'b', gameCount: 50, median: 1000, shareAboveHundredThousand: 0.3 },
  { name: 'A', slug: 'a', gameCount: 500, median: 1000, shareAboveHundredThousand: 0.1 },
  { name: 'C', slug: 'c', gameCount: 20, median: 9000, shareAboveHundredThousand: 0.2 }
]

describe('sortTagSummaries', () => {
  it('sorts descending by the chosen column, breaking ties by name.', () => {
    expect(sortTagSummaries(summaries, 'median').map(({ slug }) => slug)).toEqual(['c', 'a', 'b'])
    expect(sortTagSummaries(summaries, 'count').map(({ slug }) => slug)).toEqual(['a', 'b', 'c'])
    expect(sortTagSummaries(summaries, 'share').map(({ slug }) => slug)).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate its input.', () => {
    sortTagSummaries(summaries, 'count')

    expect(summaries[0].slug).toBe('b')
  })
})

describe('parseTagSort', () => {
  it('defaults unknown values to median.', () => {
    expect(parseTagSort('count')).toBe('count')
    expect(parseTagSort('share')).toBe('share')
    expect(parseTagSort('bogus')).toBe('median')
    expect(parseTagSort(null)).toBe('median')
  })
})
