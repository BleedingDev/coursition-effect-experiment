import { Effect as E, Option, Stream } from 'effect'
import type { SubtitleItem } from './subtitle-formats.schema'

/**
 * Streaming subtitle filter functions for parallel processing pipelines
 * These functions work on individual SubtitleItem objects and can be composed using EffectTS.Pipe
 */

// Regex patterns defined at top level for performance
const SPEAKER_PREFIX_PATTERN = /^\[Speaker \d+\]:\s*/

/**
 * Replaces subtitle text with a specified replacement text
 * Preserves speaker information if already present in the text
 *
 * @param replacementText - The text to replace subtitle content with
 * @returns Function that takes a subtitle item and returns it with replaced text
 */
export const replaceText =
  (replacementText: string) =>
  (subtitle: SubtitleItem): SubtitleItem => {
    // Check if the current text has a speaker prefix (e.g., "[Speaker 1]: ")
    const speakerMatch = subtitle.text.match(SPEAKER_PREFIX_PATTERN)

    if (speakerMatch) {
      // Preserve the speaker prefix and replace only the content
      return {
        ...subtitle,
        text: `${speakerMatch[0]}${replacementText}`,
      }
    }
    // No speaker prefix, replace entire text
    return {
      ...subtitle,
      text: replacementText,
    }
  }

/**
 * Adds a timing offset to a subtitle
 *
 * @param offset - The offset in milliseconds to add to start and end times
 * @returns Function that takes a subtitle item and returns it with adjusted timing
 */
export const addTimingOffset =
  (offset: number) =>
  (subtitle: SubtitleItem): SubtitleItem => ({
    ...subtitle,
    start: Math.max(0, subtitle.start + offset),
    end: Math.max(0, subtitle.end + offset),
  })

/**
 * Filters a subtitle by speaker ID
 *
 * @param speakerId - The speaker ID to filter by
 * @returns Function that takes a subtitle item and returns it if it matches, or Option.none if it doesn't
 */
export const filterBySpeaker =
  (speakerId: number) =>
  (subtitle: SubtitleItem): Option.Option<SubtitleItem> =>
    subtitle.speaker === speakerId ? Option.some(subtitle) : Option.none()

/**
 * Filters a subtitle by multiple speaker IDs
 *
 * @param speakerIds - Array of speaker IDs to include
 * @returns Function that takes a subtitle item and returns it if it matches, or Option.none if it doesn't
 */
export const filterBySpeakers =
  (speakerIds: number[]) =>
  (subtitle: SubtitleItem): Option.Option<SubtitleItem> =>
    typeof subtitle.speaker === 'number' &&
    speakerIds.includes(subtitle.speaker)
      ? Option.some(subtitle)
      : Option.none()

/**
 * Adds a custom prefix to subtitle text
 *
 * @param prefix - The prefix to add to the subtitle
 * @returns Function that takes a subtitle item and returns it with added prefix
 */
export const addPrefix =
  (prefix: string) =>
  (subtitle: SubtitleItem): SubtitleItem => ({
    ...subtitle,
    text: `${prefix} ${subtitle.text}`,
  })

/**
 * Adds a custom suffix to subtitle text
 *
 * @param suffix - The suffix to add to the subtitle
 * @returns Function that takes a subtitle item and returns it with added suffix
 */
export const addSuffix =
  (suffix: string) =>
  (subtitle: SubtitleItem): SubtitleItem => ({
    ...subtitle,
    text: `${subtitle.text} ${suffix}`,
  })

/**
 * Filters a subtitle by duration (keeps only subtitles within specified duration range)
 *
 * @param minDuration - Minimum duration in milliseconds
 * @param maxDuration - Maximum duration in milliseconds
 * @returns Function that takes a subtitle item and returns it if duration matches, or Option.none if it doesn't
 */
export const filterByDuration =
  (minDuration: number, maxDuration: number) =>
  (subtitle: SubtitleItem): Option.Option<SubtitleItem> => {
    const duration = subtitle.end - subtitle.start
    return duration >= minDuration && duration <= maxDuration
      ? Option.some(subtitle)
      : Option.none()
  }

/**
 * Filters a subtitle by time range (keeps only subtitles that overlap with specified time range)
 *
 * @param startTime - Start time in milliseconds
 * @param endTime - End time in milliseconds
 * @returns Function that takes a subtitle item and returns it if it overlaps, or Option.none if it doesn't
 */
