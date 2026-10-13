import { mkdir, writeFile } from 'fs/promises'
import { dirname, resolve } from 'path'

import type { StatsQuery } from './registry'

const OUTPUT_DIR = resolve(process.cwd(), 'data', 'stats')

export async function runQuery(query: StatsQuery): Promise<string> {
  const startedAt = Date.now()
  console.log(`→ ${query.name}`)

  const data = await query.run()

  const payload = {
    query: query.name,
    description: query.description,
    generatedAt: new Date().toISOString(),
    data
  }

  const outputPath = resolve(OUTPUT_DIR, `${query.name}.json`)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8')

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`  wrote ${outputPath} (${duration}s)`)

  return outputPath
}
