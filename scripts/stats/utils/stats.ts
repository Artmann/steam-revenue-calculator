export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  let sum = 0
  for (const value of values) {
    sum += value
  }
  return sum / values.length
}

export function median(values: number[]): number {
  return quantile(values, 0.5)
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sorted[base + 1]
  if (next === undefined) {
    return sorted[base]
  }
  return sorted[base] + rest * (next - sorted[base])
}

export interface ShareAbove {
  thousand: number
  tenThousand: number
  hundredThousand: number
  million: number
}

// Same thresholds as the tag pages' "How revenue is spread" section.
export function shareAbove(values: number[]): ShareAbove {
  const share = (threshold: number): number =>
    values.length === 0
      ? 0
      : values.filter((value) => value >= threshold).length / values.length

  return {
    thousand: share(1_000),
    tenThousand: share(10_000),
    hundredThousand: share(100_000),
    million: share(1_000_000)
  }
}

export interface Summary {
  count: number
  mean: number
  median: number
  p25: number
  p75: number
  p95: number
  min: number
  max: number
}

export function summarize(values: number[]): Summary {
  if (values.length === 0) {
    return { count: 0, mean: 0, median: 0, p25: 0, p75: 0, p95: 0, min: 0, max: 0 }
  }
  const sorted = [...values].sort((a, b) => a - b)
  return {
    count: values.length,
    mean: mean(values),
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    p95: quantile(sorted, 0.95),
    min: sorted[0],
    max: sorted[sorted.length - 1]
  }
}
