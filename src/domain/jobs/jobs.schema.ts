import { Schema } from 'effect'

/**
 * Job status enum
 * pending: enqueued waiting for its turn
ready: ready to be processed, but not yet running
running: actively processing
backing-off: retrying due to a failure
suspended: waiting on some external input (e.g. request-response call, awakeable, sleep, ...)
completed: completed (this is shown only for idempotent invocations)
 */
const JobStatus = Schema.Literal(
  'pending',
  'ready',
  'running',
  'backing-off',
  'suspended',
  'completed',
)

export const JobResponse = Schema.Struct({
  id: Schema.UUID,
  name: Schema.String,
  status: JobStatus,
})

export const JobsResponse = Schema.Struct({
  jobs: Schema.Array(
    Schema.Struct({
      id: Schema.UUID,
      name: Schema.String,
      status: JobStatus,
    }),
  ),
})

export const JobResultResponse = Schema.Struct({
  id: Schema.UUID,
  result: Schema.String,
})
