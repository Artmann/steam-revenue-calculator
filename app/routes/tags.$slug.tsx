import type { HeadersFunction, LoaderFunction, MetaFunction } from 'react-router'
import { Link, useLoaderData } from 'react-router'
import type { ReactElement } from 'react'

import { Page } from '~/components/page'
import { BarList } from '~/market/components/bar-list'
import { FilterForm, type FilterValues } from '~/market/components/filter-form'
import {
  CANONICAL_CACHE_CONTROL,
  FILTERED_CACHE_CONTROL,
  MIN_GAMES_FOR_STATS,
  SITE_URL
} from '~/market/constants'
import {
  buildMarketQuery,
  isFiltered,
  parseMarketFilters
} from '~/market/filters'
import {
  formatCompactCurrency,
  formatDate,
  formatPercent
} from '~/market/format'
import {
  getBaseline,
  getTagBySlug,
  getTagIndex,
  loadMarketGames
} from '~/market/market-service.server'
import {
  computeMarketStats,
  type MarketStats,
  type RelatedTag,
  type TopCompany
} from '~/market/stats'

export interface LoaderData {
  tag: { name: string; slug: string }
  stats: MarketStats
  baseline: MarketStats | null
  statsUpdatedAt: string
  isFiltered: boolean
  filterValues: FilterValues
  unknownTags: string[]
  relatedTags: (RelatedTag & { name: string; slug: string; hasPage: boolean })[]
  tagOptions: { slug: string; name: string }[]
}

export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? CANONICAL_CACHE_CONTROL
})

export const loader: LoaderFunction = async ({ params, request }) => {
  const tag = await getTagBySlug(params.slug ?? '')

  if (!tag || !tag.stats) {
    throw new Response(null, { status: 404, statusText: 'Tag Not Found.' })
  }

  const [baseline, tagIndex] = await Promise.all([getBaseline(), getTagIndex()])
  const searchParams = new URL(request.url).searchParams
  const filters = parseMarketFilters(
    searchParams,
    new Map(tagIndex.map(({ slug, tagId }) => [slug, tagId])),
    tag.tagId
  )
  const filtered = isFiltered(filters)

  const stats = filtered
    ? computeMarketStats(
        await loadMarketGames(buildMarketQuery(tag.tagId, filters)),
        baseline?.tagFrequencies,
        [tag.tagId, ...filters.withTagIds]
      )
    : tag.stats

  const tagsById = new Map(tagIndex.map((entry) => [entry.tagId, entry]))

  const data: LoaderData = {
    tag: { name: tag.name, slug: tag.slug },
    stats,
    baseline: baseline?.stats ?? null,
    statsUpdatedAt: new Date(tag.statsUpdatedAt ?? Date.now()).toISOString(),
    isFiltered: filtered,
    filterValues: {
      price: searchParams.get('price') ?? '',
      since: searchParams.get('since') ?? '',
      until: searchParams.get('until') ?? '',
      with: searchParams.getAll('with').join(',')
    },
    unknownTags: filters.unknownTags,
    relatedTags: stats.relatedTags.flatMap((related) => {
      const entry = tagsById.get(related.tagId)

      return entry ? [{ ...related, ...entry }] : []
    }),
    tagOptions: tagIndex
      .filter(({ hasPage, tagId }) => hasPage && tagId !== tag.tagId)
      .map(({ slug, name }) => ({ slug, name }))
  }

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': filtered
        ? FILTERED_CACHE_CONTROL
        : CANONICAL_CACHE_CONTROL
    }
  })
}

export const meta: MetaFunction = ({ data }) => {
  if (!data) {
    return [{ title: 'Tag not found — Steam Revenue Calculator' }]
  }

  const { tag, stats, isFiltered: filtered } = data as LoaderData
  const title = `How much do ${tag.name} games make on Steam? — Steam Revenue Calculator`
  const description = `Median revenue, revenue distribution, price bands and top earners for ${stats.gameCount.toLocaleString(
    'en-US'
  )} ${tag.name} games on Steam, estimated with the Boxleiter method.`
  const url = `${SITE_URL}/tags/${tag.slug}`

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { tagName: 'link', rel: 'canonical', href: url },
    ...(filtered ? [{ name: 'robots', content: 'noindex, follow' }] : [])
  ]
}

