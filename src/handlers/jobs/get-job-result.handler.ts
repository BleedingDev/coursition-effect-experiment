import { Effect as E } from 'effect'
import { JobNotFound, JobResultNotFound } from '../../domain/jobs/jobs.errors'
import { getJobResultUsecase } from '../../usecases/jobs/get-job-result.usecase'

export const getJobResultHandler = (jobId: string) =>
  E.gen(function* () {
    const result = yield* getJobResultUsecase(jobId)
    return result
  }).pipe(
    E.catchTags({
      // Map internal errors to API errors
      JobNotFoundError: () => new JobNotFound(),
      JobResultNotFoundError: () => new JobResultNotFound(),
    }),
    E.tapError(E.logError),
    E.withSpan('getJobResultHandler', { attributes: { jobId } }),
  )
