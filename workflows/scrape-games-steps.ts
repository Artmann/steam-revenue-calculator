import { FatalError } from 'workflow'

import { computeAndSaveStats } from '~/market/compute-and-save-stats.server'
import { listAppIds } from '~/scrape/list-app-ids'
import { markDelisted } from '~/scrape/mark-delisted'
import {
  collectFailedIds,
  finishRun,
  recordChunk,
  startRun,
  summariseRetry,
  updateRun,
  type ChunkField,
  type ScrapeTrigger
} from '~/scrape/run-record'
import { scrapeIds } from '~/scrape/scrape-ids'
import { syncTags } from '~/scrape/sync-tags'

function steamApiKey(): string {
  // A pasted key often carries a trailing newline, which Steam rejects with 403.
  const apiKey = process.env.STEAM_API_KEY?.trim()

  if (!apiKey) {
    // Retrying cannot fix missing configuration.
    throw new FatalError('STEAM_API_KEY is not configured.')
  }

  return apiKey
}

export async function startRunStep(
  runId: string,
  trigger: ScrapeTrigger,
  startedAt: number
): Promise<void> {
  'use step'

  await startRun(runId, trigger, startedAt)
}

export async function syncTagsStep(): Promise<number> {
  'use step'

  return syncTags()
}

export async function listAppIdsStep(
  runId: string,
  runStartedAt: number
): Promise<number[]> {
  'use step'

  const appIds = await listAppIds(steamApiKey(), runStartedAt)

  await updateRun(runId, { listed: appIds.length })

  return appIds
}

export async function scrapeChunkStep(
  runId: string,
  field: ChunkField,
  index: number,
  appIds: number[],
  runStartedAt: number
): Promise<void> {
  'use step'

  await recordChunk(runId, field, index, await scrapeIds(appIds, runStartedAt))
}

export async function recordChunkFailureStep(
  runId: string,
  field: ChunkField,
  index: number,
  appIds: number[]
): Promise<void> {
  'use step'

  await recordChunk(runId, field, index, { saved: 0, failedIds: appIds })
}

export async function collectFailedIdsStep(
  runId: string,
  field: ChunkField
): Promise<number[]> {
  'use step'

  return collectFailedIds(runId, field)
}

export async function summariseRetryStep(
  runId: string,
  attempted: number
): Promise<void> {
  'use step'

  await summariseRetry(runId, attempted)
}

export async function markDelistedStep(
  runId: string,
  runStartedAt: number,
  listed: number
): Promise<void> {
  'use step'

  await updateRun(runId, { delisted: await markDelisted(runStartedAt, listed) })
}

export async function computeStatsStep(runId: string): Promise<void> {
  'use step'

  await updateRun(runId, { stats: await computeAndSaveStats() })
}

export async function finishRunStep(
  runId: string,
  status: 'succeeded' | 'failed',
  error?: string
): Promise<void> {
  'use step'

  await finishRun(runId, status, error)
}
