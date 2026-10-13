import { priceBucketsQuery } from './queries/price-buckets'
import { featureComparisonQuery } from './queries/feature-comparison'
import { reviewDistributionQuery } from './queries/review-distribution'

export interface StatsQuery {
  name: string
  description: string
  run: () => Promise<unknown>
}

export const queries: StatsQuery[] = [
  priceBucketsQuery,
  featureComparisonQuery,
  reviewDistributionQuery
]

export function findQuery(name: string): StatsQuery | undefined {
  return queries.find((query) => query.name === name)
}
