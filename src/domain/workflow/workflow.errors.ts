import { Schema } from 'effect'

export class WorkflowError extends Schema.TaggedError<WorkflowError>()(
  'WorkflowError',
  {},
) {}
