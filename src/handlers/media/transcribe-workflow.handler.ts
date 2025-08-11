import type { Schema } from 'effect'
import { Effect } from 'effect'
import { MediaEmpty } from '../../domain/media/media.errors'
import type { UnifiedMediaRequest } from '../../domain/media/media.schema'
import { startTranscribeProcessUsecase } from '../../usecases/media/transcribe-workflow.usecase.ts'

type UnifiedMediaRequestType = Schema.Schema.Type<typeof UnifiedMediaRequest>

export const transcribeWorkflowHandler = (request: UnifiedMediaRequestType) =>
  Effect.gen(function* () {
    const result = yield* startTranscribeProcessUsecase(request)
    return result
  }).pipe(
    Effect.catchAll(() => new MediaEmpty()),
    Effect.tapError(Effect.logError),
    Effect.withSpan('transcribeWorkflowHandler', {
      attributes: {
        language: request.language,
        source: 'url' in request ? 'url' : 'file',
      },
    }),
  )
