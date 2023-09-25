import { useState } from 'react'
import { Page } from '~/components/page'
import { calculateRevenue, revenueBreakdown } from '~/revenue'
import { RevenueBreakdownTable } from '~/revenue/revenue-breakdown-table'

export default function HomePageRoute() {
  const [numberOfReviews, setNumberOfReviews] = useState('1540')
  const [price, setPrice] = useState('14.99')

  const grossRevenue = calculateRevenue(
    parseInt(numberOfReviews, 10) || 0,
    parseFloat(price) || 0
  )

  return (
    <Page>
      <div className="flex flex-col items-center gap-8 md:gap-32 md:flex-row md:flex-wrap md:items-start md:justify-center md:pt-32">
        <div className="max-w-sm flex flex-col gap-4 text-center md:text-left">
          <h1 className="text-3xl">
            Calculating the Revenue for Games on Steam
          </h1>
          <div className="mb-8">
            Using the{' '}
            <a
              className="underline text-primary"
              href="http://greyaliengames.com/blog/how-to-estimate-how-many-sales-a-steam-game-has-made"
            >
              Boxleiter method
            </a>{' '}
            we can use the number of review a game has on Steam to estimate the
            number of owners. From this, we can calculate the gross revenue and
            by adjusting for discounts, regional pricing, etc. we can get a
            rough idea of the net revune.
          </div>
          <div className="flex gap-4 flex-col items-center md:flex-row md:gap-8">
            <div className="">
              <label
                className="block uppercase tracking-wide font-semibold text-sm mb-2"
                htmlFor="number-of-reviews"
              >
                Reviews
              </label>
              <input
                className="border border-gray-300 rounded-md p-2 bg-transparent w-32"
                id="number-of-reviews"
                min="1"
                type="number"
                value={numberOfReviews}
                onChange={(e) => setNumberOfReviews(e.target.value)}
              />
            </div>
            <div className="">
              <label
                className="block uppercase tracking-wide font-semibold text-sm mb-2"
                htmlFor="price"
              >
                Price
              </label>
              <input
                className="border border-gray-300 rounded-md p-2 bg-transparent w-32"
                id="price"
                min="0"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div>
          <RevenueBreakdownTable breakdown={revenueBreakdown(grossRevenue)} />
        </div>
      </div>
    </Page>
  )
}
