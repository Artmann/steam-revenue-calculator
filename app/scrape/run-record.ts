import type { Collection } from 'mongodb'

import { getCollection } from '~/db'

export type ScrapeTrigger = 'cron' | 'manual'
export type ScrapeRunStatus = 'running' | 'succeeded' | 'failed'
export type ChunkField = 'chunks' | 'retryChunks'

export interface ChunkResult {
  saved: number
  failedIds: number[]
}

export type DelistedResult =
  | { count: number }
  | { skipped: true; listed: number; active: number }

export interface RetrySummary {
  attempted: number
  saved: number
  stillFailed: number[]
}

export interface StatsSummary {
  games: number
  tags: number
  tagsWithStats: number
}

export interface ScrapeRunDocument {
  _id: string
  trigger: ScrapeTrigger
  status: ScrapeRunStatus
  startedAt: Date
  finishedAt?: Date
  listed?: number
  chunks?: Record<string, ChunkResult>
  retryChunks?: Record<string, ChunkResult>
  retry?: RetrySummary
  delisted?: DelistedResult
  stats?: StatsSummary
  error?: string
}

async function scrapeRuns(): Promise<Collection<ScrapeRunDocument>> {
  return (await getCollection(
    'scrapeRuns'
  )) as unknown as Collection<ScrapeRunDocument>
}

export async function findRun(runId: string): Promise<ScrapeRunDocument | null> {
  const collection = await scrapeRuns()

  return collection.findOne({ _id: runId })
}

export async function startRun(
  runId: string,
  trigger: ScrapeTrigger,
  startedAt: number
): Promise<void> {
  const collection = await scrapeRuns()

  // $setOnInsert keeps a retried step from resetting a run that has moved on.
  await collection.updateOne(
    { _id: runId },
    {
      $setOnInsert: {
        trigger,
        status: 'running',
        startedAt: new Date(startedAt)
      }
    },
    { upsert: true }
  )
}

export async function updateRun(
  runId: string,
  fields: Partial<
    Pick<ScrapeRunDocument, 'listed' | 'retry' | 'delisted' | 'stats'>
  >
): Promise<void> {
  const collection = await scrapeRuns()

  await collection.updateOne({ _id: runId }, { $set: fields })
}

export async function recordChunk(
  runId: string,
  field: ChunkField,
  index: number,
  result: ChunkResult
): Promise<void> {
  const collection = await scrapeRuns()

  // Keyed by index, so a retried step overwrites its result instead of adding to it.
  await collection.updateOne(
    { _id: runId },
    { $set: { [`${field}.${index}`]: result } }
  )
}

function chunkResults(
  run: ScrapeRunDocument | null,
  field: ChunkField
): ChunkResult[] {
  return Object.values(run?.[field] ?? {})
}

function uniqueSorted(ids: number[]): number[] {
  return [...new Set(ids)].sort((a, b) => a - b)
}

export async function collectFailedIds(
  runId: string,
  field: ChunkField
): Promise<number[]> {
  const results = chunkResults(await findRun(runId), field)

  return uniqueSorted(results.flatMap(({ failedIds }) => failedIds))
}

export async function summariseRetry(
  runId: string,
  attempted: number
): Promise<RetrySummary> {
  const results = chunkResults(await findRun(runId), 'retryChunks')

  const retry: RetrySummary = {
    attempted,
    saved: results.reduce((total, { saved }) => total + saved, 0),
    stillFailed: uniqueSorted(results.flatMap(({ failedIds }) => failedIds))
  }

  await updateRun(runId, { retry })

  return retry
}

export async function finishRun(
  runId: string,
  status: 'succeeded' | 'failed',
  error?: string
): Promise<void> {
  const collection = await scrapeRuns()

  await collection.updateOne(
    { _id: runId },
    {
      $set: {
        status,
        finishedAt: new Date(),
        ...(error === undefined ? {} : { error })
      }
    }
  )
}
