import { Effect } from 'effect'

export const persistSubtitlesStep = (subtitlesJson: string) =>
  Effect.gen(function* () {
    // TODO: Implement the logic to persist gained subtitles
    yield* Effect.log('persistSubtitlesUsecase', { subtitlesJson })
    return undefined
  }).pipe(
    Effect.tapError(Effect.logError),
    Effect.orDie, // Die on any unexpected errors
    Effect.withSpan('persistSubtitlesUsecase', {
      attributes: {},
    }),
  )
