import * as restate from '@restatedev/restate-sdk'
import { Effect as E, type Schema } from 'effect'
import type { UnifiedMediaRequest } from '../../domain/media/media.schema'
import { downloadLinkUsecase } from '../../steps/media/download-link.usecase.ts'
import { persistSubtitlesUsecase } from '../../steps/media/persist-subtitles.usecase.ts'
import { transcribeUsecase } from '../../steps/media/transcribe.usecase.ts'
import {
  WorkflowStore,
  executeStep,
} from '../../stores/workflow/workflowStore.ts'

type UnifiedMediaRequestType = Schema.Schema.Type<typeof UnifiedMediaRequest>

export const startTranscribeProcessUsecase = (
  request: UnifiedMediaRequestType,
) =>
  E.gen(function* () {
    const workflowStore = yield* WorkflowStore
    const result = yield* workflowStore.startProcess({
      processDefinition: transcribeWorkflowDefinition,
      props: {
        ...request,
      },
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

export const transcribeWorkflowDefinition = restate.service({
  name: 'transcribeWorkflow',
  handlers: {
    process: async (
      ctx: restate.Context,
      props: { url: string; language: string },
    ) => {
      // Should return a downloaded file
      await executeStep(ctx, function* () {
        return yield* downloadLinkUsecase({
          url: props.url,
          language: props.language,
        })
      })

      // Should return subtitles
      await executeStep(ctx, function* () {
        return yield* transcribeUsecase()
      })

      await executeStep(ctx, function* () {
        return yield* persistSubtitlesUsecase()
      })
    },
  },
})
