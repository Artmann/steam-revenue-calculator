import type { ReactElement, ReactNode } from 'react'

import { Input } from '~/components/ui/input'

// A calculator value shown inside running text. The value is edited with a
// CalculatorField below the text.
export function Figure({ children }: { children: ReactNode }): ReactElement {
  return (
    <span className="whitespace-nowrap text-accent font-sans font-medium tabular-nums lining-nums slashed-zero tracking-tight">
      {children}
    </span>
  )
}

export function CalculatorField({
  id,
  label,
  value,
  onChange,
  inputMode
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  inputMode: 'numeric' | 'decimal'
}): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="eyebrow"
      >
        {label}
      </label>
      <Input
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-lg font-sans tabular-nums lining-nums"
      />
    </div>
  )
}
