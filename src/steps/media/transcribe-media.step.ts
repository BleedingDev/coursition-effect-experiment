import { Effect } from 'effect'
import { MediaStore } from 'src/stores/media/media.store'

export const transcribeMediaEffect = (url: string, language?: string) =>
  Effect.gen(function* () {
    const mediaStore = yield* MediaStore
    return yield* mediaStore.parseMedia(new URL(url), language)
  }).pipe(Effect.tapError(Effect.logError), Effect.orDie)

export const transcribeMediaStep = (url: string, language?: string) =>
  transcribeMediaEffect(url, language).pipe(
    Effect.provideService(MediaStore, MediaStore.Deepgram),
  )
