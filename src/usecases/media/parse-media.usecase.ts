import { Effect as E, Schema } from 'effect'
import { FileSystem } from '@effect/platform'
import type { UnifiedMediaRequest } from '../../domain/media/media.schema'
import { MediaStore } from '../../stores/media/media.store'

type UnifiedMediaRequestType = Schema.Schema.Type<typeof UnifiedMediaRequest>

export const parseMediaUsecase = (request: UnifiedMediaRequestType) =>
  E.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const media = 'url' in request ? request.url : yield* fs.readFile(request.file.path)

    const mediaStore = yield* MediaStore
    const result = yield* mediaStore.parseMedia(media, request.language)
    return result
  }).pipe(
    E.tapError(E.logError),
    E.orDie,
    E.withSpan('parseMediaUsecase', {
      attributes: {
        language: request.language,
        source: 'url' in request ? 'url' : 'file',
      },
    }),
  )
