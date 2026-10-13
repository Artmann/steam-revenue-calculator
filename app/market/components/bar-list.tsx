import type { ReactElement } from 'react'

export interface BarListRow {
  label: string
  value: number
  display: string
  note?: string
}

export function BarList({
  rows,
  testId
}: {
  rows: BarListRow[]
  testId?: string
}): ReactElement {
  const max = Math.max(0, ...rows.map(({ value }) => value))
  const hasNotes = rows.some(({ note }) => note)

  return (
    <div
      className="divide-y divide-rule/60"
      data-testid={testId}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className={`grid ${
            hasNotes
              ? 'grid-cols-[4.5rem_1fr_4.5rem] sm:grid-cols-[6.5rem_1fr_5rem_6rem]'
              : 'grid-cols-[4.5rem_1fr_4.5rem] sm:grid-cols-[6.5rem_1fr_5rem]'
          } items-center gap-x-4 py-1.5 text-sm`}
        >
          <div className="truncate text-paper-muted tabular-nums">
            {row.label}
          </div>
          <div className="h-2 rounded-full bg-rule/60">
            <div
              className="h-full rounded-full bg-accent"
              style={{
                // Keep non-zero values visible as a sliver instead of vanishing
                width:
                  max > 0 && row.value > 0
                    ? `max(${(row.value / max) * 100}%, 3px)`
                    : '0%'
              }}
            />
          </div>
          <div className="whitespace-nowrap text-right tabular-nums">
            {row.display}
          </div>
          {hasNotes && (
            <div className="hidden whitespace-nowrap text-right text-paper-dim tabular-nums sm:block">
              {row.note}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
