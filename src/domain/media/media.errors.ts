import { Data, Schema } from 'effect'

// API boundary errors (for HttpApi serialization)
export class MediaEmpty extends Schema.TaggedError<MediaEmpty>()(
  'MediaEmpty',
  {},
) {}

export class MediaNotFound extends Schema.TaggedError<MediaNotFound>()(
  'MediaNotFound',
  {},
) {}

// Internal domain errors (for business logic)
export class MediaEmptyError extends Data.TaggedError('MediaEmptyError')<{
  readonly reason: string
}> {}

export class MediaNotFoundError extends Data.TaggedError('MediaNotFoundError')<{
  readonly id: string
}> {}

export class MediaParsingError extends Data.TaggedError('MediaParsingError')<{
  readonly source: string
  readonly error: unknown
}> {}

export class MediaClientError extends Data.TaggedError('MediaClientError')<{
  readonly source: string
  readonly error: unknown
}> {}

export class YtDlpDownloadError extends Data.TaggedError('YtDlpDownloadError')<{
  readonly error: unknown
}> {}

export class YtDlpValidationError extends Data.TaggedError(
  'YtDlpValidationError',
)<{
  readonly error: unknown
}> {}
