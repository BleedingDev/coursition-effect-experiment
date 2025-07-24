import { Data } from 'effect'

export class InvalidSubtitleDataError extends Data.TaggedError('InvalidSubtitleDataError')<{
  readonly reason: string
  readonly data?: unknown
}> {}

export class UnsupportedFormatError extends Data.TaggedError('UnsupportedFormatError')<{
  readonly format: string
  readonly supportedFormats: readonly string[]
}> {}

export class InvalidTimingError extends Data.TaggedError('InvalidTimingError')<{
  readonly reason: string
  readonly subtitle: unknown
}> {}

export class ConversionError extends Data.TaggedError('ConversionError')<{
  readonly format: string
  readonly cause: unknown
}> {}

export class ProcessingError extends Data.TaggedError('ProcessingError')<{
  readonly step: string
  readonly cause: unknown
}> {} 