import { Effect } from 'effect'
import { JobsStore } from '../../stores/jobs/jobs.store'

export const getJobsUsecase = () =>
  Effect.gen(function* () {
    const jobsStore = yield* JobsStore
    const result = yield* jobsStore.getAllJobs()
    return result
  }).pipe(
    Effect.tapError(Effect.logError),
    Effect.orDie, // No expected domain errors for listing
    Effect.withSpan('getJobsUsecase'),
  )
