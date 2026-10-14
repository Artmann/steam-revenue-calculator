import { describe, it, expect } from 'vitest'

import { niceTicks, spreadLabels } from './sales-chart'

describe('Sales Chart', () => {
  describe('niceTicks', () => {
    it('picks round steps that cover the maximum.', () => {
      expect(niceTicks(9_750)).toEqual([0, 2_500, 5_000, 7_500, 10_000])
    })

    it('handles a zero maximum.', () => {
      expect(niceTicks(0)).toEqual([0, 1])
    })
  })

  describe('spreadLabels', () => {
    it('leaves labels that are far apart alone.', () => {
      expect(spreadLabels([10, 50, 90])).toEqual([10, 50, 90])
    })

    it('pushes close labels apart.', () => {
      expect(spreadLabels([10, 12, 40])).toEqual([10, 16, 40])
    })

    it('keeps labels inside the chart.', () => {
      expect(spreadLabels([97, 99, 100])).toEqual([88, 94, 100])
    })
  })
})
