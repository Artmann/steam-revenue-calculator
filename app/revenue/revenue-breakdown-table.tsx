import type { ReactElement } from 'react'

import type { RevenueBreakdown } from './calculate-revenue'
import { formatCurrency } from '~/games'

interface RevenueBreakdownTableProps {
  breakdown: RevenueBreakdown
}

export function RevenueBreakdownTable({
  breakdown
}: RevenueBreakdownTableProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-4 w-full min-w-[18rem]">
      <div className="text-center flex flex-col gap-3">
        <div
          className="font-bold font-poppins text-4xl"
          data-testid="gross-revenue"
        >
          {formatCurrency(breakdown.grossRevenue, true)}
        </div>
        <div className="uppercase text-sm">Gross Revenue</div>
      </div>
      <div className="w-full">
        <div className="flex items-center gap-6 w-full border-b border-dashed border-slate-100 text-xs py-2">
          <div className="uppercase flex-1">Adj. Regional Pricing</div>
          <div data-testid="adjusted-regional-pricing">
            {formatCurrency(breakdown.adjustedRegionalPricing)}
          </div>
        </div>
        <div className="flex items-center gap-6 w-full border-b border-dashed border-slate-100 text-xs py-2">
          <div className="uppercase flex-1">Discounts</div>
          <div data-testid="discounts">
            {formatCurrency(breakdown.discounts)}
          </div>
        </div>
        <div className="flex items-center gap-6 w-full border-b border-dashed border-slate-100 text-xs py-2">
          <div className="uppercase flex-1">Refunds</div>
          <div data-testid="refunds">{formatCurrency(breakdown.refunds)}</div>
        </div>
        <div className="flex items-center gap-6 w-full border-b border-dashed border-slate-100 text-xs py-2">
          <div className="uppercase flex-1">Steam Cut</div>
          <div data-testid="steam-fee">
            {formatCurrency(breakdown.steamFee)}
          </div>
        </div>
        <div className="flex items-center gap-6 w-full border-b border-dashed border-slate-100 text-xs py-2">
          <div className="uppercase flex-1">VAT / Sales Tax</div>
          <div data-testid="vat">{formatCurrency(breakdown.vat)}</div>
        </div>
        <div className="flex text-sm items-center gap-6 w-full border-b border-dashed border-slate-100 py-2 font-bold">
          <div className="uppercase flex-1">Net Revenue</div>
          <div data-testid="net-revenue">
            {formatCurrency(breakdown.netRevenue)}
          </div>
        </div>
      </div>
    </div>
  )
}