export const filterByTimeRange =
  (startTime: number, endTime: number) =>
  (subtitle: SubtitleItem): Option.Option<SubtitleItem> =>
    subtitle.start < endTime && subtitle.end > startTime
      ? Option.some(subtitle)
      : Option.none()

/**
 * Transforms text using a custom function
 *
 * @param textTransformer - Function to transform subtitle text
 * @returns Function that takes a subtitle item and returns it with transformed text
 */
export const transformText =
  (textTransformer: (text: string) => string) =>
  (subtitle: SubtitleItem): SubtitleItem => ({
    ...subtitle,
    text: textTransformer(subtitle.text),
  })

/**
 * Converts text to uppercase
 *
 * @returns Function that takes a subtitle item and returns it with uppercase text
 */
export const toUpperCase = (subtitle: SubtitleItem): SubtitleItem => ({
  ...subtitle,
  text: subtitle.text.toUpperCase(),
})

/**
 * Converts text to lowercase
 *
 * @returns Function that takes a subtitle item and returns it with lowercase text
 */
export const toLowerCase = (subtitle: SubtitleItem): SubtitleItem => ({
  ...subtitle,
  text: subtitle.text.toLowerCase(),
})

/**
 * Capitalizes the first letter of a subtitle
 *
 * @returns Function that takes a subtitle item and returns it with capitalized text
 */
export const capitalize = (subtitle: SubtitleItem): SubtitleItem => ({
  ...subtitle,
  text: subtitle.text.charAt(0).toUpperCase() + subtitle.text.slice(1),
})

/**
 * Filters out subtitles with empty or whitespace-only text
 *
 * @returns Function that takes a subtitle item and returns it if not empty, or Option.none if empty
 */
export const removeEmptySubtitles = (
  subtitle: SubtitleItem,
): Option.Option<SubtitleItem> =>
  subtitle.text.trim().length > 0 ? Option.some(subtitle) : Option.none()

/**
 * Debug filter that logs subtitle information
 */
export const debugSubtitle =
  () =>
  (subtitle: SubtitleItem): SubtitleItem => {
    // Return subtitle unchanged for production (debug logging removed)
    return subtitle
  }

/**
 * Validates a subtitle item and returns it if valid, or Option.none if invalid
 *
 * @returns Function that takes a subtitle item and validates it
 */
export const validateSubtitle = (
  subtitle: SubtitleItem,
): Option.Option<SubtitleItem> => {
  // Basic validation rules
  if (subtitle.start < 0) {
    return Option.none()
  }
  if (subtitle.end <= subtitle.start) {
    return Option.none()
  }
  if (subtitle.text.trim().length === 0) {
    return Option.none()
  }
  return Option.some(subtitle)
}

/**
 * Applies multiple filters to an array of subtitle items
 *
 * @param subtitles - Array of subtitle items
 * @param filters - Array of filter functions to apply
 * @returns Array of filtered subtitle items
 */
export const applyFiltersToArray = (
  subtitles: SubtitleItem[],
  ...filters: Array<
    (subtitle: SubtitleItem) => SubtitleItem | Option.Option<SubtitleItem>
  >
): SubtitleItem[] => {
  return subtitles
    .filter((subtitle) => Option.isSome(applyFiltersToItem(subtitle, filters)))
    .map((subtitle) => {
      const result = applyFiltersToItem(subtitle, filters)
      return Option.isSome(result) ? result.value : subtitle
    })
}

/**
 * Creates a generator that streams subtitle items
 *
 * @param subtitles - Array of subtitle items
 * @param filters - Array of filter functions to apply
 * @returns Generator that yields processed subtitle items
 */
export const streamSubtitles = (
  subtitles: SubtitleItem[],
  ...filters: Array<
    (subtitle: SubtitleItem) => SubtitleItem | Option.Option<SubtitleItem>
  >
) =>
  function* (): Generator<SubtitleItem, void, unknown> {
    for (const subtitle of subtitles) {
      const result = applyFiltersToItem(subtitle, filters)
      if (Option.isSome(result)) {
        yield result.value
      }
    }
  }

/**
 * Streaming filter operations using generators and EffectTS.Pipe
 * These functions create streams that can be processed in parallel
 */

/**
 * Creates a stream from an array of subtitle items
 *
 * @param subtitles - Array of subtitle items to stream
 * @returns Stream of subtitle items
 */
export const createSubtitleStream = (subtitles: SubtitleItem[]) =>
  Stream.fromIterable(subtitles)

/**
 * Applies a single filter to a stream of subtitles
 *
 * @param filter - Single-item filter function
 * @returns Stream transformation function
 */
