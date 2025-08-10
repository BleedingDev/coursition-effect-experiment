import type {
  ServiceDefinition,
  WorkflowContext,
} from '@restatedev/restate-sdk'
import { Schema } from 'effect'

export const StartProcessResponse = Schema.Struct({
  processId: Schema.UUID,
  response: Schema.Unknown,
})

export const WorkflowDefinitionSchema = Schema.declare<
  ServiceDefinition<
    string,
    {
      run: (ctx: WorkflowContext, args: unknown) => Promise<unknown>
    }
  >
>((input): input is ServiceDefinition<string, ''> => {
  return typeof input === 'object' && input !== null
})

export const StartProcessRequest = Schema.Struct({
  processId: Schema.UUID,
  processDefinition: WorkflowDefinitionSchema,
  props: Schema.Unknown,
})
