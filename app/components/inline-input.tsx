import type { ReactElement } from 'react'

import { Input } from '~/components/ui/input'

export function InlineInput({
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
}): ReactElement {
  return (
    <span className="whitespace-nowrap inline-flex items-baseline">
      <label
        htmlFor={id}
        className="sr-only"
      >
        {label}
      </label>
      {prefix ? <span className="text-paper-muted">{prefix}</span> : null}
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width }}
        className="inline-block py-0 border-dashed text-accent font-sans font-medium tabular-nums lining-nums slashed-zero tracking-tight px-1 mx-0.5 focus:border-solid"
      />
      {suffix ? <span className="text-paper-muted">{suffix}</span> : null}
    </span>
  )
}