export const applyFilter =
  <T extends SubtitleItem>(
    filter: (subtitle: SubtitleItem) => T | Option.Option<T>,
  ) =>
  (stream: Stream.Stream<SubtitleItem, never, never>) =>
    stream.pipe(
      Stream.mapEffect((subtitle) => {
        const result = filter(subtitle)
        if (Option.isOption(result)) {
          return Option.isSome(result)
            ? E.succeed(result.value)
            : E.fail('filtered')
        }
        return E.succeed(result)
      }),
      Stream.catchAll(() => Stream.empty),
    )

/**
 * Applies multiple filters in sequence to a stream of subtitles
 *
 * @param filters - Array of single-item filter functions
 * @returns Stream transformation function
 */
export const applyFilters =
  (
    ...filters: Array<
      (subtitle: SubtitleItem) => SubtitleItem | Option.Option<SubtitleItem>
    >
  ) =>
  (stream: Stream.Stream<SubtitleItem, never, never>) =>
    stream.pipe(
      Stream.mapEffect((subtitle) => {
        const result = applyFiltersToItem(subtitle, filters)
        return Option.isSome(result)
          ? E.succeed(result.value)
          : E.fail('filtered')
      }),
      Stream.catchAll(() => Stream.empty),
    )

/**
 * Processes subtitles through a pipeline using EffectTS.Pipe
 *
 * @param subtitles - Array of subtitle items to process
 * @param filters - Array of single-item filter functions to apply
 * @returns Stream of processed subtitle items
 */
export const processSubtitlesPipeline = (
  subtitles: SubtitleItem[],
  ...filters: Array<
    (subtitle: SubtitleItem) => SubtitleItem | Option.Option<SubtitleItem>
  >
) => createSubtitleStream(subtitles).pipe(applyFilters(...filters))

/**
 * Collects a stream of subtitles into an array buffer
 *
 * @param stream - Stream of subtitle items
 * @returns Effect that succeeds with array of subtitle items
 */
export const collectStream = (
  stream: Stream.Stream<SubtitleItem, never, never>,
) =>
  stream.pipe(
    Stream.runCollect,
    E.map((chunk) => Array.from(chunk)),
  )

/**
 * Processes subtitles through a pipeline and collects the results
 *
 * @param subtitles - Array of subtitle items to process
 * @param filters - Array of single-item filter functions to apply
 * @returns Effect that succeeds with processed subtitle array
 */
export const processAndCollect = (
  subtitles: SubtitleItem[],
  ...filters: Array<
    (subtitle: SubtitleItem) => SubtitleItem | Option.Option<SubtitleItem>
  >
) => collectStream(processSubtitlesPipeline(subtitles, ...filters))

/**
 * Parallel processing pipeline using EffectTS.Pipe
 * Processes multiple subtitle items in parallel through the same filter chain
 *
 * @param subtitles - Array of subtitle items to process
 * @param filters - Array of single-item filter functions to apply
 * @returns Effect that succeeds with processed subtitle array
 */
export const processSubtitlesParallel = (
  subtitles: SubtitleItem[],
  ...filters: Array<
    (subtitle: SubtitleItem) => SubtitleItem | Option.Option<SubtitleItem>
  >
) => collectStream(processSubtitlesPipeline(subtitles, ...filters))

/**
 * Applies a single filter to a subtitle item
 */
const applySingleFilter = (
  subtitle: SubtitleItem,
  filter: (
    subtitle: SubtitleItem,
  ) => SubtitleItem | Option.Option<SubtitleItem>,
): Option.Option<SubtitleItem> => {
  const result = filter(subtitle)
  return Option.isOption(result) ? result : Option.some(result)
}

/**
 * Applies filters to a single subtitle item
 */
const applyFiltersToItem = (
  subtitle: SubtitleItem,
  filters: Array<
    (subtitle: SubtitleItem) => SubtitleItem | Option.Option<SubtitleItem>
  >,
): Option.Option<SubtitleItem> => {
  let current = subtitle
  for (const filter of filters) {
    const result = applySingleFilter(current, filter)
    if (Option.isNone(result)) {
      return Option.none()
    }
    current = result.value
  }
  return Option.some(current)
}

/**
 * Generator-based streaming filter that yields processed subtitles one by one
 *
 * @param subtitles - Array of subtitle items to process
 * @param filters - Array of single-item filter functions to apply
 * @returns Generator that yields processed subtitle items
 */
