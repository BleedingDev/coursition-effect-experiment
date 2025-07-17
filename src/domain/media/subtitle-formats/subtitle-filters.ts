import { Effect as E } from 'effect'
import { type SubtitleItem } from './subtitle-formats.schema'

/**
 * Generic subtitle filter functions for use in streaming processing pipelines
 * These functions work on individual SubtitleItem objects and can be composed and chained together
 */

/**
 * Replaces subtitle text with a specified replacement text
 * Preserves speaker information if already present in the text
 * 
 * @param replacementText - The text to replace subtitle content with
 * @returns Function that takes a subtitle item and returns it with replaced text
 */
export const replaceText = (replacementText: string) => (subtitle: SubtitleItem): SubtitleItem => {
  // Check if the current text has a speaker prefix (e.g., "[Speaker 1]: ")
  const speakerMatch = subtitle.text.match(/^\[Speaker \d+\]:\s*/)
  
  if (speakerMatch) {
    // Preserve the speaker prefix and replace only the content
    return {
      ...subtitle,
      text: `${speakerMatch[0]}${replacementText}`
    }
  } else {
    // No speaker prefix, replace entire text
    return {
      ...subtitle,
      text: replacementText
    }
  }
}

/**
 * Adds a timing offset to a subtitle
 * 
 * @param offset - The offset in milliseconds to add to start and end times
 * @returns Function that takes a subtitle item and returns it with adjusted timing
 */
export const addTimingOffset = (offset: number) => (subtitle: SubtitleItem): SubtitleItem => ({
      ...subtitle,
      start: Math.max(0, subtitle.start + offset),
      end: subtitle.end + offset
})

/**
 * Filters a subtitle by speaker ID
 * 
 * @param speakerId - The speaker ID to filter by
 * @returns Function that takes a subtitle item and returns it if it matches, or null if it doesn't
 */
export const filterBySpeaker = (speakerId: number) => (subtitle: SubtitleItem): SubtitleItem | null => 
  subtitle.speaker === speakerId ? subtitle : null

/**
 * Filters a subtitle by multiple speaker IDs
 * 
 * @param speakerIds - Array of speaker IDs to include
 * @returns Function that takes a subtitle item and returns it if it matches, or null if it doesn't
 */
export const filterBySpeakers = (speakerIds: number[]) => (subtitle: SubtitleItem): SubtitleItem | null => 
  subtitle.speaker !== undefined && speakerIds.includes(subtitle.speaker) ? subtitle : null

/**
 * Adds a custom prefix to subtitle text
 * 
 * @param prefix - The prefix to add to the subtitle
 * @returns Function that takes a subtitle item and returns it with added prefix
 */
export const addPrefix = (prefix: string) => (subtitle: SubtitleItem): SubtitleItem => ({
      ...subtitle,
      text: `${prefix} ${subtitle.text}`
})

/**
 * Adds a custom suffix to subtitle text
 * 
 * @param suffix - The suffix to add to the subtitle
 * @returns Function that takes a subtitle item and returns it with added suffix
 */
export const addSuffix = (suffix: string) => (subtitle: SubtitleItem): SubtitleItem => ({
      ...subtitle,
      text: `${subtitle.text} ${suffix}`
})

/**
 * Filters a subtitle by duration (keeps only subtitles within specified duration range)
 * 
 * @param minDuration - Minimum duration in milliseconds
 * @param maxDuration - Maximum duration in milliseconds
 * @returns Function that takes a subtitle item and returns it if duration matches, or null if it doesn't
 */
export const filterByDuration = (minDuration: number, maxDuration: number) => (subtitle: SubtitleItem): SubtitleItem | null => {
      const duration = subtitle.end - subtitle.start
  return duration >= minDuration && duration <= maxDuration ? subtitle : null
}

/**
 * Filters a subtitle by time range (keeps only subtitles that overlap with specified time range)
 * 
 * @param startTime - Start time in milliseconds
 * @param endTime - End time in milliseconds
 * @returns Function that takes a subtitle item and returns it if it overlaps, or null if it doesn't
 */
export const filterByTimeRange = (startTime: number, endTime: number) => (subtitle: SubtitleItem): SubtitleItem | null => 
  subtitle.start < endTime && subtitle.end > startTime ? subtitle : null

/**
 * Transforms text using a custom function
 * 
 * @param textTransformer - Function to transform subtitle text
 * @returns Function that takes a subtitle item and returns it with transformed text
 */
