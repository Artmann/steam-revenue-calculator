import type { HeadersFunction, MetaFunction } from 'react-router'
import type { ReactElement, ReactNode } from 'react'

import { useState } from 'react'

import { CalculatorField, Figure } from '~/components/calculator-field'
import { Page } from '~/components/page'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '~/components/ui/select'
import { formatCurrency, formatNumber } from '~/games'
import {
  earlyAccessFactor,
  estimateSales,
  premiumPriceFactor,
  premiumPriceThreshold,
  salesPerWishlist,
  type Period,
  type Range
} from '~/wishlists/estimate-sales'
import { launches } from '~/wishlists/launches'
import { SalesChart } from '~/wishlists/sales-chart'

const title = 'Steam Wishlist Calculator — How Many Sales Will Your Wishlists Bring?'
const description = 'Estimate first-week, first-month and first-year sales and revenue from your Steam wishlists, based on published conversion data and real launch numbers.'
const url = 'https://steam-revenue-calculator.com/wishlist-calculator'

export const meta: MetaFunction = () => {
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { tagName: 'link', rel: 'canonical', href: url }
  ]
}

export const headers: HeadersFunction = () => {
  return {
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
  }
}

const periodLabels: Record<Period, string> = {
  week: 'Week 1',
  month: 'Month 1',
  year: 'Year 1'
}

const linkClass = 'text-accent underline underline-offset-4 hover:decoration-accent'

