import { Effect as E } from 'effect'
import { JobNotFound } from '../../domain/jobs/jobs.errors'
import { getJobByIdUsecase } from '../../usecases/jobs/get-job-by-id.usecase'

export const getJobByIdHandler = (id: string) =>
  E.gen(function* () {
    const result = yield* getJobByIdUsecase(id)
    return result
  }).pipe(
    E.catchTags({
      // Map internal errors to API errors
      JobNotFoundError: () => new JobNotFound(),
    }),
    E.tapError(E.logError),
    E.withSpan('getJobByIdHandler', { attributes: { jobId: id } }),
  )
