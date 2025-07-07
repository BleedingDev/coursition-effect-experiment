import { createDeepgram } from '@ai-sdk/deepgram'
import { type DataContent, experimental_transcribe as transcribe } from 'ai'
import {
  Config,
  type ConfigError,
  Context,
  Effect as E,
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
      media: DataContent | URL,
      language?: string,
    ) => E.Effect<
      Schema.Schema.Type<typeof MediaResponse>,
      MediaParsingError | MediaClientError | ConfigError.ConfigError
    >
  }
>() {
  static Deepgram = MediaStore.of({
    parseMedia: E.fn('parse-media')(function* (media, language = 'en-GB') {
      yield* E.annotateCurrentSpan('request', media)

      const apiKey = yield* Config.redacted('DEEPGRAM_API_KEY')
      const client = yield* E.try({
        try: () =>
          createDeepgram({
            apiKey: Redacted.value(apiKey),
          }),
        catch: (error) => new MediaClientError({ source: 'deepgram', error }),
      })

      const result = yield* E.tryPromise({
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
      yield* E.annotateCurrentSpan('result', result)

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
