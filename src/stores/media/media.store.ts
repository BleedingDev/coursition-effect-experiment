import { createDeepgram } from '@ai-sdk/deepgram'
import { experimental_transcribe as transcribe } from 'ai'
import {
  Config,
  type ConfigError,
  Context,
  Effect,
  Redacted,
  type Schema,
} from 'effect'
import {
  MediaClientError,
  MediaParsingError,
} from '../../domain/media/media.errors'
import { MediaResponse } from '../../domain/media/media.schema'

export class MediaStore extends Context.Tag('MediaStore')<
  MediaStore,
  {
    readonly parseMedia: (
      media: URL,
      language?: string,
    ) => Effect.Effect<
      Schema.Schema.Type<typeof MediaResponse>,
      MediaParsingError | MediaClientError | ConfigError.ConfigError
    >
  }
>() {
  static Deepgram = MediaStore.of({
    parseMedia: Effect.fn('parse-media')(function* (
      media: URL,
      language = 'en-GB',
    ) {
      yield* Effect.annotateCurrentSpan('request', media)

      const apiKey = yield* Config.redacted('DEEPGRAM_API_KEY')
      const client = yield* Effect.try({
        try: () =>
          createDeepgram({
            apiKey: Redacted.value(apiKey),
          }),
        catch: (error) => new MediaClientError({ source: 'deepgram', error }),
      })

      const result = yield* Effect.tryPromise({
        try: () => {
          return transcribe({
            model: client.transcription('nova-2'),
            audio: media,
            providerOptions: {
              deepgram: {
                language,
              },
            },
          })
        },
        catch: (error) => new MediaParsingError({ source: 'ai-sdk', error }),
      })
      yield* Effect.annotateCurrentSpan('result', result)

      return MediaResponse.make({
        json: result.segments.map((segment) => ({
          start: segment.startSecond,
          end: segment.endSecond,
          text: segment.text,
        })),
      })
    }),
  })
}
