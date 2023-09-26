import { calculateRevenue, revenueBreakdown } from './calculate-revenue'

describe('Calculate Revenue', () => {
  describe('calculateRevenue', () => {

    it('calculates the gross revenue.', () => {
      expect(calculateRevenue(100, 10)).toEqual(20_000)
      expect(calculateRevenue(1_000, 10)).toEqual(360_000)
      expect(calculateRevenue(25_000, 10)).toEqual(12_250_000)
      expect(calculateRevenue(50_000, 10)).toEqual(29_500_000)
      expect(calculateRevenue(500_000, 10)).toEqual(240_000_000)
    })

  })

  describe('revenueBreakdown', () => {
    it('calculates the adjusted regional pricing.', () => {
      const breakdown = revenueBreakdown(100_000)

      expect(breakdown.adjustedRegionalPricing).toEqual(9_000)
    })

    it('calculates the discounts.', () => {
      const breakdown = revenueBreakdown(100_000)

      expect(breakdown.discounts).toEqual(20_000)
    })

    it('calculates the refunds.', () => {
      const breakdown = revenueBreakdown(100_000)

      expect(breakdown.refunds).toEqual(12_000)
    })

    it('calculates the steam fee.', () => {
      const breakdown = revenueBreakdown(100_000)

      expect(breakdown.steamFee).toEqual(17_700)
    })

    it('includes the gross revenue.', () => {
      const breakdown = revenueBreakdown(100_000)

      expect(breakdown.grossRevenue).toEqual(100_000)
    })

    it('calculates the net revenue.', () => {
      const breakdown = revenueBreakdown(100_000)

      expect(breakdown.netRevenue).toEqual(29_500)
    })

  })
})