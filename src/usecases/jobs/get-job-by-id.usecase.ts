import { Effect } from 'effect'
import { JobsStore } from '../../stores/jobs/jobs.store'

export const getJobByIdUsecase = (id: string) =>
  Effect.gen(function* () {
    const jobsStore = yield* JobsStore
    const result = yield* jobsStore.getJobById(id)
    return result
  }).pipe(
    Effect.tapError(Effect.logError),
    // Let JobNotFoundError bubble up for client handling
    Effect.withSpan('getJobByIdUsecase', {
      attributes: { jobId: id },
    }),
  )
