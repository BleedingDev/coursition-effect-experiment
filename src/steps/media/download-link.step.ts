import { FetchHttpClient, FileSystem, HttpClient } from '@effect/platform'
import { BunContext } from '@effect/platform-bun'
import { Console, Effect as E, type Schema } from 'effect'
import type { UnifiedMediaRequest } from '../../domain/media/media.schema'

type UnifiedMediaRequestType = Schema.Schema.Type<typeof UnifiedMediaRequest>

const downloadLinkEffect = (request: UnifiedMediaRequestType) =>
  E.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const client = yield* HttpClient.HttpClient
    if ('url' in request) {
      const url = request.url
      const response = yield* client.get(url)
      const media = yield* response.arrayBuffer
      yield* Console.log('Media buffer', media)
      return media
    }
    const media = yield* fs.readFile(request.file.path)
    return media
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

export const downloadLinkStep = (request: UnifiedMediaRequestType) =>
  downloadLinkEffect(request).pipe(
    E.provide(BunContext.layer),
    E.provide(FetchHttpClient.layer),
  )
