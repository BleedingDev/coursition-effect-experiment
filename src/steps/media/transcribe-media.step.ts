import type { DataContent } from 'ai'
import { Effect as E } from 'effect'
import { MediaStore } from 'src/stores/media/media.store'

const transcribeMediaEffect = (file: DataContent) =>
  E.gen(function* () {
    const mediaStore = yield* MediaStore
    return yield* mediaStore.parseMedia(file)
  }).pipe(E.tapError(E.logError), E.orDie)

export const transcribeMediaStep = (file: DataContent) =>
  transcribeMediaEffect(file).pipe(
    E.provideService(MediaStore, MediaStore.Deepgram),
  )
