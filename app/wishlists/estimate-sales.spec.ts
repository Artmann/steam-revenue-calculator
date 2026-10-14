import { describe, it, expect } from 'vitest'

import { conversionFactor, estimateSales } from './estimate-sales'

describe('Estimate Sales', () => {
  describe('conversionFactor', () => {
    it('does not adjust cheap full releases.', () => {
      expect(conversionFactor({ earlyAccess: false, price: 9.99 })).toEqual(1)
    })

    it('lowers conversion for games at $10 or more.', () => {
      expect(conversionFactor({ earlyAccess: false, price: 10 })).toEqual(0.75)
    })

    it('lowers conversion for Early Access.', () => {
      expect(conversionFactor({ earlyAccess: true, price: 5 })).toEqual(0.7)
    })

    it('combines both adjustments.', () => {
      expect(conversionFactor({ earlyAccess: true, price: 20 })).toBeCloseTo(0.525)
    })
  })

  describe('estimateSales', () => {
    it('returns week, month and year estimates.', () => {
      const estimates = estimateSales({ earlyAccess: false, price: 5, wishlists: 10_000 })

      expect(estimates.map(({ period }) => period)).toEqual(['week', 'month', 'year'])
    })

    it('multiplies wishlists by the sales-per-wishlist ratios.', () => {
      const [week, month, year] = estimateSales({ earlyAccess: false, price: 5, wishlists: 10_000 })

      expect(week.sales).toEqual({ low: 500, typical: 1_800, high: 5_000 })
      expect(month.sales).toEqual({ low: 600, typical: 2_500, high: 6_500 })
      expect(year.sales).toEqual({ low: 1_200, typical: 5_000, high: 13_000 })
    })

    it('applies the price and Early Access adjustments.', () => {
      const [week] = estimateSales({ earlyAccess: true, price: 20, wishlists: 10_000 })

      expect(week.sales.typical).toEqual(945)
    })

    it('calculates gross revenue from sales and price.', () => {
      const [week] = estimateSales({ earlyAccess: false, price: 5, wishlists: 10_000 })

      expect(week.grossRevenue.typical).toEqual(9_000)
    })

    it('calculates net revenue with the revenue breakdown.', () => {
      const [week] = estimateSales({ earlyAccess: false, price: 5, wishlists: 10_000 })

      expect(week.netRevenue.typical).toBeCloseTo(9_000 * 0.59 * 0.5)
    })

    it('treats negative input as zero.', () => {
      const [week] = estimateSales({ earlyAccess: false, price: -5, wishlists: -100 })

      expect(week.sales).toEqual({ low: 0, typical: 0, high: 0 })
      expect(week.grossRevenue.typical).toEqual(0)
    })
  })
})
