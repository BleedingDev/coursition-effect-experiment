import { Schema } from 'effect'

export const JobResponse = Schema.Struct({
  id: Schema.UUID,
  name: Schema.String,
  status: Schema.String,
})

export const JobsResponse = Schema.Struct({
  jobs: Schema.Array(
    Schema.Struct({
      id: Schema.UUID,
      name: Schema.String,
      status: Schema.String,
    }),
  ),
})

export const JobResultResponse = Schema.Struct({
  id: Schema.UUID,
  result: Schema.String,
})
