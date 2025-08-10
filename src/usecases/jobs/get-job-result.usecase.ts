import { Effect as E } from 'effect'
import { JobsStore } from '../../stores/jobs/jobs.store'

export const getJobResultUsecase = (jobId: string) =>
  E.gen(function* () {
    const jobsStore = yield* JobsStore
    const result = yield* jobsStore.getJobResult(jobId)
    return result
  }).pipe(
    E.tapError(E.logError),
    // Let JobResultNotFoundError bubble up for client handling
    E.withSpan('getJobResultUsecase', {
      attributes: { jobId },
    }),
  )
