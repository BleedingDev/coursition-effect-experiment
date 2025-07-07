import {Effect as E, type Schema} from 'effect'
import type {UnifiedMediaRequest} from '../../domain/media/media.schema'

type UnifiedMediaRequestType = Schema.Schema.Type<typeof UnifiedMediaRequest>

export const transcribeMediaStep = (request: UnifiedMediaRequestType) =>
  E.gen(function* () {
    // const fs = yield* FileSystem.FileSystem
    // const media =
    //   'url' in request ? request.url : yield* fs.readFile(request.file.path)
    //
    // const mediaStore = yield* MediaStore
    // const result = yield* mediaStore.parseMedia(media, request.language)
    // return result
    
    // TODO: Implement the logic to transcribe media
    console.log('transcribeMediaUsecase')
    return undefined
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
