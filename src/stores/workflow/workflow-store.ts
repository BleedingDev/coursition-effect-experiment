import type * as restate from '@restatedev/restate-sdk'
import * as clients from '@restatedev/restate-sdk-clients'
import { Config, Context, Effect, Layer, Schedule, type Schema } from 'effect'
import {
  type WorkflowConnectionError,
  WorkflowCreationError,
} from '../../domain/workflow/workflow.errors.ts'
import {
  type StartProcessRequest,
  StartProcessResponse,
} from '../../domain/workflow/workflow.schema.ts'

type StartProcessRequestType = Schema.Schema.Type<typeof StartProcessRequest>

export class RestateClient extends Context.Tag('RestateClient')<
  RestateClient,
  clients.Ingress
>() {}

export const RestateClientLive = Layer.effect(
  RestateClient,
  Effect.gen(function* () {
    const restateUrl = yield* Config.url('RESTATE_URL')

    const client = yield* Effect.try({
      try: () => clients.connect({ url: restateUrl.toString() }),
      catch: (error) => new Error(`Failed to connect to Restate: ${error}`),
    }).pipe(
      Effect.retry(
        Schedule.union(Schedule.exponential('1 second', 2), Schedule.recurs(5)),
      ),
      Effect.tap(() => Effect.log('Successfully connected to Restate')),
    )

    return client
  }),
)

export class WorkflowStore extends Context.Tag('WorkflowStore')<
  WorkflowStore,
  {
    readonly startProcess: (
      request: StartProcessRequestType,
    ) => Effect.Effect<
      Schema.Schema.Type<typeof StartProcessResponse>,
      WorkflowConnectionError | WorkflowCreationError,
      RestateClient
    >
  }
>() {
  static RestateStore = WorkflowStore.of({
    startProcess: Effect.fn('start-process')(function* ({
      processId,
      processDefinition,
      props,
    }: StartProcessRequestType) {
      const rs = yield* RestateClient

      const workflow = rs.workflowClient(processDefinition, processId)
      const response = yield* Effect.tryPromise({
        try: () =>
          // biome-ignore lint/suspicious/noExplicitAny: // TODO: Not sure why does Restate say it is never.
          (workflow as any).workflowSubmit(props),
        catch: (error) => {
          return new WorkflowCreationError({ processId, cause: error })
        },
      })

      return StartProcessResponse.make({ processId, response })
    }),
  })

  static Live = Layer.succeed(WorkflowStore, WorkflowStore.RestateStore)
}

export async function executeStep<A, E>(
  ctx: restate.Context,
  execFn: () => Effect.Effect<A, E, never>,
): Promise<A> {
  return ctx.run(() => Effect.runPromise(execFn()))
}
