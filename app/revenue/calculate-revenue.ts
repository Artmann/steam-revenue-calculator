export interface RevenueBreakdown {
  adjustedRegionalPricing: number
  discounts: number
  grossRevenue: number
  netRevenue: number
  refunds: number
  steamFee: number
  vat: number
}

export function calculateRevenue(numberOfReviews: number, price: number): number {
  const numberOfCopiesSold = numberOfReviews * 45.0
  const grossRevenue = numberOfCopiesSold * price

  return grossRevenue
}

export function revenueBreakdown(grossRevenue: number): RevenueBreakdown {
  const adjustedRegionalPricing = grossRevenue * 0.09
  const discounts = grossRevenue * 0.2
  const refunds = grossRevenue * 0.12

  const realRevenue = grossRevenue - adjustedRegionalPricing - discounts - refunds

  // TODO: Add tiered pricing.
  const steamFee = realRevenue * 0.3
  const vat = realRevenue * 0.2

  const netRevenue = realRevenue - steamFee - vat

  return {
    adjustedRegionalPricing,
    discounts,
    grossRevenue,
    netRevenue,
    refunds,
    steamFee,
    vat,
  }
}