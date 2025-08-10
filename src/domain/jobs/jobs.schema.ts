import { Schema } from 'effect'

// * Taken from Restate Docs - https://docs.restate.dev/operate/introspection/?interface=curl#retrieving-the-status-of-an-invocation
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
