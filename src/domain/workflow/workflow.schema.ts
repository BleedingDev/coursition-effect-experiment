import type { Context, ServiceDefinition } from '@restatedev/restate-sdk'
import { Schema } from 'effect'

export const StartProcessResponse = Schema.Struct({
  response: Schema.Unknown,
})

export const ServiceDefinitionSchema = Schema.declare<
  ServiceDefinition<
    string,
    {
      process: (ctx: Context, args: any) => Promise<any>
    }
  >
>((input): input is ServiceDefinition<string, ''> => {
  return typeof input === 'object' && input !== null
})

export const StartProcessRequest = Schema.Struct({
  processDefinition: ServiceDefinitionSchema,
  props: Schema.Unknown,
})
