import { Effect as E, Option, Stream } from 'effect'
import type { Schema } from 'effect'
import {
  ConversionError,
  InvalidSubtitleDataError,
  InvalidTimingError,
  UnsupportedFormatError,
} from './subtitle-formats.errors'
import type {
  ConversionOptions,
  MultipleFormatResult,
  SubtitleConversionResultSchema,
  SubtitleFormat,
  SubtitleItem,
  SubtitleJson,
} from './subtitle-formats.schema'

/**
 * Validates subtitle data for correctness and completeness
 *
 * @param subtitles - Array of subtitle items to validate
 * @param allowEmptyText - Whether to allow empty text content (for processing with cleanText option)
 * @returns Effect that succeeds with validated subtitles or fails with validation error
 */
// Helper functions to reduce cognitive complexity
const validateSubtitleFields = (
  subtitle: { start?: unknown; end?: unknown; text?: unknown },
  index: number,
) => {
  if (
    typeof subtitle.start !== 'number' ||
    typeof subtitle.end !== 'number' ||
    typeof subtitle.text !== 'string'
  ) {
    return E.fail(
      new InvalidSubtitleDataError({
        cause: new Error(
          `Subtitle at index ${index} must have start (number), end (number), and text (string) fields`,
        ),
      }),
    )
  }
  return E.succeed(undefined)
}

const validateSubtitleTiming = (
  subtitle: { start: number; end: number },
  index: number,
) => {
  if (subtitle.start < 0 || subtitle.end < 0) {
    return E.fail(
      new InvalidTimingError({
        cause: new Error(
          `Subtitle at index ${index} has negative timing values`,
        ),
      }),
    )
  }

  if (subtitle.start >= subtitle.end) {
    return E.fail(
      new InvalidTimingError({
        cause: new Error(
          `Subtitle at index ${index} has start time >= end time`,
        ),
      }),
    )
  }
  return E.succeed(undefined)
}

const validateSubtitleText = (
  subtitle: { text: string },
  index: number,
  allowEmptyText: boolean,
) => {
  if (!allowEmptyText && subtitle.text.trim().length === 0) {
    return E.fail(
      new InvalidSubtitleDataError({
        cause: new Error(`Subtitle at index ${index} has empty text content`),
      }),
    )
  }
  return E.succeed(undefined)
}

const validateSubtitleSpeaker = (
  subtitle: { speaker?: number },
  index: number,
) => {
  if (
    subtitle.speaker !== undefined &&
    (subtitle.speaker < 0 || !Number.isInteger(subtitle.speaker))
  ) {
    return E.fail(
      new InvalidSubtitleDataError({
        cause: new Error(
          `Subtitle at index ${index} has invalid speaker value (must be non-negative integer)`,
        ),
      }),
    )
  }
  return E.succeed(undefined)
}

export const validateSubtitleData = (
  subtitles: SubtitleJson,
  allowEmptyText = false,
) =>
  E.gen(function* () {
    // Use Option to check for presence
    const maybeSubtitles = Option.fromNullable(subtitles)
    if (Option.isNone(maybeSubtitles)) {
      return yield* E.fail(
        new InvalidSubtitleDataError({
          cause: new Error('Subtitle data cannot be null or undefined'),
        }),
      )
    }
    // Unwrap safely
    const actualSubtitles = maybeSubtitles.value
    // Check if subtitles array exists and is not empty
    if (!Array.isArray(actualSubtitles) || actualSubtitles.length === 0) {
      return yield* E.fail(
        new InvalidSubtitleDataError({
          cause: new Error('Subtitle data must be a non-empty array'),
        }),
      )
    }
    // Validate each subtitle item using generator for streaming validation
    for (let i = 0; i < actualSubtitles.length; i++) {
      const subtitle = actualSubtitles[i]

      // Validate using helper functions
      yield* validateSubtitleFields(subtitle, i)
      yield* validateSubtitleTiming(subtitle, i)
      yield* validateSubtitleText(subtitle, i, allowEmptyText)
      yield* validateSubtitleSpeaker(subtitle, i)
    }

    return actualSubtitles
  }).pipe(
    E.tapError(E.logError),
    E.withSpan('validateSubtitleData', {
      attributes: {
        count: Array.isArray(subtitles) ? subtitles.length : 0,
        hasOptions: allowEmptyText !== undefined,
      },
    }),
  )

