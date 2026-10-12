const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
})

export function formatCompactCurrency(amount: number): string {
  return compactCurrency.format(Math.round(amount))
}

export function formatPercent(share: number): string {
  if (share > 0 && share < 0.01) {
    return '<1%'
  }

  return `${Math.round(share * 100)}%`
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  })
}
