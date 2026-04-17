import type { HeadersFunction, V2_MetaFunction , LoaderFunction } from '@remix-run/node'

import { Link, useLoaderData } from '@remix-run/react'
import { useState } from 'react'
import slugify from 'slugify'

import { Page } from '~/components/page'
import type { GameDetails } from '~/games'
import { calculateRevenue, revenueBreakdown } from '~/revenue'
import { RevenueBreakdownTable } from '~/revenue/revenue-breakdown-table'
import { GameService } from '~/services/game-service.server'

interface LoaderData {
  popularGames: GameDetails[]
}

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: 'Steam Revenue Calculator — Estimate Any Game\'s Revenue on Steam'
    },
    {
      name: 'description',
      content: 'Use the Boxleiter method to estimate how much any Steam game has made. Enter review count and price to calculate gross revenue, net revenue, and a full financial breakdown.'
    },
    {
      property: 'og:title',
      content: 'Steam Revenue Calculator — Estimate Any Game\'s Revenue on Steam'
    },
    {
      property: 'og:description',
      content: 'Use the Boxleiter method to estimate how much any Steam game has made. Enter review count and price to calculate gross revenue, net revenue, and a full financial breakdown.'
    },
    {
      property: 'og:url',
      content: 'https://steam-revenue-calculator.com/'
    },
    {
      tagName: 'link',
      rel: 'canonical',
      href: 'https://steam-revenue-calculator.com/'
    }
  ]
}

export const headers: HeadersFunction = () => {
  return {
    'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
  }
}

export const loader: LoaderFunction = async () => {
  const gameService = new GameService()
  const popularGames = await gameService.listPopularGames()

  return { popularGames }
}

export default function HomePageRoute() {
  const { popularGames } = useLoaderData<LoaderData>()

  const [numberOfReviews, setNumberOfReviews] = useState('1540')
  const [price, setPrice] = useState('14.99')

  const grossRevenue = calculateRevenue(
    parseInt(numberOfReviews, 10) || 0,
    parseFloat(price) || 0
  )

  return (
    <Page>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 pt-4 md:pt-16">
        <header className="md:col-span-7 flex flex-col gap-8">
          <div className="eyebrow">
            The Steam Revenue Calculator — Issue N°1
          </div>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.02] tracking-tight">
            How much does a game on Steam{' '}
            <em className="text-accent">actually</em> earn?
          </h1>
          <p className="text-lg md:text-xl text-paper leading-relaxed max-w-xl">
            The <InlineInput
              id="number-of-reviews"
              label="Reviews"
              value={numberOfReviews}
              onChange={setNumberOfReviews}
              suffix=" reviews"
              width="4.5rem"
            /> a Steam game has accumulated are a rough proxy for its number
            of owners. Multiply by a price of{' '}
            <InlineInput
              id="price"
              label="Price"
              value={price}
              onChange={setPrice}
              prefix="$"
              width="3.5rem"
              step="0.01"
            />
            {' '}and adjust for regional pricing, launch discounts, refunds,
            VAT, and Steam's 30% cut — what remains is what the developer
            actually banks. The method is called{' '}
            <a
              className="text-accent underline decoration-accent/50 underline-offset-4 hover:decoration-accent"
              href="https://greyaliengames.com/blog/how-to-estimate-how-many-sales-a-steam-game-has-made"
            >
              Boxleiter
            </a>
            ; treat the output as an order-of-magnitude guide, not an audit.
          </p>
        </header>

        <aside className="md:col-span-5 md:border-l md:border-rule md:pl-10">
          <RevenueBreakdownTable breakdown={revenueBreakdown(grossRevenue)} />
        </aside>
      </div>

      <div className="mt-24 md:mt-32 pt-10 border-t border-rule">
        <div className="flex items-baseline justify-between gap-6 mb-10">
          <h2 className="font-display text-3xl md:text-4xl">Selected titles</h2>
          <Link
            to="/games"
            className="text-sm text-accent hover:text-accent-strong"
          >
            View the full ranking →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
          {popularGames.map((game, index) => (
            <article
              key={game.id}
              className="flex gap-5 items-start border-t border-rule pt-6"
            >
              <div className="eyebrow pt-1 w-6 shrink-0">
                {String(index + 1).padStart(2, '0')}
              </div>
              <Link
                to={`/app/${game.id}/${slugify(game.name, { lower: true })}`}
                className="shrink-0"
              >
                <img
                  alt={game.name}
                  className="w-28 aspect-video object-cover"
                  src={game.screenshots[0]}
                />
              </Link>
              <div className="space-y-1.5 flex-1 min-w-0">
                <Link
                  className="hover:text-accent"
                  to={`/app/${game.id}/${slugify(game.name, { lower: true })}`}
                >
                  <h3 className="font-display text-lg leading-tight truncate">
                    {game.name}
                  </h3>
                </Link>
                <p className="text-sm text-paper-muted leading-snug line-clamp-2">
                  {game.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Page>
  )
}

function InlineInput({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  width,
  step
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  prefix?: string
  suffix?: string
  width: string
  step?: string
}) {
  return (
    <span className="whitespace-nowrap inline-flex items-baseline">
      <label
        htmlFor={id}
        className="sr-only"
      >
        {label}
      </label>
      {prefix ? <span className="text-paper-muted">{prefix}</span> : null}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width }}
        className="inline-number-input bg-transparent border-b border-dashed border-rule-strong focus:border-accent text-accent font-sans font-medium tabular-nums lining-nums slashed-zero tracking-tight px-1 mx-0.5 focus:outline-none focus:border-solid transition-colors"
      />
      {suffix ? <span className="text-paper-muted">{suffix}</span> : null}
    </span>
  )
}
