import { Data, Schema } from 'effect'

export class WorkflowError extends Schema.TaggedError<WorkflowError>()(
  'WorkflowError',
  {},
) {}

export class WorkflowConnectionError extends Data.TaggedError(
  'WorkflowConnectionError',
)<{
  readonly processId: string
  readonly cause: unknown
}> {}

export class WorkflowCreationError extends Data.TaggedError(
  'WorkflowCreationError',
)<{
  readonly processId: string
  readonly cause: unknown
}> {}