export const transformText = (textTransformer: (text: string) => string) => (subtitle: SubtitleItem): SubtitleItem => ({
      ...subtitle,
      text: textTransformer(subtitle.text)
})

/**
 * Converts text to uppercase
 * 
 * @returns Function that takes a subtitle item and returns it with uppercase text
 */
export const toUpperCase = (subtitle: SubtitleItem): SubtitleItem => ({
      ...subtitle,
      text: subtitle.text.toUpperCase()
})

/**
 * Converts text to lowercase
 * 
 * @returns Function that takes a subtitle item and returns it with lowercase text
 */
export const toLowerCase = (subtitle: SubtitleItem): SubtitleItem => ({
      ...subtitle,
      text: subtitle.text.toLowerCase()
})

/**
 * Capitalizes the first letter of a subtitle
 * 
 * @returns Function that takes a subtitle item and returns it with capitalized text
 */
export const capitalize = (subtitle: SubtitleItem): SubtitleItem => ({
      ...subtitle,
      text: subtitle.text.charAt(0).toUpperCase() + subtitle.text.slice(1)
})

/**
 * Filters out subtitles with empty or whitespace-only text
 * 
 * @returns Function that takes a subtitle item and returns it if not empty, or null if empty
 */
export const removeEmptySubtitles = (subtitle: SubtitleItem): SubtitleItem | null => 
  subtitle.text.trim().length > 0 ? subtitle : null

/**
 * Debug function that logs subtitle information
 * 
 * @param label - Optional label for the debug output
 * @returns Function that takes a subtitle item, logs it, and returns it unchanged
 */
export const debugSubtitle = (label?: string) => (subtitle: SubtitleItem): SubtitleItem => {
  console.log(`${label ? `[${label}] ` : ''}Subtitle:`, {
    start: subtitle.start,
    end: subtitle.end,
    text: subtitle.text,
    speaker: subtitle.speaker
  })
  return subtitle
}

/**
 * Validates a subtitle item and returns it if valid, or null if invalid
 * 
 * @returns Function that takes a subtitle item and validates it
 */
export const validateSubtitle = (subtitle: SubtitleItem): SubtitleItem | null => {
  // Basic validation rules
  if (subtitle.start < 0) return null
  if (subtitle.end <= subtitle.start) return null
  if (subtitle.text.trim().length === 0) return null
  
  return subtitle
}

/**
 * Composes multiple filter functions into a single function
 * Each filter is applied in sequence, and if any filter returns null, the result is null
 * 
 * @param filters - Array of filter functions to compose
 * @returns Composed filter function
 */
export const composeFilters = <T extends SubtitleItem | null>(
  ...filters: Array<(subtitle: SubtitleItem) => T>
) => (subtitle: SubtitleItem): T => {
  return filters.reduce((result, filter) => {
    if (result === null) return null as T
    return filter(result)
  }, subtitle as T)
}

/**
 * Conditional filter that applies a filter only if a predicate is true
 * 
 * @param predicate - Function that determines if the filter should be applied
 * @param filter - Filter function to apply conditionally
 * @returns Conditional filter function
 */
export const conditionalFilter = (
  predicate: (subtitle: SubtitleItem) => boolean,
  filter: (subtitle: SubtitleItem) => SubtitleItem | null
) => (subtitle: SubtitleItem): SubtitleItem | null => 
  predicate(subtitle) ? filter(subtitle) : subtitle

/**
 * Utility function to convert array-based operations to streaming operations
 * This is useful for backward compatibility or when you need to process arrays
 * 
 * @param filter - Single item filter function
 * @returns Array-based filter function
 */
export const toArrayFilter = <T extends SubtitleItem | null>(
  filter: (subtitle: SubtitleItem) => T
) => (subtitles: SubtitleItem[]): T[] => 
  subtitles.map(filter).filter((item): item is T => item !== null)

/**
 * Utility function to convert streaming operations to array-based operations
 * This is useful for testing or when you need to process arrays
 * 
 * @param arrayFilter - Array-based filter function
 * @returns Single item filter function
 */
export const fromArrayFilter = <T extends SubtitleItem | null>(
  arrayFilter: (subtitles: SubtitleItem[]) => T[]
) => (subtitle: SubtitleItem): T => {
  const result = arrayFilter([subtitle])
  return result.length > 0 ? result[0]! : null as T
} 