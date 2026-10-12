export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`Chunk size must be a positive integer, got ${size}.`)
  }

  const chunks: T[][] = []

  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size))
  }

  return chunks
}
