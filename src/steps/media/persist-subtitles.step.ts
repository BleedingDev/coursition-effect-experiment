import { Effect as E } from 'effect'

export const persistSubtitlesStep = (subtitlesJson: string) =>
  E.gen(function* () {
    // TODO: Implement the logic to persist gained subtitles
    console.log('persistSubtitlesUsecase', subtitlesJson)
    return undefined
  }).pipe(
    E.tapError(E.logError),
    E.orDie, // Die on any unexpected errors
    E.withSpan('persistSubtitlesUsecase', {
      attributes: {},
    }),
  )
