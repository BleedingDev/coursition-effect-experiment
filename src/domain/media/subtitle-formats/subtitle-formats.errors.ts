import { Data } from 'effect'

/**
 * Error thrown when subtitle data is invalid or malformed
 */
export class InvalidSubtitleDataError extends Data.TaggedError('InvalidSubtitleDataError')<{
  /** Reason for the validation failure */
  readonly reason: string
  /** The invalid data that caused the error */
  readonly data?: unknown
}> {}

/**
 * Error thrown when an unsupported subtitle format is requested
 */
export class UnsupportedFormatError extends Data.TaggedError('UnsupportedFormatError')<{
  /** The requested format that is not supported */
  readonly format: string
  /** List of supported formats */
  readonly supportedFormats: readonly string[]
}> {}

/**
 * Error thrown when subtitle timing is invalid
 */
export class InvalidTimingError extends Data.TaggedError('InvalidTimingError')<{
  /** Description of the timing issue */
  readonly reason: string
  /** The subtitle item with invalid timing */
  readonly subtitle: unknown
}> {}

/**
 * Error thrown when subtitle conversion fails
 */
export class ConversionError extends Data.TaggedError('ConversionError')<{
  /** The format that failed to convert */
  readonly format: string
  /** The underlying error that caused the conversion to fail */
  readonly cause: unknown
}> {}

/**
 * Error thrown when subtitle processing fails
 */
export class ProcessingError extends Data.TaggedError('ProcessingError')<{
  /** The processing step that failed */
  readonly step: string
  /** The underlying error that caused the processing to fail */
  readonly cause: unknown
}> {} 