/**
 * Applies timing offset to subtitle items using generator for streaming processing
 *
 * @param offset - Timing offset in milliseconds (positive or negative)
 * @returns Function that takes a subtitle item and returns it with adjusted timing
 */
export const applyTimingOffset =
  (offset: number) =>
  (subtitle: SubtitleItem): SubtitleItem => ({
    ...subtitle,
    start: Math.max(0, subtitle.start + offset),
    end: Math.max(0, subtitle.end + offset),
  })

/**
 * Cleans and normalizes subtitle text content
 *
 * @param subtitle - Subtitle item to clean
 * @returns Subtitle item with cleaned text
 */
export const cleanSubtitleText = (subtitle: SubtitleItem): SubtitleItem => ({
  ...subtitle,
  text: subtitle.text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s+/g, '\n') // Remove leading spaces after line breaks
    .replace(/\s+\n/g, '\n'), // Remove trailing spaces before line breaks
})

/**
 * Adds speaker information to subtitle text
 *
 * @param includeSpeaker - Whether to include speaker information
 * @returns Function that takes a subtitle item and returns it with speaker info if enabled
 */
export const addSpeakerInfo =
  (includeSpeaker: boolean) =>
  (subtitle: SubtitleItem): SubtitleItem => {
    if (!includeSpeaker || subtitle.speaker === undefined) {
      return subtitle
    }

    return {
      ...subtitle,
      text: `[Speaker ${subtitle.speaker}]: ${subtitle.text}`,
    }
  }

/**
 * Merges adjacent subtitles that are close in timing using generator for streaming processing
 *
 * @param subtitles - Array of subtitle items to merge
 * @param threshold - Maximum gap in milliseconds to consider subtitles adjacent
 * @returns Effect that succeeds with merged subtitles or fails with processing error
 */
export const mergeAdjacentSubtitles = (
  subtitles: SubtitleItem[],
  threshold: number,
) => {
  if (subtitles.length <= 1) {
    return E.succeed(subtitles)
  }

  const merged: SubtitleItem[] = []
  const first = subtitles[0]
  if (!first) {
    return E.succeed(subtitles)
  }
  let current: SubtitleItem = {
    start: first.start,
    end: first.end,
    text: first.text,
    speaker: first.speaker,
  }

  // Process subtitles one by one
  for (let i = 1; i < subtitles.length; i++) {
    const next = subtitles[i]
    if (!next) {
      continue
    }

    const gap = next.start - current.end

    if (gap <= threshold) {
      // Merge subtitles
      const mergedSubtitle: SubtitleItem = {
        start: current.start,
        end: next.end,
        text: `${current.text} ${next.text}`,
        speaker: current.speaker === next.speaker ? current.speaker : undefined,
      }
      current = mergedSubtitle
    } else {
      // Add current to merged array and start new current
      merged.push(current)
      current = {
        start: next.start,
        end: next.end,
        text: next.text,
        speaker: next.speaker,
      }
    }
  }

  // Add the last subtitle
  merged.push(current)

  return E.succeed(merged).pipe(
    E.tapError(E.logError),
    E.withSpan('mergeAdjacentSubtitles', {
      attributes: {
        originalCount: subtitles.length,
        threshold,
      },
    }),
  )
}

/**
 * Processes subtitles with various options using generator for streaming processing
 *
 * @param subtitles - Array of subtitle items to process
 * @param options - Processing options (timing offset, speaker info, merging, etc.)
 * @returns Effect that succeeds with processed subtitles or fails with processing error
 */
// Helper function to process a single subtitle item
const processSingleSubtitle = (
  item: SubtitleItem,
  options?: ConversionOptions,
): SubtitleItem => {
  let processedItem = item

  // 1. Apply timing offset first
  if (options?.timingOffset) {
    processedItem = applyTimingOffset(options.timingOffset)(processedItem)
  }

  // 2. Clean text second
  if (options?.cleanText !== false) {
    // Default to true
    processedItem = cleanSubtitleText(processedItem)
  }

  // 3. Add speaker info last
  if (options?.includeSpeaker) {
    processedItem = addSpeakerInfo(true)(processedItem)
  }

  return processedItem
}

