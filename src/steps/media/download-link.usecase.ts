import { Effect as E, type Schema } from 'effect'
import type { UnifiedMediaRequest } from '../../domain/media/media.schema'

type UnifiedMediaRequestType = Schema.Schema.Type<typeof UnifiedMediaRequest>

export const downloadLinkUsecase = (request: UnifiedMediaRequestType) =>
  E.gen(function* () {
    // TODO: Implement the logic to download a media file from a link
    console.log('downloadLinkUsecase')
    return undefined
  }).pipe(
    E.tapError(E.logError),
    E.orDie, // Die on any unexpected errors
    E.withSpan('downloadLinkUsecase', {
      attributes: {
        language: request.language,
        source: 'url',
      },
    }),
  )
