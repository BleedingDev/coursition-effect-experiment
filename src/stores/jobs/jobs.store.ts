import { Effect as E, Layer } from 'effect'
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

export class JobsStore extends E.Service<JobsStore>()('JobsStore', {
  effect: E.gen(function* () {
    const tableName = yield* envVars.JOBS_TABLE

    return {
      getAllJobs: () =>
        E.succeed(
          JobsResponse.make({
            jobs: [
              { id: '1', name: 'Parse Video 1', status: 'completed' },
              { id: '2', name: 'Parse Audio 2', status: 'in-progress' },
              { id: '3', name: 'Parse Document 3', status: 'pending' },
            ],
          }),
        ).pipe(
          E.withSpan('JobsStore.getAllJobs', {
            attributes: { tableName },
          }),
        ),

      getJobById: (id: string) =>
        E.gen(function* () {
          // Mock implementation - replace with real database lookup
          if (id === '999') {
            return yield* E.fail(new JobNotFoundError({ id }))
          }

          return JobResponse.make({
            id,
            name: `Job ${id}`,
            status: 'in-progress',
          })
        }).pipe(
          E.withSpan('JobsStore.getJobById', {
            attributes: { id, tableName },
          }),
        ),

      getJobResult: (jobId: string) =>
        E.gen(function* () {
          const jobsStore = yield* JobsStore
          const job = yield* jobsStore.getJobById(jobId)

          // Check if job has results
          if (job.status !== 'completed') {
            return yield* E.fail(new JobResultNotFoundError({ jobId }))
          }

          return JobResultResponse.make({
            id: jobId,
            result: `Result for job ${jobId}`,
          })
        }).pipe(
          E.withSpan('JobsStore.getJobResult', {
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
      getAllJobs: () => E.die('Not implemented' as const),
      getJobById: () => E.die('Not implemented' as const),
      getJobResult: () => E.die('Not implemented' as const),
      ...mockImplementation,
    })
}
