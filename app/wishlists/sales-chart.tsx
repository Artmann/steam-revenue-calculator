import type { ReactElement } from 'react'

import { useState } from 'react'

import { formatCurrency, formatNumber } from '~/games'
import { periods, type PeriodEstimate } from './estimate-sales'
import { closestPeriod, type Launch } from './launches'

interface SalesChartProps {
  estimates: PeriodEstimate[]
  launches: Launch[]
  wishlists: number
}

const labels = ['Launch', 'Week 1', 'Month 1', 'Year 1']

// Horizontal spacing between launch dots that share a period, in pixels.
const dotSpacing = 11

type Active = { kind: 'period'; index: number } | { kind: 'launch'; name: string } | null

// The SVG stretches to fill the box, so lines and the band are drawn in a
// 0–100 space. Text, markers and dots are HTML on top so they keep their
// shape and stay readable at any width.
export function SalesChart({ estimates, launches, wishlists }: SalesChartProps): ReactElement {
  const [active, setActive] = useState<Active>(null)

  const low = [0, ...estimates.map(({ sales }) => sales.low)]
  const typical = [0, ...estimates.map(({ sales }) => sales.typical)]
  const high = [0, ...estimates.map(({ sales }) => sales.high)]

  // Each launch's sales-per-wishlist ratio applied to the reader's wishlists.
  const dots = launches.map((launch) => {
    const period = closestPeriod(launch)
    const ratio = launch.sales / launch.wishlists

    return {
      index: periods.indexOf(period) + 1,
      launch,
      ratio,
      value: Math.round(ratio * wishlists)
    }
  })

  const ticks = niceTicks(Math.max(...high, wishlists, ...dots.map(({ value }) => value)))
  const top = ticks[ticks.length - 1] || 1

  const x = (index: number) => (index / (labels.length - 1)) * 100
  const y = (value: number) => 100 - (value / top) * 100

  const toPoints = (values: number[]) => values.map((value, index) => `${x(index)},${y(value)}`)
  const points = (values: number[]) => toPoints(values).join(' ')

  // Trace the high line left to right, then the low line back.
  const band = [...toPoints(high), ...toPoints(low).reverse()].join(' ')

  // Spread dots in the same column so they do not sit on top of each other.
  const offsets = new Map<string, number>()

  for (let index = 1; index < labels.length; index++) {
    const column = dots.filter((dot) => dot.index === index)

    column.forEach((dot, position) => {
      offsets.set(dot.launch.name, (position - (column.length - 1) / 2) * dotSpacing)
    })
  }

  const activePeriod = active?.kind === 'period' ? active.index : null
  const activeDot = active?.kind === 'launch' ? dots.find((dot) => dot.launch.name === active.name) : undefined
  const last = estimates[estimates.length - 1]

  return (
    <figure className="flex flex-col gap-4">
      <div className="grid grid-cols-[3rem_1fr_5.5rem] sm:grid-cols-[3.5rem_1fr_7rem] gap-x-3">
        <div className="relative h-72 text-xs text-paper-dim tabular-nums">
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${y(tick)}%` }}
            >
              {formatCompact(tick)}
            </div>
          ))}
        </div>

        <div
          className="relative h-72"
          onMouseLeave={() => setActive(null)}
        >
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute inset-x-0 border-t border-rule"
              style={{ top: `${y(tick)}%` }}
            />
          ))}

          {activePeriod !== null ? (
            <div
              className="absolute inset-y-0 border-l border-rule-strong"
              style={{ left: `${x(activePeriod)}%` }}
            />
          ) : null}

          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <polygon
              fill="var(--accent)"
              fillOpacity="0.14"
              points={band}
            />
            {[low, high].map((values, index) => (
              <polyline
                key={index}
                fill="none"
                points={points(values)}
                stroke="var(--accent)"
                strokeOpacity="0.45"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <polyline
              fill="none"
              points={points(typical)}
              stroke="var(--accent)"
              strokeLinejoin="round"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {wishlists > 0 ? (
              <line
                stroke="var(--paper-muted)"
                strokeDasharray="4 4"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                x1="0"
                x2="100"
                y1={y(wishlists)}
                y2={y(wishlists)}
              />
            ) : null}
          </svg>

          {wishlists > 0 ? (
            <div
              className="absolute left-2 -translate-y-full pb-1 text-xs text-paper-muted"
              style={{ top: `${y(wishlists)}%` }}
            >
              Your wishlists ({formatNumber(wishlists)})
            </div>
          ) : null}

          {estimates.map((estimate, index) => (
            <button
              key={estimate.period}
              aria-label={`${labels[index + 1]}: typical ${formatNumber(estimate.sales.typical)} copies, range ${formatNumber(estimate.sales.low)} to ${formatNumber(estimate.sales.high)}`}
              className="absolute inset-y-0 -translate-x-1/2 cursor-crosshair focus:outline-hidden"
              onBlur={() => setActive(null)}
              onFocus={() => setActive({ kind: 'period', index: index + 1 })}
              onMouseEnter={() => setActive({ kind: 'period', index: index + 1 })}
              style={{ left: `${x(index + 1)}%`, width: `${100 / (labels.length - 1)}%` }}
              type="button"
            />
          ))}

          {typical.slice(1).map((value, index) => (
            <div
              key={index}
              className={`pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-ink transition-transform ${
                activePeriod === index + 1 ? 'scale-150' : ''
              }`}
              style={{ left: `${x(index + 1)}%`, top: `${y(value)}%` }}
            />
          ))}

          {dots.map((dot) => (
            <button
              key={dot.launch.name}
              aria-label={`${dot.launch.name}: ${dot.ratio.toFixed(2)} sales per wishlist`}
              className={`absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition focus:outline-hidden before:absolute before:-inset-2 before:content-[''] ${
                activeDot === dot ? 'scale-150 bg-paper' : 'bg-paper-muted/35 hover:bg-paper-muted'
              }`}
              onBlur={() => setActive(null)}
              onFocus={() => setActive({ kind: 'launch', name: dot.launch.name })}
              onMouseEnter={() => setActive({ kind: 'launch', name: dot.launch.name })}
              style={{
                left: `calc(${x(dot.index)}% + ${offsets.get(dot.launch.name) ?? 0}px)`,
                top: `${y(dot.value)}%`
              }}
              type="button"
            />
          ))}

          {activePeriod !== null ? (
            <PeriodTooltip
              estimate={estimates[activePeriod - 1]}
              label={labels[activePeriod]}
              left={x(activePeriod)}
            />
          ) : null}

          {activeDot ? (
            <Tooltip
              left={x(activeDot.index)}
              top={y(activeDot.value)}
            >
              <div className="font-display text-base text-paper">{activeDot.launch.name}</div>
              <div className="text-paper-muted">
                {activeDot.ratio.toFixed(2)} sales per wishlist ({activeDot.launch.period.toLowerCase()})
              </div>
              <div className="mt-1 figures text-paper">
                {formatNumber(activeDot.value)} copies at your wishlists
              </div>
            </Tooltip>
          ) : null}
        </div>

        <div className="relative h-72 text-xs tabular-nums">
          {spreadLabels([y(last.sales.high), y(last.sales.typical), y(last.sales.low)]).map((top, index) => {
            const key = (['high', 'typical', 'low'] as const)[index]

            return (
              <EndLabel
                key={key}
                emphasis={key === 'typical'}
                label={key === 'high' ? 'High' : key === 'typical' ? 'Typical' : 'Low'}
                top={top}
                value={last.sales[key]}
              />
            )
          })}
        </div>

        <div />
        <div className="relative mt-3 h-4 text-xs text-paper-muted">
          {labels.map((label, index) => (
            <div
              key={label}
              className={`absolute whitespace-nowrap ${
                index === 0 ? '' : index === labels.length - 1 ? '-translate-x-full' : '-translate-x-1/2'
              } ${activePeriod === index ? 'text-paper' : ''}`}
              style={{ left: `${x(index)}%` }}
            >
              {label}
            </div>
          ))}
        </div>
        <div />
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-6 gap-y-2 pl-[3.75rem] sm:pl-[4.25rem] text-sm text-paper-dim">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5 bg-accent" />
          Typical
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 bg-accent/20" />
          Low to high
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-1.5 rounded-full bg-paper-muted/50" />
          A real launch, scaled to your wishlists
        </span>
        <span>Copies sold since launch. Hover a period or a dot for details.</span>
      </figcaption>
    </figure>
  )
}

function EndLabel({
  emphasis = false,
  label,
  top,
  value
}: {
  emphasis?: boolean
  label: string
  top: number
  value: number
}): ReactElement {
  return (
    <div
      className={`absolute left-0 -translate-y-1/2 whitespace-nowrap ${emphasis ? 'text-paper' : 'text-paper-muted'}`}
      style={{ top: `${top}%` }}
    >
      <span className={emphasis ? 'font-medium' : ''}>{formatCompact(value)}</span>{' '}
      <span className="text-paper-dim">{label}</span>
    </div>
  )
}

function PeriodTooltip({
  estimate,
  label,
  left
}: {
  estimate: PeriodEstimate
  label: string
  left: number
}): ReactElement {
  return (
    <Tooltip
      left={left}
      top={0}
    >
      <div className="eyebrow mb-2">{label}</div>
      <div className="grid grid-cols-[auto_auto_auto] gap-x-4 gap-y-1 figures">
        <span className="text-paper-dim">High</span>
        <span className="text-right">{formatNumber(estimate.sales.high)}</span>
        <span className="text-right text-paper-muted">{formatCurrency(estimate.netRevenue.high, true)}</span>
        <span className="text-paper">Typical</span>
        <span className="text-right text-accent">{formatNumber(estimate.sales.typical)}</span>
        <span className="text-right text-accent">{formatCurrency(estimate.netRevenue.typical, true)}</span>
        <span className="text-paper-dim">Low</span>
        <span className="text-right">{formatNumber(estimate.sales.low)}</span>
        <span className="text-right text-paper-muted">{formatCurrency(estimate.netRevenue.low, true)}</span>
      </div>
    </Tooltip>
  )
}

// Flips to the left of the anchor in the right half so it stays inside the chart.
function Tooltip({
  children,
  left,
  top
}: {
  children: ReactElement | ReactElement[]
  left: number
  top: number
}): ReactElement {
  const flip = left > 50

  return (
    <div
      className={`pointer-events-none absolute z-10 w-max max-w-64 border border-rule-strong bg-ink px-3 py-2.5 text-sm shadow-lg ${
        flip ? '-translate-x-full -ml-3' : 'ml-3'
      }`}
      style={{ left: `${left}%`, top: `${Math.min(top, 70)}%` }}
    >
      {children}
    </div>
  )
}

// Pushes label positions (percent from the top, already sorted top to bottom)
// apart so they are at least `gap` apart, keeping them inside 0–100.
export function spreadLabels(tops: number[], gap = 6): number[] {
  const spread = [...tops]

  for (let index = 1; index < spread.length; index++) {
    spread[index] = Math.max(spread[index], spread[index - 1] + gap)
  }

  const overflow = spread[spread.length - 1] - 100

  if (overflow > 0) {
    for (let index = spread.length - 1; index >= 0; index--) {
      spread[index] = Math.min(spread[index] - overflow, index === spread.length - 1 ? 100 : spread[index + 1] - gap)
    }
  }

  return spread
}

export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) {
    return [0, 1]
  }

  const rough = max / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude

  const ticks: number[] = []

  for (let tick = 0; tick < max + step; tick += step) {
    ticks.push(tick)
  }

  return ticks
}

const compactFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  notation: 'compact'
})

function formatCompact(value: number): string {
  return compactFormat.format(value)
}
