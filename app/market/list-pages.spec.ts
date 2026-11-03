import { describe, expect, it } from 'vitest'

import { countListPages, maxListPages, parseListPage } from './list-pages'

describe('countListPages', () => {
  it('counts the pages the items fill.', () => {
    expect(countListPages(101, 25)).toEqual(5)
  })

  it('keeps one page for an empty list.', () => {
    expect(countListPages(0, 25)).toEqual(1)
  })

  it('stops at the most pages a list shows.', () => {
    expect(countListPages(218_506, 48)).toEqual(maxListPages)
  })
})

describe('parseListPage', () => {
  it('reads the page number.', () => {
    expect(parseListPage('3', 5)).toEqual(3)
  })

  it('reads the last page.', () => {
    expect(parseListPage('5', 5)).toEqual(5)
  })

  it('treats a missing, invalid or non-positive value as the first page.', () => {
    expect(
      [null, 'abc', '0', '-4'].map((value) => parseListPage(value, 5))
    ).toEqual([1, 1, 1, 1])
  })

  it('returns null past the last page.', () => {
    expect(parseListPage('6', 5)).toEqual(null)
  })
})