export const processSubtitles = (
  subtitles: SubtitleJson,
  options?: ConversionOptions,
) =>
  E.gen(function* () {
    // Validate input data first, allowing empty text if cleanText is enabled
    const allowEmptyText = options?.cleanText === true
    const validatedSubtitles = yield* validateSubtitleData(
      subtitles,
      allowEmptyText,
    )

    // Process each subtitle in correct order: timing → clean → speaker
    let processed = validatedSubtitles.map((item) =>
      processSingleSubtitle(item, options),
    )

    // Filter out empty text if cleanText is enabled
    if (options?.cleanText === true) {
      processed = processed.filter((item) => item.text.trim().length > 0)
    }

    // Apply merging if requested
    if (options?.mergeAdjacent) {
      return yield* mergeAdjacentSubtitles(
        processed,
        options.mergeThreshold ?? 1000,
      )
    }

    return processed
  }).pipe(
    E.tapError(E.logError),
    E.withSpan('processSubtitles', {
      attributes: {
        count: Array.isArray(subtitles) ? subtitles.length : 0,
        hasOptions: options !== undefined,
      },
    }),
  )

/**
 * Stream-based processing of subtitles: each subtitle is processed in parallel through the pipeline.
 * @param subtitles - Array of subtitle items to process
 * @param options - Processing options (timing offset, speaker info, merging, etc.)
 * @returns Stream of processed subtitle items
 */
export const processSubtitlesStream = (
  subtitles: SubtitleJson,
  options?: ConversionOptions,
) => {
  // Validate input data first (allow empty text if cleanText is enabled)
  const allowEmptyText = options?.cleanText === true
  return Stream.fromIterable(subtitles).pipe(
    Stream.mapEffect((item) =>
      validateSubtitleData([item], allowEmptyText).pipe(E.map((arr) => arr[0])),
    ),
    // Apply transformations in parallel
    Stream.map((item) => {
      let processedItem = item
      if (options?.timingOffset) {
        processedItem = applyTimingOffset(options.timingOffset)(processedItem)
      }
      if (options?.cleanText !== false) {
        processedItem = cleanSubtitleText(processedItem)
      }
      if (options?.includeSpeaker) {
        processedItem = addSpeakerInfo(true)(processedItem)
      }
      return processedItem
    }),
    // Filter out empty text if cleanText is enabled
    options?.cleanText === true
      ? Stream.filter((item) => item.text.trim().length > 0)
      : (s) => s,
  )
}

/**
 * Stream endpoint: collects all processed subtitles into an array, catches all errors.
 */
export const runSubtitleProcessingStream = (
  subtitles: SubtitleJson,
  options?: ConversionOptions,
) =>
  processSubtitlesStream(subtitles, options).pipe(
    Stream.runCollect,
    E.map((chunk) => Array.from(chunk)),
    E.catchAll((err) => E.succeed({ error: err })),
  )

/**
 * Converts subtitle items to a specific format using generator for streaming processing
 *
 * @param subtitles - Array of subtitle items to convert
 * @param format - Target format for conversion
 * @param options - Processing options to apply before conversion
 * @returns Effect that succeeds with converted content or fails with conversion error
 */
export const convertSubtitleFormat = (
  subtitles: SubtitleJson,
  format: SubtitleFormat,
  options?: ConversionOptions,
) =>
  E.gen(function* () {
    // Process subtitles first if options are provided
    const processedSubtitles = yield* processSubtitles(subtitles, options)

    // Convert to requested format
    switch (format) {
      case 'json':
        return yield* convertToJson(processedSubtitles)
      case 'srt':
        return yield* convertToSrt(processedSubtitles)
      case 'vtt':
        return yield* convertToVtt(processedSubtitles)
      case 'plain-text':
        return yield* convertToPlainText(processedSubtitles)
      default:
        return yield* E.fail(
          new UnsupportedFormatError({
            format,
            supportedFormats: ['json', 'srt', 'vtt', 'plain-text'],
          }),
        )
    }
  }).pipe(
    E.tapError(E.logError),
    E.withSpan('convertSubtitleFormat', {
      attributes: {
        format,
        count: subtitles.length,
        hasOptions: options !== undefined,
      },
    }),
  )

/**
 * Stream-based conversion to a specific format (json, srt, vtt, plain-text)
 */
export const convertSubtitleFormatStream = (
  subtitles: SubtitleJson,
  format: SubtitleFormat,
  options?: ConversionOptions,
) =>
  processSubtitlesStream(subtitles, options).pipe(
    Stream.runCollect,
    E.map((chunk) => Array.from(chunk)),
    E.flatMap((arr) => {
      switch (format) {
        case 'json':
          return convertToJson(arr)
        case 'srt':
          return convertToSrt(arr)
        case 'vtt':
          return convertToVtt(arr)
        case 'plain-text':
          return convertToPlainText(arr)
        default:
          return E.fail(
            new ConversionError({
              format: String(format),
              cause: new UnsupportedFormatError({
                format,
                supportedFormats: ['json', 'srt', 'vtt', 'plain-text'],
              }),
            }),
          )
      }
    }),
  )

