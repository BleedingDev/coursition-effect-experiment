import * as restate from '@restatedev/restate-sdk'
import { Effect as E, type Schema } from 'effect'
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
    const result = yield* workflowStore.startProcess({
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

export const transcribeWorkflowDefinition = restate.service({
  name: 'transcribeWorkflow',
  handlers: {
    process: async (
      ctx: restate.Context,
      props: { url: string; language: string },
    ) => {
      const propsWithUrl = {
        url: new URL(props.url),
        language: props.language,
      }
      
      // Should return a downloaded file
      await executeStep(ctx, () => {
        return downloadLinkStep(propsWithUrl)
      })

      // Should return subtitles
      await executeStep(ctx, () => {
        return transcribeMediaStep(propsWithUrl)
      })

      await executeStep(ctx, () => {
        return persistSubtitlesStep()
      })
    },
  },
})
