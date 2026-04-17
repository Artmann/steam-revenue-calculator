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
    <div className="flex flex-col gap-6 w-full min-w-[18rem] max-w-sm">
      <div className="flex flex-col gap-2">
        <div className="eyebrow">Estimated gross revenue</div>
        <div
          className="figures-display"
          data-testid="gross-revenue"
        >
          {formatCurrency(breakdown.grossRevenue, true)}
        </div>
      </div>
      <div className="w-full border-t border-rule-strong">
        <Row
          label="Adj. Regional Pricing"
          value={formatCurrency(breakdown.adjustedRegionalPricing)}
          testId="adjusted-regional-pricing"
        />
        <Row
          label="Discounts"
          value={formatCurrency(breakdown.discounts)}
          testId="discounts"
        />
        <Row
          label="Refunds"
          value={formatCurrency(breakdown.refunds)}
          testId="refunds"
        />
        <Row
          label="Steam cut"
          value={formatCurrency(breakdown.steamFee)}
          testId="steam-fee"
        />
        <Row
          label="VAT / Sales tax"
          value={formatCurrency(breakdown.vat)}
          testId="vat"
        />
        <div className="flex items-baseline gap-6 w-full border-t border-rule-strong pt-3 mt-1 text-accent">
          <div className="flex-1 font-display text-lg">Net revenue</div>
          <div
            className="figures text-lg font-display"
            data-testid="net-revenue"
          >
            {formatCurrency(breakdown.netRevenue)}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  testId
}: {
  label: string
  value: string
  testId: string
}): ReactElement {
  return (
    <div className="flex items-baseline gap-6 w-full border-b border-rule py-2.5 text-sm">
      <div className="flex-1 text-paper-muted">{label}</div>
      <div
        className="figures tabular-nums"
        data-testid={testId}
      >
        {value}
      </div>
    </div>
  )
}
