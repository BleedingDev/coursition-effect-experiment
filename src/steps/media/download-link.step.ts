import { FetchHttpClient, FileSystem, HttpClient } from '@effect/platform'
import { BunContext } from '@effect/platform-bun'
import { Effect as E } from 'effect'
import type { RestateParsedMediaRequestType } from '../../domain/media/media.schema'

const downloadLinkEffect = (request: RestateParsedMediaRequestType) =>
  E.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const client = yield* HttpClient.HttpClient
    if ('url' in request) {
      if (new URL(request.url).hostname.includes('youtube')) {
        const url = request.url
        const response = yield* client.get(url)
        const media = yield* response.arrayBuffer
        return new URL('')
      }
      return new URL(request.url)
    }
    const media = yield* fs.readFile(request.file.path)
    return new URL('')
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

export const downloadLinkStep = (request: RestateParsedMediaRequestType) =>
  downloadLinkEffect(request).pipe(
    E.provide(BunContext.layer),
    E.provide(FetchHttpClient.layer),
  )
