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

  return (
    <div
      className="space-y-2"
      data-testid={testId}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[6.5rem_1fr_7rem] gap-4 items-center text-sm"
        >
          <div className="text-paper-muted tabular-nums">{row.label}</div>
          <div className="h-3 bg-rule/40">
            <div
              className="h-full bg-accent"
              style={{ width: max > 0 ? `${(row.value / max) * 100}%` : '0%' }}
            />
          </div>
          <div className="text-right tabular-nums">
            {row.display}
            {row.note && <span className="text-paper-dim ml-2">{row.note}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