export default function WishlistCalculatorRoute(): ReactElement {
  const [wishlists, setWishlists] = useState('10000')
  const [price, setPrice] = useState('14.99')
  const [earlyAccess, setEarlyAccess] = useState(false)

  const wishlistCount = Math.max(0, parseInt(wishlists, 10) || 0)
  const priceValue = Math.max(0, parseFloat(price) || 0)
  const estimates = estimateSales({
    earlyAccess,
    price: priceValue,
    wishlists: wishlistCount
  })
  const year = estimates[estimates.length - 1]

  return (
    <Page>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 pt-4 md:pt-16">
        <header className="md:col-span-7 flex flex-col gap-8">
          <div className="eyebrow">Wishlist calculator</div>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.02] md:leading-none tracking-tight">
            How many copies will your wishlists <em className="text-accent">sell</em>?
          </h1>
          <p className="text-lg md:text-xl text-paper leading-relaxed md:leading-7 max-w-xl">
            You launch with <Figure>{formatNumber(wishlistCount)} wishlists</Figure> at a
            price of <Figure>{formatCurrency(priceValue)}</Figure> as{' '}
            <Figure>{earlyAccess ? 'an Early Access game' : 'a full release'}</Figure>. Based
            on how other Steam games converted their wishlists, this is the
            range of sales you can expect.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-lg">
            <CalculatorField
              id="wishlists"
              label="Wishlists at launch"
              value={wishlists}
              onChange={setWishlists}
              inputMode="numeric"
            />
            <CalculatorField
              id="price"
              label="Price (USD)"
              value={price}
              onChange={setPrice}
              inputMode="decimal"
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="release-type"
                className="eyebrow"
              >
                Release type
              </label>
              <Select
                value={earlyAccess ? 'early-access' : 'full'}
                onValueChange={(value) => setEarlyAccess(value === 'early-access')}
              >
                <SelectTrigger
                  id="release-type"
                  className="text-lg"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full release</SelectItem>
                  <SelectItem value="early-access">Early Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        <aside className="md:col-span-5 md:border-l md:border-rule md:pl-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="eyebrow">Typical first-year sales</div>
            <div
              className="figures-display"
              data-testid="year-sales"
            >
              {formatNumber(year.sales.typical)}
            </div>
            <div className="text-sm text-paper-muted figures">
              Range {formatNumber(year.sales.low)} – {formatNumber(year.sales.high)} copies
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-rule-strong pt-4">
            <div className="eyebrow">Typical first-year net revenue</div>
            <div
              className="font-display text-3xl figures text-accent"
              data-testid="year-net-revenue"
            >
              {formatCurrency(year.netRevenue.typical, true)}
            </div>
            <div className="text-sm text-paper-muted figures">
              Range {formatCurrency(year.netRevenue.low, true)} – {formatCurrency(year.netRevenue.high, true)}.
              After Steam's cut, VAT, refunds, discounts and regional pricing.
            </div>
          </div>
        </aside>
      </div>

      <section className="pt-10 border-t border-rule flex flex-col gap-8">
        <h2 className="font-display text-3xl md:text-4xl">Sales and revenue over time</h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-rule-strong text-left">
                <th className="py-2.5 font-normal eyebrow">Period</th>
                <th className="py-2.5 font-normal eyebrow text-right">Low</th>
                <th className="py-2.5 font-normal eyebrow text-right">Typical</th>
                <th className="py-2.5 font-normal eyebrow text-right">High</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((estimate) => (
                <tr
                  key={estimate.period}
                  className="border-b border-rule align-top"
                  data-testid={`row-${estimate.period}`}
                >
                  <th className="py-3 text-left font-display text-lg font-normal">
                    {periodLabels[estimate.period]}
                  </th>
                  <RangeCells
                    net={estimate.netRevenue}
                    sales={estimate.sales}
                  />
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-paper-dim">
            Copies sold since launch, with net revenue below. Totals are
            cumulative, so year 1 includes week 1 and month 1.
          </p>
        </div>

        <SalesChart
          estimates={estimates}
          launches={launches}
          wishlists={wishlistCount}
        />
      </section>

      <section className="pt-10 border-t border-rule flex flex-col gap-10">
        <h2 className="font-display text-3xl md:text-4xl">What the research says</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
          <Callout
            number="01"
            title="There are two numbers called “conversion”"
          >
            Steamworks reports the share of your wishlisters who bought, which
            is usually 5–13%. The number that predicts sales is different: all
            sales divided by your wishlists at launch. It counts buyers who
            never wishlisted, so it runs several times higher. This calculator
            uses the second one.
          </Callout>
          <Callout
            number="02"
            title="The “0.5 sales per wishlist” rule is optimistic"
          >
            The rule comes from{' '}
            <a
              className={linkClass}
              href="https://greyaliengames.com/blog/how-many-wishlists-should-you-have-when-launching-on-steam"
            >
              Jake Birkett's 2018 data
            </a>
            , where the median was 0.36. GameDiscoverCo's recent surveys put
            the week-1 median at 0.15–0.22, and about 0.10 for games over $10.
          </Callout>
          <Callout
            number="03"
            title="The spread is enormous"
          >
            GameDiscoverCo finds outcomes vary 10–20x around the median. In the
            launches we collected, week-1 sales ran from 0.02 to 1.19 copies
            per wishlist. Treat the typical figure as the middle of a wide
            range, not a forecast.
          </Callout>
          <Callout
            number="04"
            title="Most of the first year happens after launch week"
          >
            Month 1 is usually 1.25–1.5x week 1. By the end of the first year a
            game has sold about 2.5x its launch-week units, mostly through
            sales and discounts. The first week tells you which part of the
            range you are in.
          </Callout>
        </div>
      </section>

      <section className="pt-10 border-t border-rule grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16">
        <div className="md:col-span-4 flex flex-col gap-4">
          <h2 className="font-display text-3xl md:text-4xl">What moves the number</h2>
          <p className="text-paper-muted">
            Wishlists are the best single predictor of launch sales, but these
            push a game toward the low or high end.
          </p>
        </div>
        <dl className="md:col-span-8 divide-y divide-rule border-y border-rule">
          <Factor term="Price">
            Cheaper games convert better. Above $10 the median falls by about a
            third. The calculator applies this.
          </Factor>
          <Factor term="Early Access">
            Early Access launches convert about a third lower than full
            releases. Wishlists left over when the game reaches 1.0 convert
            even worse. The calculator applies this.
          </Factor>
          <Factor term="Reviews">
            The best converters averaged 91% positive reviews in their first
            week. The worst averaged 67%. Games rated 95% or higher reach about
            0.5 sales per wishlist in the first month.
          </Factor>
          <Factor term="Wishlist quality">
            Wishlists from festivals, giveaways and free prologues convert
            worse. A demo that gives away too much can replace the purchase.
          </Factor>
          <Factor term="Momentum">
            Fresh wishlists convert better than old ones. Games that beat the
            median spent around 7 months on the store before launch. Games
            that missed it spent over a year.
          </Factor>
          <Factor term="Timing">
            Launching during a big seasonal sale, especially the Winter Sale,
            converts poorly.
          </Factor>
        </dl>
      </section>

      <section className="pt-10 border-t border-rule flex flex-col gap-8">
        <div className="flex flex-col gap-4 max-w-2xl">
          <h2 className="font-display text-3xl md:text-4xl">Real launches</h2>
          <p className="text-paper-muted">
            Developers who shared both their wishlists at launch and their
            sales. The periods differ, so compare each one with the matching
            row above.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-rule-strong text-left">
                <th className="py-2.5 font-normal eyebrow">Game</th>
                <th className="py-2.5 font-normal eyebrow text-right">Wishlists</th>
                <th className="py-2.5 font-normal eyebrow text-right">Sales</th>
                <th className="py-2.5 font-normal eyebrow pl-6">Period</th>
                <th className="py-2.5 font-normal eyebrow text-right">Per wishlist</th>
              </tr>
            </thead>
            <tbody>
              {launches.map((launch) => (
                <tr
                  key={launch.name}
                  className="border-b border-rule"
                >
                  <td className="py-2.5">
                    <a
                      className="hover:text-accent"
                      href={launch.source}
                      rel="noopener"
                    >
                      {launch.name}
                    </a>
                    {launch.note ? (
                      <span className="block text-xs text-paper-dim">{launch.note}</span>
                    ) : null}
                  </td>
                  <td className="py-2.5 text-right figures">{formatNumber(launch.wishlists)}</td>
                  <td className="py-2.5 text-right figures">{formatNumber(launch.sales)}</td>
                  <td className="py-2.5 pl-6 text-paper-muted">{launch.period}</td>
                  <td className="py-2.5 text-right figures">
                    {(launch.sales / launch.wishlists).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pt-10 border-t border-rule grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16">
        <div className="md:col-span-4">
          <h2 className="font-display text-3xl md:text-4xl">Method</h2>
        </div>
        <div className="md:col-span-8 flex flex-col gap-6 max-w-2xl">
          <p>
            The calculator multiplies your wishlists by a sales-per-wishlist
            ratio for each period. The ratios are our own estimates, drawn
            from GameDiscoverCo's surveys of hundreds of launches, Jake
            Birkett's data and the developer postmortems above.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule-strong text-left">
                <th className="py-2 font-normal eyebrow">Sales per wishlist</th>
                <th className="py-2 font-normal eyebrow text-right">Low</th>
                <th className="py-2 font-normal eyebrow text-right">Typical</th>
                <th className="py-2 font-normal eyebrow text-right">High</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(salesPerWishlist) as Period[]).map((period) => (
                <tr
                  key={period}
                  className="border-b border-rule"
                >
                  <td className="py-2 text-paper-muted">{periodLabels[period]}</td>
                  <td className="py-2 text-right figures">{salesPerWishlist[period].low.toFixed(2)}</td>
                  <td className="py-2 text-right figures">{salesPerWishlist[period].typical.toFixed(2)}</td>
                  <td className="py-2 text-right figures">{salesPerWishlist[period].high.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Games priced at ${premiumPriceThreshold} or more get{' '}
            {premiumPriceFactor}x these ratios, and Early Access games get{' '}
            {earlyAccessFactor}x. Revenue is copies times price, run through
            the same breakdown as the{' '}
            <a
              className={linkClass}
              href="/"
            >
              revenue calculator
            </a>
            .
          </p>
          <p className="text-sm text-paper-muted">
            Sources:{' '}
            <a
              className={linkClass}
              href="https://newsletter.gamediscover.co/p/the-state-of-steam-wishlist-conversions"
            >
              GameDiscoverCo, the state of Steam wishlist conversions
            </a>
            ;{' '}
            <a
              className={linkClass}
              href="https://newsletter.gamediscover.co/p/revealed-the-state-of-steam-wishlist"
            >
              GameDiscoverCo, wishlist survey of 100+ games
            </a>
            ;{' '}
            <a
              className={linkClass}
              href="https://www.gamedeveloper.com/business/steam-the-new-wishlists-to-first-week-sales-expectations"
            >
              Game Developer, wishlists to first-week sales
            </a>
            ;{' '}
            <a
              className={linkClass}
              href="https://greyaliengames.com/blog/how-many-wishlists-should-you-have-when-launching-on-steam"
            >
              Jake Birkett, how many wishlists should you have
            </a>
            .
          </p>
        </div>
      </section>
    </Page>
  )
}

function RangeCells({ net, sales }: { net: Range; sales: Range }): ReactElement {
  const keys: (keyof Range)[] = ['low', 'typical', 'high']

  return (
    <>
      {keys.map((key) => (
        <td
          key={key}
          className={`py-3 text-right figures ${key === 'typical' ? 'text-accent' : ''}`}
        >
          <div className="text-lg">{formatNumber(sales[key])}</div>
          <div className="text-paper-muted">{formatCurrency(net[key], true)}</div>
        </td>
      ))}
    </>
  )
}

function Callout({
  children,
  number,
  title
}: {
  children: ReactNode
  number: string
  title: string
}): ReactElement {
  return (
    <article className="flex gap-5 border-t border-rule pt-6">
      <div className="eyebrow pt-1.5 w-6 shrink-0">{number}</div>
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-xl leading-snug">{title}</h3>
        <p className="text-paper-muted leading-relaxed">{children}</p>
      </div>
    </article>
  )
}

function Factor({ children, term }: { children: ReactNode; term: string }): ReactElement {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-x-6 gap-y-1 py-4">
      <dt className="font-display text-lg">{term}</dt>
      <dd className="text-paper-muted leading-relaxed">{children}</dd>
    </div>
  )
}