/**
 * Stream endpoint: converts to a specific format and collects/catches result.
 * @returns Promise<{ error: ErrorType } | string> depending on success or failure
 */
export const runSubtitleConversionStream = (
  subtitles: SubtitleJson,
  format: SubtitleFormat,
  options?: ConversionOptions,
) =>
  convertSubtitleFormatStream(subtitles, format, options).pipe(
    E.catchAll((err) => E.succeed({ error: err })),
  )

/**
 * Formats time in milliseconds to SRT format (HH:MM:SS,mmm)
 *
 * @param ms - Time in milliseconds
 * @returns Formatted time string
 */
export const formatTimeSrt = (ms: number): string => {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = ms % 1000
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
}

/**
 * Formats time in milliseconds to VTT format (HH:MM:SS.mmm)
 *
 * @param ms - Time in milliseconds
 * @returns Formatted time string
 */
export const formatTimeVtt = (ms: number): string => {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = ms % 1000
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

/**
 * Converts subtitle items to JSON format using generator for streaming processing
 *
 * @param subtitles - Array of subtitle items to convert
 * @returns Effect that succeeds with JSON string representation
 */
export const convertToJson = (subtitles: SubtitleItem[]) =>
  E.try({
    try: () => JSON.stringify(subtitles, null, 2),
    catch: (error) =>
      new ConversionError({
        format: 'json',
        cause: error instanceof Error ? error : new Error(String(error)),
      }),
  }).pipe(
    E.tapError(E.logError),
    E.withSpan('convertToJson', { attributes: { count: subtitles.length } }),
  )

/**
 * Converts subtitle items to SRT format with proper headers and structure
 *
 * @param subtitles - Array of subtitle items to convert
 * @returns Effect that succeeds with SRT format string
 */
export const convertToSrt = (subtitles: SubtitleItem[]) => {
  // Build SRT content
  const srtLines: string[] = []

  for (const [index, subtitle] of subtitles.entries()) {
    if (!subtitle) {
      continue
    }

    const startTime = formatTimeSrt(subtitle.start)
    const endTime = formatTimeSrt(subtitle.end)

    srtLines.push(`${index + 1}`)
    srtLines.push(`${startTime} --> ${endTime}`)
    srtLines.push(subtitle.text)
    srtLines.push('')
  }

  return E.succeed(srtLines.join('\n')).pipe(
    E.tapError(E.logError),
    E.withSpan('convertToSrt', { attributes: { count: subtitles.length } }),
  )
}

/**
 * Converts subtitle items to VTT format with proper headers and structure
 *
 * @param subtitles - Array of subtitle items to convert
 * @returns Effect that succeeds with VTT format string
 */
export const convertToVtt = (subtitles: SubtitleItem[]) => {
  // Build VTT content
  const vttLines: string[] = ['WEBVTT', '']

  for (const subtitle of subtitles) {
    if (!subtitle) {
      continue
    }

    const startTime = formatTimeVtt(subtitle.start)
    const endTime = formatTimeVtt(subtitle.end)

    vttLines.push(`${startTime} --> ${endTime}`)
    vttLines.push(subtitle.text)
    vttLines.push('')
  }

  return E.succeed(vttLines.join('\n')).pipe(
    E.tapError(E.logError),
    E.withSpan('convertToVtt', { attributes: { count: subtitles.length } }),
  )
}

/**
 * Converts subtitle items to plain text format using generator for streaming processing
 *
 * @param subtitles - Array of subtitle items to convert
 * @returns Effect that succeeds with plain text string
 */
export const convertToPlainText = (subtitles: SubtitleItem[]) => {
  // Build plain text content
  const textLines: string[] = []

  for (const [index, subtitle] of subtitles.entries()) {
    if (!subtitle) {
      continue
    }

    textLines.push(subtitle.text)

    // Add paragraph break between subtitles
    if (index < subtitles.length - 1) {
      textLines.push('')
    }
  }

  return E.succeed(textLines.join('\n')).pipe(
    E.tapError(E.logError),
    E.withSpan('convertToPlainText', {
      attributes: { count: subtitles.length },
    }),
  )
}

/**
 * SubtitleConverterLive is a pure subtitle format converter service.
 *
 * This service handles ONLY subtitle data conversion to different formats. It receives universal
 * subtitle data (text with timing) and converts it to various output formats such as JSON, SRT, VTT,
 * and plain text. No media parsing, transcription, or audio/video processing is performed.
 *
 * Features:
 * - Supports batch processing for converting multiple subtitles at once.
 * - Enables streaming/parallel processing for high-performance conversion.
 *
 * Methods:
 * - `convert`: Converts subtitle data to a specific format.
 * - `convertMultiple`: Converts subtitle data to multiple formats simultaneously.
 *
 * Example usage:
 * ```ts
 * import { SubtitleConverterLive } from './subtitle-converter';
 * import { SubtitleJson, SubtitleFormat } from './subtitle-formats.schema';
 *
 * const subtitles: SubtitleJson = [
 *   { start: 0, end: 2000, text: "Hello, world!" },
 *   { start: 3000, end: 5000, text: "Welcome to the subtitle converter." }
 * ];
 *
 * const format: SubtitleFormat = 'vtt';
 *
 * SubtitleConverterLive.convert(subtitles, format).pipe(
 *   E.map(result => console.log(result)),
 *   E.tapError(err => console.error(err))
 * );
 * ```
 */
export const SubtitleConverterLive = {
  /**
   * Converts subtitle data to a specific format
   *
   * @param subtitles - Universal subtitle data (text with timing)
   * @param format - Target format for conversion (json, srt, vtt, plain-text)
   * @param options - Processing options to apply before conversion
   * @returns Effect that succeeds with converted content or fails with conversion error
   */
  /**
   * Converts subtitle data to a specific format.
   *
   * @param subtitles - Universal subtitle data (text with timing) to be converted.
   * @param format - Target format for conversion. Supported formats include 'json', 'srt', 'vtt', and 'plain-text'.
   * @param options - Optional processing options to apply before conversion, such as filtering or formatting rules.
   * @returns Effect that succeeds with the converted content as a string or fails with a conversion error.
   * @throws ConversionError - If the conversion process fails due to invalid data or unsupported format.
   * @throws InvalidSubtitleDataError - If the provided subtitle data is incomplete or malformed.
   * @throws UnsupportedFormatError - If the specified format is not supported.
   */
  convert: (
    subtitles: SubtitleJson,
    format: SubtitleFormat,
    options?: ConversionOptions,
  ) =>
    E.gen(function* () {
      // For now, skip schema validation to avoid complex Either handling
      // In production, you might want to add proper schema validation here
      return yield* convertSubtitleFormat(subtitles, format, options)
    }).pipe(
      E.tapError(E.logError),
      E.withSpan('SubtitleConverterLive.convert', {
        attributes: {
          format,
          count: subtitles.length,
        },
      }),
    ),

  /**
   * Converts subtitle data to multiple formats simultaneously.
   *
   * This method processes the provided subtitle data and converts it into
   * multiple specified formats. It applies any given processing options
   * before performing the conversion.
   *
   * @param subtitles - Universal subtitle data (text with timing).
   * @param formats - Array of target formats for conversion (e.g., json, srt, vtt, plain-text).
   * @param options - Optional processing options to apply before conversion.
   * @returns Effect that succeeds with conversion results for all formats or fails with a conversion error.
   * @throws ConversionError - If the conversion process fails for any format.
   * @throws InvalidSubtitleDataError - If the provided subtitle data is invalid.
   * @throws UnsupportedFormatError - If one or more target formats are unsupported.
   */
  convertMultiple: (
    subtitles: SubtitleJson,
    formats: SubtitleFormat[],
    options?: ConversionOptions,
  ) =>
    E.gen(function* () {
      const results: Schema.Schema.Type<
        typeof SubtitleConversionResultSchema
      >[] = []
      // Use generator to process each format
      for (const format of formats) {
        const content = yield* convertSubtitleFormat(subtitles, format, options)
        results.push({ format, content })
      }
      return { results } as MultipleFormatResult
    }).pipe(
      E.tapError(E.logError),
      E.withSpan('SubtitleConverterLive.convertMultiple', {
        attributes: {
          formats: formats.join(','),
          count: subtitles.length,
        },
      }),
    ),
}

// Type exports for backward compatibility
export type { SubtitleItem, SubtitleJson } from './subtitle-formats.schema'
