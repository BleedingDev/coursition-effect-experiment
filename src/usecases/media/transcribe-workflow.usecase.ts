import * as restate from '@restatedev/restate-sdk'
import { Uuid5Namespace, makeUuid5 } from '@typed/id'
import { Console, Effect as E, type Schema } from 'effect'
import { downloadLinkStep } from 'src/steps/media/download-link.step.ts'
import { persistSubtitlesStep } from 'src/steps/media/persist-subtitles.step.ts'
import { transcribeMediaStep } from 'src/steps/media/transcribe-media.step.ts'
import type { UnifiedMediaRequest } from '../../domain/media/media.schema'
import {
  WorkflowStore,
  executeStep,
} from '../../stores/workflow/workflow-store.ts'

type UnifiedMediaRequestType = Schema.Schema.Type<typeof UnifiedMediaRequest>

export const startTranscribeProcessUsecase = (
  request: UnifiedMediaRequestType,
) =>
  E.gen(function* () {
    const workflowStore = yield* WorkflowStore
    yield* Console.log('Starting transcription process')
    const processId = yield* makeUuid5(
      Uuid5Namespace.URL,
      'https://coursition.com',
    )
    const result = yield* workflowStore.startProcess({
      processId,
      processDefinition: transcribeWorkflowDefinition,
      props: request,
    })
    yield* Console.log('Transcription process started', result)

    return result
  }).pipe(
    E.tapError(E.logError),
    E.orDie, // Die on any unexpected errors
    E.withSpan('startTranscribeProcessUsecase', {
      attributes: {
        language: request.language,
        source: 'url' in request ? 'url' : 'file',
      },
    }),
  )

export const transcribeWorkflowDefinition = restate.workflow({
  name: 'transcribeWorkflow',
  handlers: {
    run: async (
      ctx: restate.WorkflowContext,
      props: UnifiedMediaRequestType,
    ) => {
      const fileBuffer = await executeStep(ctx, () => downloadLinkStep(props))

      const subtitlesJson = await executeStep(ctx, () =>
        transcribeMediaStep(fileBuffer),
      )

      await executeStep(ctx, () =>
        persistSubtitlesStep(JSON.stringify(subtitlesJson)),
      )

      return ctx.key
    },
  },
})
