import { Effect as E } from 'effect'
import { MediaStore } from 'src/stores/media/media.store'

export const transcribeMediaEffect = (url: string, language?: string) =>
  E.gen(function* () {
    const mediaStore = yield* MediaStore
    return yield* mediaStore.parseMedia(new URL(url), language)
  }).pipe(E.tapError(E.logError), E.orDie)

export const transcribeMediaStep = (url: string, language?: string) =>
  transcribeMediaEffect(url, language).pipe(
    E.provideService(MediaStore, MediaStore.Deepgram),
  )
