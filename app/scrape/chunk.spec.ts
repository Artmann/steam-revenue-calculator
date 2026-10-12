import { describe, expect, it } from 'vitest'

import { chunk } from '~/scrape/chunk'

describe('chunk', () => {
  it('splits items into chunks of the given size, keeping the remainder.', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('returns no chunks for no items.', () => {
    expect(chunk([], 3)).toEqual([])
  })

  it('rejects a size that is not a positive integer.', () => {
    expect(() => chunk([1], 0)).toThrow('positive integer')
  })
})
