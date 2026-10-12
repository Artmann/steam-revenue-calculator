import { formatCompactCurrency, formatDate, formatPercent } from '~/market/format'

describe('format', () => {
  it('formats compact currency.', () => {
    expect(formatCompactCurrency(950)).toBe('$950')
    expect(formatCompactCurrency(12_300)).toBe('$12.3K')
    expect(formatCompactCurrency(4_000_000)).toBe('$4M')
  })

  it('formats shares as whole percentages, keeping small non-zero shares visible.', () => {
    expect(formatPercent(0.123)).toBe('12%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(0.002)).toBe('<1%')
  })

  it('formats dates in UTC so server and client agree.', () => {
    expect(formatDate('2026-10-12T23:30:00Z')).toBe('October 12, 2026')
  })
})
