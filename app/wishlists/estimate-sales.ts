import { revenueBreakdown } from '~/revenue'

export type Period = 'week' | 'month' | 'year'

export interface Range {
  high: number
  low: number
  typical: number
}

export interface PeriodEstimate {
  grossRevenue: Range
  netRevenue: Range
  period: Period
  sales: Range
}

export interface EstimateInput {
  earlyAccess: boolean
  price: number
  wishlists: number
}

// Sales per launch wishlist (all sales in the period divided by the wishlist
// count on launch day). Our own estimates from GameDiscoverCo's surveys, Jake
// Birkett's data and ~30 developer postmortems. See
// docs/research/wishlist-conversion.md.
export const salesPerWishlist: Record<Period, Range> = {
  week: { low: 0.05, typical: 0.18, high: 0.5 },
  month: { low: 0.06, typical: 0.25, high: 0.65 },
  year: { low: 0.12, typical: 0.5, high: 1.3 }
}

export const periods: Period[] = ['week', 'month', 'year']

// GameDiscoverCo: games over $10 convert at ~0.10 against ~0.15 overall.
export const premiumPriceThreshold = 10
export const premiumPriceFactor = 0.75

// Early Access launches convert about a third lower than full releases.
export const earlyAccessFactor = 0.7

export function conversionFactor({ earlyAccess, price }: Omit<EstimateInput, 'wishlists'>): number {
  let factor = 1

  if (price >= premiumPriceThreshold) {
    factor *= premiumPriceFactor
  }

  if (earlyAccess) {
    factor *= earlyAccessFactor
  }

  return factor
}

export function estimateSales(input: EstimateInput): PeriodEstimate[] {
  const wishlists = Math.max(0, input.wishlists)
  const price = Math.max(0, input.price)
  const factor = conversionFactor(input)

  return periods.map((period) => {
    const ratios = salesPerWishlist[period]

    const sales = mapRange(ratios, (ratio) => Math.round(wishlists * ratio * factor))
    const grossRevenue = mapRange(sales, (units) => units * price)
    const netRevenue = mapRange(grossRevenue, (gross) => revenueBreakdown(gross).netRevenue)

    return { grossRevenue, netRevenue, period, sales }
  })
}

function mapRange(range: Range, fn: (value: number) => number): Range {
  return {
    high: fn(range.high),
    low: fn(range.low),
    typical: fn(range.typical)
  }
}
