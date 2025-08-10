import * as restate from '@restatedev/restate-sdk'
import { makeUuid4 } from '@typed/id'
import { Effect as E, type Schema } from 'effect'
import { downloadLinkStep } from 'src/steps/media/download-link.step.ts'
import { persistSubtitlesStep } from 'src/steps/media/persist-subtitles.step.ts'
import { transcribeMediaStep } from 'src/steps/media/transcribe-media.step.ts'
import type {
  RestateParsedMediaRequestType,
  UnifiedMediaRequest,
} from '../../domain/media/media.schema'
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
    const processId = yield* makeUuid4
    const result = yield* workflowStore.startProcess({
      processId,
      processDefinition: transcribeWorkflowDefinition,
      props: request,
    })

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
      props: RestateParsedMediaRequestType,
    ) => {
      const fileUrl = await executeStep(ctx, () => downloadLinkStep(props))

      const subtitlesJson = await executeStep(ctx, () =>
        transcribeMediaStep(fileUrl.toString(), props.language),
      )

      await executeStep(ctx, () =>
        persistSubtitlesStep(JSON.stringify(subtitlesJson)),
      )

      return ctx.key
    },
  },
})
