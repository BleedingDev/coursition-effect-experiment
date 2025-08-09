import { Effect as E } from 'effect'
import { MediaStore } from 'src/stores/media/media.store'

const transcribeMediaEffect = (url: string) =>
  E.gen(function* () {
    const mediaStore = yield* MediaStore
    return yield* mediaStore.parseMedia(new URL(url))
  }).pipe(E.tapError(E.logError), E.orDie)

export const transcribeMediaStep = (url: string) =>
  transcribeMediaEffect(url).pipe(
    E.provideService(MediaStore, MediaStore.Deepgram),
  )
