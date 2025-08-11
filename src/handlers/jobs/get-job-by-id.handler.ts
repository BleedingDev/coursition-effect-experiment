import { Effect } from 'effect'
import { JobNotFound } from '../../domain/jobs/jobs.errors'
import { getJobByIdUsecase } from '../../usecases/jobs/get-job-by-id.usecase'

export const getJobByIdHandler = (id: string) =>
  Effect.gen(function* () {
    const result = yield* getJobByIdUsecase(id)
    return result
  }).pipe(
    Effect.catchTags({
      // Map internal errors to API errors
      JobNotFoundError: () => new JobNotFound(),
    }),
    Effect.tapError(Effect.logError),
    Effect.withSpan('getJobByIdHandler', { attributes: { jobId: id } }),
  )
