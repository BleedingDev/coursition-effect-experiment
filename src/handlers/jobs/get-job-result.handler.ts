import { Effect } from 'effect'
import { JobNotFound, JobResultNotFound } from '../../domain/jobs/jobs.errors'
import { getJobResultUsecase } from '../../usecases/jobs/get-job-result.usecase'

export const getJobResultHandler = (jobId: string) =>
  Effect.gen(function* () {
    const result = yield* getJobResultUsecase(jobId)
    return result
  }).pipe(
    Effect.catchTags({
      // Map internal errors to API errors
      JobNotFoundError: () => new JobNotFound(),
      JobResultNotFoundError: () => new JobResultNotFound(),
    }),
    Effect.tapError(Effect.logError),
    Effect.withSpan('getJobResultHandler', { attributes: { jobId } }),
  )
