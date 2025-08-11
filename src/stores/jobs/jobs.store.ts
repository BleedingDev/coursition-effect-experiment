import { Effect, Layer } from 'effect'
import { envVars } from '../../config'
import {
  JobNotFoundError,
  JobResultNotFoundError,
} from '../../domain/jobs/jobs.errors'
import {
  JobResponse,
  JobResultResponse,
  JobsResponse,
} from '../../domain/jobs/jobs.schema'

export class JobsStore extends Effect.Service<JobsStore>()('JobsStore', {
  effect: Effect.gen(function* () {
    const tableName = yield* envVars.JOBS_TABLE

    return {
      getAllJobs: () =>
        Effect.succeed(
          JobsResponse.make({
            jobs: [
              {
                id: '09467777-7801-40ed-b683-5a9ae8ae3141',
                name: 'Parse Video 1',
                status: 'completed',
              },
              {
                id: '25b26ec4-6ece-4b85-9aea-50cf98b06058',
                name: 'Parse Audio 2',
                status: 'running',
              },
              {
                id: 'ecb1e4b4-1854-4d89-b354-16717f38cc08',
                name: 'Parse Document 3',
                status: 'pending',
              },
            ],
          }),
        ).pipe(
          Effect.withSpan('JobsStore.getAllJobs', {
            attributes: { tableName },
          }),
        ),

      getJobById: (id: string) =>
        Effect.gen(function* () {
          // Mock implementation - replace with real database lookup
          if (id === '0bb4870a-09a9-4adc-8e86-0a024075756d') {
            return yield* Effect.fail(new JobNotFoundError({ jobId: id }))
          }

          return JobResponse.make({
            id,
            name: `Job ${id}`,
            status: 'running',
          })
        }).pipe(
          Effect.withSpan('JobsStore.getJobById', {
            attributes: { id, tableName },
          }),
        ),

      getJobResult: (jobId: string) =>
        Effect.gen(function* () {
          const jobsStore = yield* JobsStore
          const job = yield* jobsStore.getJobById(jobId)

          // Check if job has results
          if (job.status !== 'completed') {
            return yield* Effect.fail(new JobResultNotFoundError({ jobId }))
          }

          return JobResultResponse.make({
            id: jobId,
            result: `Result for job ${jobId}`,
          })
        }).pipe(
          Effect.withSpan('JobsStore.getJobResult', {
            attributes: { jobId, tableName },
          }),
        ),
    }
  }),
}) {
  static makeTestService = (
    mockImplementation: Partial<Omit<JobsStore, '_tag'>>,
  ) =>
    Layer.succeed(JobsStore, {
      _tag: 'JobsStore',
      getAllJobs: () => Effect.die('Not implemented' as const),
      getJobById: () => Effect.die('Not implemented' as const),
      getJobResult: () => Effect.die('Not implemented' as const),
      ...mockImplementation,
    })
}
