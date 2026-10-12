import { createHook, getWorkflowMetadata } from 'workflow'

import type { ScrapeTrigger } from '~/scrape/run-record'

import { finishRunStep, startRunStep } from './scrape-games-steps'

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
