import { Schema } from 'effect'
import { Data } from 'effect'

/**
 * Represents a single subtitle item with timing and text content
 */
export const SubtitleItem = Schema.Struct({
  /** Start time in milliseconds */
  start: Schema.Number,
  /** End time in milliseconds */
  end: Schema.Number,
  /** Subtitle text content */
  text: Schema.String,
  /** Optional speaker identifier */
  speaker: Schema.optional(Schema.NonNegativeInt),
})

/**
 * Array of subtitle items representing a complete subtitle track
 */
export const SubtitleJson = Schema.Array(SubtitleItem)

/**
 * Supported subtitle output formats
 */
export const SubtitleFormat = Schema.Literal('json', 'srt', 'vtt', 'plain-text')

/**
 * Configuration options for subtitle processing and conversion
 */
export const ConversionOptions = Schema.Struct({
  /** Timing offset to apply to all subtitles (in milliseconds) */
  timingOffset: Schema.optional(Schema.Number),
  /** Whether to include speaker information in output */
  includeSpeaker: Schema.optional(Schema.Boolean),
  /** Whether to merge adjacent subtitles */
  mergeAdjacent: Schema.optional(Schema.Boolean),
  /** Threshold for merging adjacent subtitles (in milliseconds) */
  mergeThreshold: Schema.optional(Schema.Number),
  /** Whether to clean and normalize subtitle text */
  cleanText: Schema.optional(Schema.Boolean),
})

export class SubtitleConversionResult extends Data.TaggedClass(
  'SubtitleConversionResult',
)<{
  format: SubtitleFormat
  content: string
}> {}

/**
 * Result of converting subtitles to multiple formats
 */
export const SubtitleConversionResultSchema = Schema.Struct({
  format: SubtitleFormat,
  content: Schema.String,
})

export const MultipleFormatResult = Schema.Struct({
  results: Schema.Array(SubtitleConversionResultSchema),
})

// Type exports for use in other modules
export type SubtitleItem = Schema.Schema.Type<typeof SubtitleItem>
export type SubtitleJson = Schema.Schema.Type<typeof SubtitleJson>
export type SubtitleFormat = Schema.Schema.Type<typeof SubtitleFormat>
export type ConversionOptions = Schema.Schema.Type<typeof ConversionOptions>
export type MultipleFormatResult = Schema.Schema.Type<
  typeof MultipleFormatResult
>
