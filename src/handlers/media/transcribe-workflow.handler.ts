import type { Schema } from 'effect'
import { Effect as E } from 'effect'
import { MediaEmpty } from '../../domain/media/media.errors'
import type { UnifiedMediaRequest } from '../../domain/media/media.schema'
import { startTranscribeProcessUsecase } from '../../usecases/media/transcribe-workflow.usecase.ts'

type UnifiedMediaRequestType = Schema.Schema.Type<typeof UnifiedMediaRequest>

export const transcribeWorkflowHandler = (request: UnifiedMediaRequestType) =>
  E.gen(function* () {
    const result = yield* startTranscribeProcessUsecase(request)
    return result
  }).pipe(
    E.catchAll(() => new MediaEmpty()),
    E.tapError(E.logError),
    E.withSpan('transcribeWorkflowHandler', {
      attributes: {
        language: request.language,
        source: 'url' in request ? 'url' : 'file',
      },
    }),
  )