export function* streamSubtitlesGenerator(
  subtitles: SubtitleItem[],
  ...filters: Array<
    (subtitle: SubtitleItem) => SubtitleItem | Option.Option<SubtitleItem>
  >
): Generator<SubtitleItem, void, unknown> {
  for (const subtitle of subtitles) {
    const result = applyFiltersToItem(subtitle, filters)
    if (Option.isSome(result)) {
      yield result.value
    }
  }
}

/**
 * Collects items from a generator into an array buffer
 *
 * @param generator - Generator function that yields subtitle items
 * @returns Array of collected subtitle items
 */
export const collectGenerator = <T>(
  generator: Generator<T, void, unknown>,
): T[] => {
  const result: T[] = []
  for (const item of generator) {
    result.push(item)
  }
  return result
}

/**
 * Processes subtitles using generator and collects results
 *
 * @param subtitles - Array of subtitle items to process
 * @param filters - Array of single-item filter functions to apply
 * @returns Array of processed subtitle items
 */
export const processSubtitlesWithGenerator = (
  subtitles: SubtitleItem[],
  ...filters: Array<
    (subtitle: SubtitleItem) => SubtitleItem | Option.Option<SubtitleItem>
  >
): SubtitleItem[] => {
  const generator = streamSubtitlesGenerator(subtitles, ...filters)
  return collectGenerator(generator)
}

/**
 * Reverses the order of subtitle items in a stream
 *
 * @param stream - Stream of subtitle items
 * @returns Stream transformation function that reverses the order
 */
export const reverseStream = (
  stream: Stream.Stream<SubtitleItem, never, never>,
) =>
  stream.pipe(
    Stream.runCollect,
    E.map((chunk) => Array.from(chunk).reverse()),
    E.flatMap((reversed) => E.succeed(Stream.fromIterable(reversed))),
  )

/**
 * Saves subtitle stream to final file format
 *
 * @param stream - Stream of subtitle items
 * @param format - Output format ('json', 'srt', 'vtt', 'plain-text')
 * @returns Effect that succeeds with formatted string content
 */
export const saveToFile =
  (format: 'json' | 'srt' | 'vtt' | 'plain-text') =>
  (stream: Stream.Stream<SubtitleItem, never, never>) =>
    stream.pipe(
      Stream.runCollect,
      E.map((chunk) => Array.from(chunk)),
      E.flatMap((subtitles) => {
        switch (format) {
          case 'json':
            return E.succeed(JSON.stringify(subtitles, null, 2))
          case 'srt':
            return E.succeed(convertToSrtFormat(subtitles))
          case 'vtt':
            return E.succeed(convertToVttFormat(subtitles))
          case 'plain-text':
            return E.succeed(convertToPlainTextFormat(subtitles))
          default:
            return E.fail(new Error(`Unsupported format: ${format}`))
        }
      }),
    )

/**
 * Helper function to convert subtitles to SRT format
 */
const convertToSrtFormat = (subtitles: SubtitleItem[]): string => {
  const lines: string[] = []
  for (const [index, subtitle] of subtitles.entries()) {
    if (!subtitle) {
      continue
    }

    const startTime = formatTimeSrt(subtitle.start)
    const endTime = formatTimeSrt(subtitle.end)

    lines.push(`${index + 1}`)
    lines.push(`${startTime} --> ${endTime}`)
    lines.push(subtitle.text)
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * Helper function to convert subtitles to VTT format
 */
const convertToVttFormat = (subtitles: SubtitleItem[]): string => {
  const lines: string[] = ['WEBVTT', '']
  for (const subtitle of subtitles) {
    if (!subtitle) {
      continue
    }

    const startTime = formatTimeVtt(subtitle.start)
    const endTime = formatTimeVtt(subtitle.end)

    lines.push(`${startTime} --> ${endTime}`)
    lines.push(subtitle.text)
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * Helper function to convert subtitles to plain text format
 */
const convertToPlainTextFormat = (subtitles: SubtitleItem[]): string => {
  const lines: string[] = []
  for (const [index, subtitle] of subtitles.entries()) {
    if (!subtitle) {
      continue
    }

    lines.push(subtitle.text)

    if (index < subtitles.length - 1) {
      lines.push('')
    }
  }
  return lines.join('\n')
}

/**
 * Formats time in milliseconds to SRT format (HH:MM:SS,mmm)
 */
const formatTimeSrt = (ms: number): string => {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = ms % 1000
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
}

/**
 * Formats time in milliseconds to VTT format (HH:MM:SS.mmm)
 */
const formatTimeVtt = (ms: number): string => {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = ms % 1000
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}
