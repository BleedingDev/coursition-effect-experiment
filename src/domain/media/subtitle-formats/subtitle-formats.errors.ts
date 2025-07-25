import { Data } from 'effect'

export class InvalidSubtitleDataError extends Data.TaggedError('InvalidSubtitleDataError')<{
  readonly cause: Error
}> {}

export class UnsupportedFormatError extends Data.TaggedError('UnsupportedFormatError')<{
  readonly format: string
  readonly supportedFormats: readonly string[]
}> {}

export class InvalidTimingError extends Data.TaggedError('InvalidTimingError')<{
  readonly cause: Error
}> {}

export class ConversionError extends Data.TaggedError('ConversionError')<{
  readonly format: string
  readonly cause: Error
}> {}

export class ProcessingError extends Data.TaggedError('ProcessingError')<{
  readonly step: string
  readonly cause: Error
}> {} 