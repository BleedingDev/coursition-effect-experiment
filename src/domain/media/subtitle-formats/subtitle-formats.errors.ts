import { Data, Schema } from 'effect'

// API boundary errors (for HttpApi serialization)
export class SubtitleDataInvalid extends Schema.TaggedError<SubtitleDataInvalid>()(
  'SubtitleDataInvalid',
  {},
) {}

export class SubtitleFormatUnsupported extends Schema.TaggedError<SubtitleFormatUnsupported>()(
  'SubtitleFormatUnsupported',
  {
    format: Schema.String,
    supportedFormats: Schema.Array(Schema.String)
  },
) {}

export class SubtitleTimingInvalid extends Schema.TaggedError<SubtitleTimingInvalid>()(
  'SubtitleTimingInvalid',
  {},
) {}

export class SubtitleConversionFailed extends Schema.TaggedError<SubtitleConversionFailed>()(
  'SubtitleConversionFailed',
  {
    format: Schema.String
  },
) {}

export class SubtitleProcessingFailed extends Schema.TaggedError<SubtitleProcessingFailed>()(
  'SubtitleProcessingFailed',
  {
    step: Schema.String
  },
) {}

// Internal domain errors (for business logic)
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