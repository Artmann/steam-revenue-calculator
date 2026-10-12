import type {
  HeadersFunction,
  LoaderFunction,
  MetaFunction
} from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import type { ReactElement } from 'react'

import { Page } from '~/components/page'
import { CANONICAL_CACHE_CONTROL, SITE_URL } from '~/market/constants'
import { formatCompactCurrency, formatPercent } from '~/market/format'
import { listTagSummaries } from '~/market/market-service.server'
import {
  parseTagSort,
  sortTagSummaries,
  type TagSort,
  type TagSummary
} from '~/market/tag-summaries'

interface LoaderData {
  sort: TagSort
  tags: TagSummary[]
}

const title = 'Steam tags ranked by revenue — Steam Revenue Calculator'
const description =
  'Which kinds of games make money on Steam? Every Steam tag ranked by median estimated revenue, number of games, and the share earning over $100K.'

export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? CANONICAL_CACHE_CONTROL
})

export const loader: LoaderFunction = async ({ request }) => {
  const sort = parseTagSort(new URL(request.url).searchParams.get('sort'))
  const data: LoaderData = {
    sort,
    tags: sortTagSummaries(await listTagSummaries(), sort)
  }

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': CANONICAL_CACHE_CONTROL
    }
  })
}

export const meta: MetaFunction = () => [
  { title },
  { name: 'description', content: description },
  { property: 'og:title', content: title },
  { property: 'og:description', content: description },
  { property: 'og:url', content: `${SITE_URL}/tags` },
  { tagName: 'link', rel: 'canonical', href: `${SITE_URL}/tags` }
]

const columns: { sort: TagSort; label: string }[] = [
  { sort: 'count', label: 'Games' },
  { sort: 'median', label: 'Median' },
  { sort: 'share', label: 'Over $100K' }
]

export default function TagsIndexRoute(): ReactElement {
  const { sort, tags } = useLoaderData<LoaderData>()

  return (
    <Page>
      <div className="flex flex-col gap-12">
        <header className="flex flex-col gap-6 pt-4 md:pt-10 max-w-2xl">
          <div className="eyebrow">Markets</div>
          <h1 className="font-display leading-[1.02]">
            Steam tags by revenue
          </h1>
          <p className="text-lg text-paper-muted max-w-xl">
            What a typical game earns in each corner of Steam. Pick a tag for
            the full breakdown.
          </p>
        </header>

        <section>
          <div className="grid grid-cols-[1fr_5rem_6rem_6rem] gap-4 eyebrow pb-3 border-b border-rule-strong">
            <div>Tag</div>
            {columns.map((column) => (
              <Link
                key={column.sort}
                className={`text-right ${
                  sort === column.sort ? 'text-accent' : 'hover:text-paper'
                }`}
                to={`/tags?sort=${column.sort}`}
              >
                {column.label}
              </Link>
            ))}
          </div>

          <div className="divide-y divide-rule">
            {tags.map((tag) => (
              <div
                key={tag.slug}
                className="grid grid-cols-[1fr_5rem_6rem_6rem] gap-4 py-2 items-baseline"
              >
                <Link
                  className="font-display text-lg hover:text-accent truncate"
                  to={`/tags/${tag.slug}`}
                >
                  {tag.name}
                </Link>
                <div className="text-right tabular-nums text-paper-muted">
                  {tag.gameCount.toLocaleString('en-US')}
                </div>
                <div className="text-right tabular-nums">
                  {formatCompactCurrency(tag.median)}
                </div>
                <div className="text-right tabular-nums">
                  {formatPercent(tag.shareAboveHundredThousand)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Page>
  )
}
