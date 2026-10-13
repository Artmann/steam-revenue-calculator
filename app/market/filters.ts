export interface MarketFilters {
  minPrice?: number
  maxPrice?: number
  since?: number
  until?: number
  withTagIds: number[]
  unknownTags: string[]
}

const pricePattern = /^(\d+(?:\.\d+)?)?-(\d+(?:\.\d+)?)?$/
const yearPattern = /^\d{4}$/
const firstSteamYear = 2003
const lastYear = 2100

export function parseMarketFilters(
  params: URLSearchParams,
  slugToTagId: Map<string, number>,
  ownTagId: number
): MarketFilters {
  const [minPrice, maxPrice] = ordered(...parsePrice(params.get('price')))
  const [since, until] = ordered(
    parseYear(params.get('since')),
    parseYear(params.get('until'))
  )

  const slugs = [
    ...new Set(
      params
        .getAll('with')
        .flatMap((value) => value.split(','))
        .map((slug) => slug.trim().toLowerCase())
        .filter(Boolean)
    )
  ]

  const withTagIds = new Set<number>()
  const unknownTags: string[] = []

  for (const slug of slugs) {
    const tagId = slugToTagId.get(slug)

    if (tagId === undefined) {
      unknownTags.push(slug)
    } else if (tagId !== ownTagId) {
      withTagIds.add(tagId)
    }
  }

  return {
    minPrice,
    maxPrice,
    since,
    until,
    withTagIds: [...withTagIds],
    unknownTags
  }
}

export function isFiltered(filters: MarketFilters): boolean {
  return (
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.since !== undefined ||
    filters.until !== undefined ||
    filters.withTagIds.length > 0
  )
}

export function buildMarketQuery(
  tagId: number,
  filters: MarketFilters
): Record<string, unknown> {
  const query: Record<string, unknown> = {
    tagIds: { $all: [tagId, ...filters.withTagIds] }
  }

  const price = range(filters.minPrice, filters.maxPrice, '$lt')
  const year = range(filters.since, filters.until, '$lte')

  if (price) {
    query.basePrice = price
  }

  if (year) {
    query.releaseYear = year
  }

  return query
}

function parsePrice(
  value: string | null
): [number | undefined, number | undefined] {
  const match = pricePattern.exec(value ?? '')

  if (!match || (!match[1] && !match[2])) {
    return [undefined, undefined]
  }

  const toCents = (dollars?: string) =>
    dollars === undefined ? undefined : Math.round(parseFloat(dollars) * 100)

  return [toCents(match[1]), toCents(match[2])]
}

function parseYear(value: string | null): number | undefined {
  if (!value || !yearPattern.test(value)) {
    return
  }

  const year = parseInt(value, 10)

  return year >= firstSteamYear && year <= lastYear ? year : undefined
}

function ordered(
  low: number | undefined,
  high: number | undefined
): [number | undefined, number | undefined] {
  return low !== undefined && high !== undefined && low > high
    ? [high, low]
    : [low, high]
}

function range(
  low: number | undefined,
  high: number | undefined,
  highOperator: '$lt' | '$lte'
): Record<string, number> | undefined {
  if (low === undefined && high === undefined) {
    return
  }

  return {
    ...(low !== undefined ? { $gte: low } : {}),
    ...(high !== undefined ? { [highOperator]: high } : {})
  }
}
