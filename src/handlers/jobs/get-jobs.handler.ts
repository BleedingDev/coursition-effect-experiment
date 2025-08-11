import { Effect } from 'effect'
import { getJobsUsecase } from '../../usecases/jobs/get-jobs.usecase'

export const getJobsHandler = () =>
  Effect.gen(function* () {
    const result = yield* getJobsUsecase()
    return result
  }).pipe(Effect.tapError(Effect.logError), Effect.withSpan('getJobsHandler'))
