import type * as restate from '@restatedev/restate-sdk'
import * as clients from '@restatedev/restate-sdk-clients'
import {
  Config,
  type ConfigError,
  Context,
  Effect as E,
  type Schema,
} from 'effect'
import {
  WorkflowConnectionError,
  WorkflowCreationError,
} from '../../domain/workflow/workflow.errors.ts'
import {
  type StartProcessRequest,
  StartProcessResponse,
} from '../../domain/workflow/workflow.schema.ts'

type StartProcessRequestType = Schema.Schema.Type<typeof StartProcessRequest>

export class WorkflowStore extends Context.Tag('WorkflowStore')<
  WorkflowStore,
  {
    readonly startProcess: (
      request: StartProcessRequestType,
    ) => E.Effect<
      Schema.Schema.Type<typeof StartProcessResponse>,
      WorkflowConnectionError | WorkflowCreationError | ConfigError.ConfigError
    >
  }
>() {
  static RestateStore = WorkflowStore.of({
    startProcess: E.fn('start-process')(function* ({
      processId,
      processDefinition,
      props,
    }: StartProcessRequestType) {
      const restateUrl = yield* Config.url('RESTATE_URL')

      const rs = yield* E.try({
        try: () => clients.connect({ url: restateUrl.origin }),
        catch: (error) => new WorkflowConnectionError({ processId, error }),
      })

      const workflow = rs.workflowClient(processDefinition, processId)
      const response = yield* E.tryPromise({
        try: () =>
          // biome-ignore lint/suspicious/noExplicitAny: // TODO: Not sure why does Restate say it is never.
          (workflow as any).workflowSubmit(props),
        catch: (error) => {
          return new WorkflowCreationError({ processId, error })
        },
      })

      return StartProcessResponse.make({ processId, response })
    }),
  })
}

export async function executeStep<A, E>(
  ctx: restate.Context,
  execFn: () => E.Effect<A, E, never>,
): Promise<A> {
  return ctx.run(() => E.runPromise(execFn()))
}
