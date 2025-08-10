import { Effect as E } from 'effect'
import { JobsStore } from '../../stores/jobs/jobs.store'

export const getJobByIdUsecase = (id: string) =>
  E.gen(function* () {
    const jobsStore = yield* JobsStore
    const result = yield* jobsStore.getJobById(id)
    return result
  }).pipe(
    E.tapError(E.logError),
    // Let JobNotFoundError bubble up for client handling
    E.withSpan('getJobByIdUsecase', {
      attributes: { jobId: id },
    }),
  )
