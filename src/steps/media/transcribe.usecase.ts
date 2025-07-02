import { Effect as E } from 'effect'

export const transcribeUsecase = () =>
  E.gen(function* () {
    // TODO: Implement the logic to send the file to an AI transcription service
    console.log('transcribeUsecase')
    return undefined
  }).pipe(
    E.tapError(E.logError),
    E.orDie, // Die on any unexpected errors
    E.withSpan('transcribeUsecase', {
      attributes: {},
    }),
  )
