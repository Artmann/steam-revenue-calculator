export interface TagSummary {
  name: string
  slug: string
  gameCount: number
  median: number
  shareAboveHundredThousand: number
}

export type TagSort = 'median' | 'count' | 'share'

const sortKeys: Record<TagSort, (summary: TagSummary) => number> = {
  median: ({ median }) => median,
  count: ({ gameCount }) => gameCount,
  share: ({ shareAboveHundredThousand }) => shareAboveHundredThousand
}

export function parseTagSort(value: string | null): TagSort {
  return value === 'count' || value === 'share' ? value : 'median'
}

export function sortTagSummaries(
  summaries: TagSummary[],
  sort: TagSort
): TagSummary[] {
  const key = sortKeys[sort]

  return [...summaries].sort(
    (a, b) => key(b) - key(a) || a.name.localeCompare(b.name)
  )
}
