import { HttpApiSchema, Multipart } from '@effect/platform'
import { Schema } from 'effect'

const ParseMediaFileRequest = HttpApiSchema.Multipart(
  Schema.Struct({
    file: Multipart.SingleFileSchema,
  }),
)

const ParseMediaUrlRequest = Schema.Struct({
  url: Schema.URL,
})

const ParseMediaOptions = Schema.Struct({
  language: Schema.String,
})

const ParseMediaRequest = Schema.Union(
  ParseMediaFileRequest,
  ParseMediaUrlRequest,
)

const SubtitleJson = Schema.Array(
  Schema.Struct({
    start: Schema.Number,
    end: Schema.Number,
    text: Schema.String,
    speaker: Schema.optional(Schema.NonNegativeInt),
  }),
)

export const UnifiedMediaRequest = Schema.extend(
  ParseMediaRequest,
  ParseMediaOptions,
)

export const MediaResponse = Schema.Struct({
  json: SubtitleJson,
})
