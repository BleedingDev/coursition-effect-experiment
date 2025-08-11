import { Effect } from 'effect'
import { JobsStore } from '../../stores/jobs/jobs.store'

export const getJobResultUsecase = (jobId: string) =>
  Effect.gen(function* () {
    const jobsStore = yield* JobsStore
    const result = yield* jobsStore.getJobResult(jobId)
    return result
  }).pipe(
    Effect.tapError(Effect.logError),
    // Let JobResultNotFoundError bubble up for client handling
    Effect.withSpan('getJobResultUsecase', {
      attributes: { jobId },
    }),
  )
