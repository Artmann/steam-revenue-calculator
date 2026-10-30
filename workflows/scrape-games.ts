import { createHook, getWorkflowMetadata } from 'workflow'

import { chunk } from '~/scrape/chunk'
import type { ChunkField, ScrapeTrigger } from '~/scrape/run-record'

import {
  collectFailedIdsStep,
  computeStatsStep,
  ensureIndexesStep,
  finishRunStep,
  listAppIdsStep,
  markDelistedStep,
  recordChunkFailureStep,
  scrapeChunkStep,
  startRunStep,
  summariseRetryStep,
  syncTagsStep
} from './scrape-games-steps'

// Six GetItems batches of 700 ids.
const chunkSize = 4200

export type ScrapeGamesResult =
  | { skipped: true; activeRunId: string }
  | { skipped: false; runId: string }

export async function scrapeGames(input: {
  trigger: ScrapeTrigger
}): Promise<ScrapeGamesResult> {
  'use workflow'

  // A fixed token makes a second run exit before it touches Steam or Mongo.
  // The runtime releases the token when this run ends.
  const hook = createHook({ token: 'scrape-games' })
  const conflict = await hook.getConflict()

  if (conflict) {
    return { skipped: true, activeRunId: conflict.runId }
  }

  const { workflowRunId: runId } = getWorkflowMetadata()
  const runStartedAt = Date.now()

  try {
    await startRunStep(runId, input.trigger, runStartedAt)
    await ensureIndexesStep()
    await syncTagsStep()

    const appIds = await listAppIdsStep(runId, runStartedAt)

    await scrapeInChunks(runId, 'chunks', appIds, runStartedAt)

    const failedIds = await collectFailedIdsStep(runId, 'chunks')

    if (failedIds.length > 0) {
      await scrapeInChunks(runId, 'retryChunks', failedIds, runStartedAt)
      await summariseRetryStep(runId, failedIds.length)
    }

    await markDelistedStep(runId, runStartedAt, appIds.length)
    await computeStatsStep(runId)
    await finishRunStep(runId, 'succeeded')

    return { skipped: false, runId }
  } catch (error) {
    await finishRunStep(
      runId,
      'failed',
      error instanceof Error ? error.message : String(error)
    )

    throw error
  }
}

async function scrapeInChunks(
  runId: string,
  field: ChunkField,
  appIds: number[],
  runStartedAt: number
): Promise<void> {
  const chunks = chunk(appIds, chunkSize)

  for (let index = 0; index < chunks.length; index++) {
    try {
      // Sequential on purpose: chunks share Steam's rate limit, and running
      // them one at a time is what keeps the scrape under it.
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await scrapeChunkStep(runId, field, index, chunks[index], runStartedAt)
    } catch {
      // The step has used up its retries. Record its ids and keep going, so
      // one bad chunk never costs the rest of the catalog.
      await recordChunkFailureStep(runId, field, index, chunks[index])
    }
  }
}
