import { Data, Schema } from 'effect'

// API boundary errors (for HttpApi serialization)
export class JobResultNotFound extends Schema.TaggedError<JobResultNotFound>()(
  'JobResultNotFound',
  {},
) {}

export class JobNotFound extends Schema.TaggedError<JobNotFound>()(
  'JobNotFound',
  {},
) {}

// Internal domain errors (for business logic)
export class JobProcessingError extends Data.TaggedError('JobProcessingError')<{
  readonly jobId: number
  readonly reason: string
}> {}

export class JobNotFoundError extends Data.TaggedError('JobNotFoundError')<{
  readonly id: number
}> {}

export class JobResultNotFoundError extends Data.TaggedError(
  'JobResultNotFoundError',
)<{
  readonly jobId: number
}> {}