export default function TagRoute(): ReactElement {
  const data = useLoaderData<LoaderData>()
  const { tag, stats, baseline } = data
  const enoughGames = stats.gameCount >= MIN_GAMES_FOR_STATS

  return (
    <Page>
      <div className="flex flex-col gap-12">
        <header className="flex flex-col gap-6 pt-4 md:pt-10 max-w-3xl">
          <div className="eyebrow">
            <Link
              className="hover:text-paper"
              to="/tags"
            >
              Tags
            </Link>{' '}
            · Data as of {formatDate(data.statsUpdatedAt)}
          </div>
          <h1
            className="font-display leading-[1.02]"
            data-testid="title"
          >
            How much do {tag.name} games make on Steam?
          </h1>
        </header>

        {enoughGames && (
          <Headline
            baseline={baseline}
            stats={stats}
          />
        )}

        <FilterForm
          action={`/tags/${tag.slug}`}
          tagOptions={data.tagOptions}
          values={data.filterValues}
        />

        {data.unknownTags.length > 0 && (
          <p className="text-sm text-paper-muted">
            Ignored unknown tags: {data.unknownTags.join(', ')}
          </p>
        )}

        {enoughGames ? (
          <>
            <Section title="How revenue is spread">
              <BarList
                rows={stats.distribution.map(({ label, count }) => ({
                  label,
                  value: count,
                  display: count.toLocaleString('en-US')
                }))}
                testId="distribution"
              />
            </Section>

            <Section title="Median revenue by price">
              <BarList
                rows={stats.priceBands.map(({ label, count, median }) => ({
                  label,
                  value: median,
                  display: count > 0 ? formatCompactCurrency(median) : '—',
                  note: `${count.toLocaleString('en-US')} ${count === 1 ? 'game' : 'games'}`
                }))}
              />
            </Section>

            <Section title="Median revenue by release year">
              <BarList
                rows={stats.byYear.map(({ year, count, median }) => ({
                  label: String(year),
                  value: median,
                  display: formatCompactCurrency(median),
                  note: `${count.toLocaleString('en-US')} ${count === 1 ? 'game' : 'games'}`
                }))}
              />
            </Section>
          </>
        ) : (
          <p className="text-paper-muted">
            {stats.gameCount === 0
              ? 'No games match these filters.'
              : `Not enough games match these filters for reliable statistics. Showing the ${stats.gameCount} that do.`}
          </p>
        )}

        <Section title="Top games">
          <ol className="divide-y divide-rule">
            {stats.topGames.map((game, index) => (
              <li key={game.gameId}>
                <Link
                  className="grid grid-cols-[2.5rem_1fr_auto] gap-4 py-2 hover:text-accent"
                  to={`/app/${game.gameId}/${game.slug}`}
                >
                  <span className="text-paper-muted tabular-nums">
                    {index + 1}
                  </span>
                  <span className="truncate">{game.name}</span>
                  <span className="tabular-nums">
                    {formatCompactCurrency(game.grossRevenue)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Section>

        {stats.gameCount > 0 && (
          <div className="grid gap-12 md:grid-cols-2">
            <CompanyList
              companies={stats.topDevelopers}
              title="Top developers"
            />
            <CompanyList
              companies={stats.topPublishers}
              title="Top publishers"
            />
          </div>
        )}

        {data.relatedTags.length > 0 && (
          <Section title="Related tags">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {data.relatedTags.map((related) => (
                <li key={related.tagId}>
                  {related.hasPage ? (
                    <Link
                      className="text-accent hover:text-accent-strong underline underline-offset-4"
                      to={`/tags/${related.slug}`}
                    >
                      {related.name}
                    </Link>
                  ) : (
                    <span>{related.name}</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </Page>
  )
}

function Headline({
  stats,
  baseline
}: {
  stats: MarketStats
  baseline: MarketStats | null
}): ReactElement {
  const figures = [
    {
      label: 'Median revenue',
      value: formatCompactCurrency(stats.percentiles.p50),
      compare: baseline && formatCompactCurrency(baseline.percentiles.p50),
      testId: 'median'
    },
    {
      label: 'Middle half earn',
      value: `${formatCompactCurrency(stats.percentiles.p25)}–${formatCompactCurrency(stats.percentiles.p75)}`,
      compare: null,
      testId: 'middle-half'
    },
    {
      label: 'Top 10% earn over',
      value: formatCompactCurrency(stats.percentiles.p90),
      compare: baseline && formatCompactCurrency(baseline.percentiles.p90),
      testId: 'p90'
    },
    {
      label: 'Earn over $100K',
      value: formatPercent(stats.shareAbove.hundredThousand),
      compare: baseline && formatPercent(baseline.shareAbove.hundredThousand),
      testId: 'share-100k'
    },
    {
      label: 'Games',
      value: stats.gameCount.toLocaleString('en-US'),
      compare: null,
      testId: 'game-count'
    }
  ]

  return (
    <section className="grid grid-cols-2 md:grid-cols-5 gap-8 border-b border-rule pb-8">
      {figures.map((figure) => (
        <div
          key={figure.label}
          className="space-y-1.5"
        >
          <div className="eyebrow">{figure.label}</div>
          <div
            className="font-sans text-2xl tabular-nums"
            data-testid={figure.testId}
          >
            {figure.value}
          </div>
          {figure.compare && (
            <div className="text-xs text-paper-dim">
              All Steam: {figure.compare}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: ReactElement
}): ReactElement {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl">{title}</h2>
      {children}
    </section>
  )
}

function CompanyList({
  title,
  companies
}: {
  title: string
  companies: TopCompany[]
}): ReactElement {
  return (
    <Section title={title}>
      <ol className="divide-y divide-rule text-sm">
        {companies.map((company) => (
          <li
            key={company.name}
            className="flex justify-between gap-4 py-2"
          >
            <span className="truncate">{company.name}</span>
            <span className="text-paper-muted tabular-nums shrink-0">
              {company.gameCount} games · {formatCompactCurrency(company.revenue)}
            </span>
          </li>
        ))}
      </ol>
    </Section>
  )
}
