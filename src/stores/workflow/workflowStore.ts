import type * as restate from '@restatedev/restate-sdk'
import * as clients from '@restatedev/restate-sdk-clients'
import { Context, Effect as E, type Schema } from 'effect'
import type { WorkflowError } from '../../domain/workflow/workflow.errors.ts'
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
      WorkflowError
    >
  }
>() {
  static RestateStore = WorkflowStore.of({
    startProcess: E.fn('start-process')(function* (
      request: StartProcessRequestType,
    ) {
      //TODO: Base URL from ENV param + solve auth
      const rs = clients.connect({ url: 'http://localhost:8080' })

      const response = rs
        .serviceClient(request.processDefinition)
        .process(request.props)
        .then(() => {
          console.log('Process started successfully')
        })

      return StartProcessResponse.make({ response })
    }),
  })
}

export const executeStep = async (
  ctx: restate.Context,
  execMethod: () => any,
) => {
  return ctx.run(() => {
    E.runSync(
      E.sync(function* () {
        return yield* execMethod()
      }),
    )
  })
}
