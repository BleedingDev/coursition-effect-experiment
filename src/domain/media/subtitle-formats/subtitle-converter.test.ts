import { describe, expect, it } from '@effect/vitest'
import { Effect as E } from 'effect'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  SubtitleConverterLive,
  processSubtitles,
  validateSubtitleData,
  runSubtitleProcessingStream,
  runSubtitleConversionStream,
  type SubtitleItem
} from './subtitle-converter'
import {
  InvalidTimingError,
  UnsupportedFormatError,
} from './subtitle-formats.errors'
import {
  replaceText,
  addTimingOffset,
  filterBySpeaker,
  addPrefix
} from './subtitle-filters'

/**
 * Sample subtitle data for testing
 */
const sampleSubtitles: SubtitleItem[] = [
  { start: 0, end: 5000, text: 'Hello world' },
  { start: 5000, end: 10000, text: 'This is a test' },
  { start: 10000, end: 15000, text: 'Subtitle processing', speaker: 1 },
]

/**
 * Utility functions to convert single-item filters to array-based filters for testing
 * These maintain backward compatibility with existing tests
 */
const replaceTextArray = (replacementText: string) => (subtitles: SubtitleItem[]) =>
  E.sync(() => subtitles.map(replaceText(replacementText)))

const addTimingOffsetArray = (offset: number) => (subtitles: SubtitleItem[]) =>
  E.sync(() => subtitles.map(addTimingOffset(offset)))

const filterBySpeakerArray = (speakerId: number) => (subtitles: SubtitleItem[]) =>
  E.sync(() => subtitles.map(filterBySpeaker(speakerId)).filter((item): item is SubtitleItem => item !== null))

const addPrefixArray = (prefix: string) => (subtitles: SubtitleItem[]) =>
  E.sync(() => subtitles.map(addPrefix(prefix)))

/**
 * Invalid subtitle data for testing error cases
 */
const invalidSubtitles = [
  { start: -1000, end: 5000, text: 'Negative start time' },
  { start: 5000, end: 3000, text: 'End before start' },
  { start: 10000, end: 15000, text: '' }, // Empty text
]

/**
 * Returns a new array with the items in reverse order.
 * @param arr Array to reverse
 */
function reverseArray<T>(arr: T[]): T[] {
  return [...arr].reverse();
}

describe('SubtitleConverter', () => {
  describe('validateSubtitleData', () => {
    it.effect('should validate correct subtitle data', () =>
      E.gen(function* () {
        const result = yield* validateSubtitleData(sampleSubtitles)
        expect(result).toEqual(sampleSubtitles)
      })
    )

    it.effect('should reject invalid subtitle data', () =>
      E.gen(function* () {
        const result = yield* validateSubtitleData(invalidSubtitles as any)
        expect('reason' in result).toBe(true)
      }).pipe(E.catchAll(E.succeed))
    )

    it.effect('should reject empty subtitle array', () =>
      E.gen(function* () {
        const result = yield* validateSubtitleData([])
        expect('reason' in result).toBe(true)
        if ('reason' in result) {
          expect(result.reason).toBe('Subtitle data must be a non-empty array')
        }
      }).pipe(E.catchAll(E.succeed))
    )

    it.effect('should reject null subtitle data', () =>
      E.gen(function* () {
        const result = yield* validateSubtitleData(null as any)
        expect('reason' in result).toBe(true)
      }).pipe(E.catchAll(E.succeed))
    )
  })

  describe('processSubtitles', () => {
    it.effect('should process subtitles with timing offset', () =>
      E.gen(function* () {
        const result = yield* processSubtitles(sampleSubtitles, {
          timingOffset: 1000,
        })

        expect(result).toHaveLength(3)
        expect(result[0]?.start).toBe(1000)
        expect(result[0]?.end).toBe(6000)
        expect(result[1]?.start).toBe(6000)
        expect(result[1]?.end).toBe(11000)
      })
    )

    it.effect('should process subtitles with speaker info', () =>
      E.gen(function* () {
        const result = yield* processSubtitles(sampleSubtitles, {
          includeSpeaker: true,
        })

        expect(result).toHaveLength(3)
        expect(result[0]?.text).toBe('Hello world')
        expect(result[1]?.text).toBe('This is a test')
        expect(result[2]?.text).toBe('[Speaker 1]: Subtitle processing')
      })
    )

    it.effect('should process subtitles in correct order: timing → clean → speaker', () =>
      E.gen(function* () {
        const messySubtitles: SubtitleItem[] = [
          { start: 0, end: 5000, text: '  Hello   world  ', speaker: 1 },
          { start: 5000, end: 10000, text: '  This is a test  ' },
        ]

        const result = yield* processSubtitles(messySubtitles, {
          timingOffset: 1000,
          includeSpeaker: true,
        })

        expect(result).toHaveLength(2)
        expect(result[0]?.text).toBe('[Speaker 1]: Hello world')
        expect(result[0]?.start).toBe(1000)
        expect(result[1]?.text).toBe('This is a test')
        expect(result[1]?.start).toBe(6000)
      })
    )

    it.effect('should merge adjacent subtitles', () =>
      E.gen(function* () {
        const closeSubtitles: SubtitleItem[] = [
          { start: 0, end: 5000, text: 'Hello' },
          { start: 5000, end: 10000, text: 'world' },
          { start: 10000, end: 15000, text: 'This is' },
          { start: 15000, end: 20000, text: 'a test' },
        ]

        const result = yield* processSubtitles(closeSubtitles, {
          mergeAdjacent: true,
          mergeThreshold: 1000,
        })

        expect(result).toHaveLength(1)
        expect(result[0]?.text).toBe('Hello world This is a test')
        expect(result[0]?.start).toBe(0)
        expect(result[0]?.end).toBe(20000)
      })
    )

    it.effect('should handle single subtitle without merging', () =>
      E.gen(function* () {
        const singleSubtitle = [{ start: 0, end: 5000, text: 'Hello world' }]
        const result = yield* processSubtitles(singleSubtitle, {
          mergeAdjacent: true,
          mergeThreshold: 1000,
        })

        expect(result).toHaveLength(1)
        expect(result[0]?.text).toBe('Hello world')
      })
    )

    it.effect('should process subtitles and print valid SRT file', () =>
      E.gen(function* () {
        // Create a more complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          { start: 0, end: 3000, text: 'Welcome to our presentation', speaker: 1 },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          { start: 6000, end: 9000, text: 'the future of technology', speaker: 2 },
          { start: 9000, end: 12000, text: 'and its impact on society', speaker: 2 },
          { start: 12000, end: 15000, text: 'Thank you for your attention', speaker: 1 },
        ]

        // Process the subtitles with various options (without merging to see individual entries)
        const processedSubtitles = yield* processSubtitles(complexSubtitles, {
          timingOffset: 500,
          includeSpeaker: true,
          cleanText: true,
          mergeAdjacent: false, // Disable merging to see individual subtitle entries
        })

        // Convert to SRT format
        const srtContent = yield* SubtitleConverterLive.convert(processedSubtitles, 'srt')

        // Print the SRT content
        console.log('\n=== Generated SRT File ===')
        console.log(srtContent)
        console.log('=== End SRT File ===\n')

        // Verify the SRT content is valid
        expect(srtContent).toContain('1\n')
        expect(srtContent).toContain('00:00:00,500 --> 00:00:03,500\n')
        expect(srtContent).toContain('[Speaker 1]: Welcome to our presentation\n')
        expect(srtContent).toContain('2\n')
        expect(srtContent).toContain('00:00:03,500 --> 00:00:06,500\n')
        expect(srtContent).toContain('[Speaker 1]: Today we will discuss\n')
        expect(srtContent).toContain('3\n')
        expect(srtContent).toContain('00:00:06,500 --> 00:00:09,500\n')
        expect(srtContent).toContain('[Speaker 2]: the future of technology\n')
        expect(srtContent).toContain('4\n')
        expect(srtContent).toContain('00:00:09,500 --> 00:00:12,500\n')
        expect(srtContent).toContain('[Speaker 2]: and its impact on society\n')
        expect(srtContent).toContain('5\n')
        expect(srtContent).toContain('00:00:12,500 --> 00:00:15,500\n')
        expect(srtContent).toContain('[Speaker 1]: Thank you for your attention\n')

        // Verify the structure is correct (number, timing, text, empty line)
        const lines = srtContent.split('\n')
        expect(lines).toContain('1')
        expect(lines).toContain('2')
        expect(lines).toContain('3')
        expect(lines).toContain('4')
        expect(lines).toContain('5')
        expect(lines).toContain('') // Empty lines between subtitles

        console.log(`Processed ${processedSubtitles.length} subtitles into SRT format`)
        console.log(`SRT file contains ${lines.length} lines`)
        console.log(`Original subtitles: ${complexSubtitles.length}, Processed subtitles: ${processedSubtitles.length}`)
      })
    )

    it.effect('should process subtitles and print valid JSON format', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          { start: 0, end: 3000, text: 'Welcome to our presentation', speaker: 1 },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          { start: 6000, end: 9000, text: 'the future of technology', speaker: 2 },
          { start: 9000, end: 12000, text: 'and its impact on society', speaker: 2 },
          { start: 12000, end: 15000, text: 'Thank you for your attention', speaker: 1 },
        ]

        // Process the subtitles with various options
        const processedSubtitles = yield* processSubtitles(complexSubtitles, {
          timingOffset: 500,
          includeSpeaker: true,
          cleanText: true,
          mergeAdjacent: false,
        })

        // Convert to JSON format
        const jsonContent = yield* SubtitleConverterLive.convert(processedSubtitles, 'json')

        // Print the JSON content
        console.log('\n=== Generated JSON Format ===')
        console.log(jsonContent)
        console.log('=== End JSON Format ===\n')

        // Parse and verify the JSON content
        const parsedJson = JSON.parse(jsonContent)
        expect(Array.isArray(parsedJson)).toBe(true)
        expect(parsedJson).toHaveLength(5)

        // Verify the structure of each subtitle
        expect(parsedJson[0]).toEqual({
          start: 500,
          end: 3500,
          text: '[Speaker 1]: Welcome to our presentation',
          speaker: 1
        })

        expect(parsedJson[1]).toEqual({
          start: 3500,
          end: 6500,
          text: '[Speaker 1]: Today we will discuss',
          speaker: 1
        })

        expect(parsedJson[2]).toEqual({
          start: 6500,
          end: 9500,
          text: '[Speaker 2]: the future of technology',
          speaker: 2
        })

        expect(parsedJson[3]).toEqual({
          start: 9500,
          end: 12500,
          text: '[Speaker 2]: and its impact on society',
          speaker: 2
        })

        expect(parsedJson[4]).toEqual({
          start: 12500,
          end: 15500,
          text: '[Speaker 1]: Thank you for your attention',
          speaker: 1
        })

        console.log(`Processed ${processedSubtitles.length} subtitles into JSON format`)
        console.log(`JSON contains ${parsedJson.length} subtitle entries`)
      })
    )

    it.effect('should process subtitles and print valid VTT format', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          { start: 0, end: 3000, text: 'Welcome to our presentation', speaker: 1 },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          { start: 6000, end: 9000, text: 'the future of technology', speaker: 2 },
          { start: 9000, end: 12000, text: 'and its impact on society', speaker: 2 },
          { start: 12000, end: 15000, text: 'Thank you for your attention', speaker: 1 },
        ]

        // Process the subtitles with various options
        const processedSubtitles = yield* processSubtitles(complexSubtitles, {
          timingOffset: 500,
          includeSpeaker: true,
          cleanText: true,
          mergeAdjacent: false,
        })

        // Convert to VTT format
        const vttContent = yield* SubtitleConverterLive.convert(processedSubtitles, 'vtt')

        // Print the VTT content
        console.log('\n=== Generated VTT Format ===')
        console.log(vttContent)
        console.log('=== End VTT Format ===\n')

        // Verify the VTT content is valid
        expect(vttContent).toContain('WEBVTT\n')
        expect(vttContent).toContain('00:00:00.500 --> 00:00:03.500\n')
        expect(vttContent).toContain('[Speaker 1]: Welcome to our presentation\n')
        expect(vttContent).toContain('00:00:03.500 --> 00:00:06.500\n')
        expect(vttContent).toContain('[Speaker 1]: Today we will discuss\n')
        expect(vttContent).toContain('00:00:06.500 --> 00:00:09.500\n')
        expect(vttContent).toContain('[Speaker 2]: the future of technology\n')
        expect(vttContent).toContain('00:00:09.500 --> 00:00:12.500\n')
        expect(vttContent).toContain('[Speaker 2]: and its impact on society\n')
        expect(vttContent).toContain('00:00:12.500 --> 00:00:15.500\n')
        expect(vttContent).toContain('[Speaker 1]: Thank you for your attention\n')

        // Verify VTT-specific format (uses dots instead of commas for milliseconds)
        expect(vttContent).toMatch(/WEBVTT/)
        expect(vttContent).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/)

        // Verify the structure is correct
        const lines = vttContent.split('\n')
        expect(lines[0]).toBe('WEBVTT')
        expect(lines).toContain('') // Empty lines between subtitles

        console.log(`Processed ${processedSubtitles.length} subtitles into VTT format`)
        console.log(`VTT file contains ${lines.length} lines`)
      })
    )

    it.effect('should process subtitles and print valid plain text format', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          { start: 0, end: 3000, text: 'Welcome to our presentation', speaker: 1 },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          { start: 6000, end: 9000, text: 'the future of technology', speaker: 2 },
          { start: 9000, end: 12000, text: 'and its impact on society', speaker: 2 },
          { start: 12000, end: 15000, text: 'Thank you for your attention', speaker: 1 },
        ]

        // Process the subtitles with various options
        const processedSubtitles = yield* processSubtitles(complexSubtitles, {
          timingOffset: 500,
          includeSpeaker: true,
          cleanText: true,
          mergeAdjacent: false,
        })

        // Convert to plain text format
        const textContent = yield* SubtitleConverterLive.convert(processedSubtitles, 'plain-text')

        // Print the plain text content
        console.log('\n=== Generated Plain Text Format ===')
        console.log(textContent)
        console.log('=== End Plain Text Format ===\n')

        // Verify the plain text content is valid
        expect(textContent).toContain('[Speaker 1]: Welcome to our presentation')
        expect(textContent).toContain('[Speaker 1]: Today we will discuss')
        expect(textContent).toContain('[Speaker 2]: the future of technology')
        expect(textContent).toContain('[Speaker 2]: and its impact on society')
        expect(textContent).toContain('[Speaker 1]: Thank you for your attention')

        // Verify the structure (text separated by double newlines)
        const lines = textContent.split('\n')
        expect(lines).toContain('[Speaker 1]: Welcome to our presentation')
        expect(lines).toContain('[Speaker 1]: Today we will discuss')
        expect(lines).toContain('[Speaker 2]: the future of technology')
        expect(lines).toContain('[Speaker 2]: and its impact on society')
        expect(lines).toContain('[Speaker 1]: Thank you for your attention')
        expect(lines).toContain('') // Empty lines between subtitles

        // Verify no timing information is included in plain text
        expect(textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/)
        expect(textContent).not.toMatch(/-->/)

        console.log(`Processed ${processedSubtitles.length} subtitles into plain text format`)
        console.log(`Plain text contains ${lines.length} lines`)
      })
    )

    it.effect('should process subtitles and print all formats for comparison', () =>
      E.gen(function* () {
        // Create a simple subtitle dataset for format comparison
        const simpleSubtitles: SubtitleItem[] = [
          { start: 0, end: 3000, text: 'Hello world', speaker: 1 },
          { start: 3000, end: 6000, text: 'This is a test', speaker: 2 },
        ]

        // Process the subtitles with basic options
        const processedSubtitles = yield* processSubtitles(simpleSubtitles, {
          timingOffset: 1000,
          includeSpeaker: true,
          cleanText: true,
          mergeAdjacent: false,
        })

        // Convert to all formats
        const jsonContent = yield* SubtitleConverterLive.convert(processedSubtitles, 'json')
        const srtContent = yield* SubtitleConverterLive.convert(processedSubtitles, 'srt')
        const vttContent = yield* SubtitleConverterLive.convert(processedSubtitles, 'vtt')
        const textContent = yield* SubtitleConverterLive.convert(processedSubtitles, 'plain-text')

        // Print all formats for comparison
        console.log('\n=== Format Comparison ===')
        console.log('JSON Format:')
        console.log(jsonContent)
        console.log('\nSRT Format:')
        console.log(srtContent)
        console.log('\nVTT Format:')
        console.log(vttContent)
        console.log('\nPlain Text Format:')
        console.log(textContent)
        console.log('=== End Format Comparison ===\n')

        // Verify each format has the correct structure
        const parsedJson = JSON.parse(jsonContent)
        expect(parsedJson).toHaveLength(2)
        expect(parsedJson[0].text).toBe('[Speaker 1]: Hello world')

        expect(srtContent).toContain('1\n')
        expect(srtContent).toContain('00:00:01,000 --> 00:00:04,000\n')
        expect(srtContent).toContain('[Speaker 1]: Hello world\n')

        expect(vttContent).toContain('WEBVTT\n')
        expect(vttContent).toContain('00:00:01.000 --> 00:00:04.000\n')
        expect(vttContent).toContain('[Speaker 1]: Hello world\n')

        expect(textContent).toBe('[Speaker 1]: Hello world\n\n[Speaker 2]: This is a test')

        console.log('All formats generated successfully!')
        console.log(`JSON: ${parsedJson.length} entries`)
        console.log(`SRT: ${srtContent.split('\\n').length} lines`)
        console.log(`VTT: ${vttContent.split('\\n').length} lines`)
        console.log(`Plain Text: ${textContent.split('\\n').length} lines`)
      })
    )

    it.effect('should demonstrate file output function for all formats', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          { start: 0, end: 3000, text: 'Welcome to our presentation', speaker: 1 },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          { start: 6000, end: 9000, text: 'the future of technology', speaker: 2 },
          { start: 9000, end: 12000, text: 'and its impact on society', speaker: 2 },
          { start: 12000, end: 15000, text: 'Thank you for your attention', speaker: 1 },
        ]

        // Process the subtitles
        const processedSubtitles = yield* processSubtitles(complexSubtitles, {
          timingOffset: 500,
          includeSpeaker: true,
          cleanText: true,
          mergeAdjacent: false,
        })

        // Function to create file output string
        const createFileOutput = (content: string, format: string, metadata?: {
          originalCount?: number
          processedCount?: number
          processingOptions?: any
        }) => {
          const timestamp = new Date().toISOString()
          const header = [
            `# Subtitle File Generated by SubtitleConverter`,
            `# Format: ${format.toUpperCase()}`,
            `# Generated: ${timestamp}`,
            `# Original Subtitles: ${metadata?.originalCount || 'unknown'}`,
            `# Processed Subtitles: ${metadata?.processedCount || 'unknown'}`,
            `# Processing Options: ${JSON.stringify(metadata?.processingOptions || {}, null, 2)}`,
            `# ========================================`,
            ``,
          ].join('\n')

          const footer = [
            ``,
            `# ========================================`,
            `# End of ${format.toUpperCase()} file`,
            `# Total lines: ${content.split('\n').length}`,
            `# File size: ${new Blob([content]).size} bytes`,
          ].join('\n')

          return header + content + footer
        }

        // Convert to all formats and create file outputs
        const jsonContent = yield* SubtitleConverterLive.convert(processedSubtitles, 'json')
        const srtContent = yield* SubtitleConverterLive.convert(processedSubtitles, 'srt')
        const vttContent = yield* SubtitleConverterLive.convert(processedSubtitles, 'vtt')
        const textContent = yield* SubtitleConverterLive.convert(processedSubtitles, 'plain-text')

        // Create file outputs with metadata
        const jsonFileOutput = createFileOutput(jsonContent, 'json', {
          originalCount: complexSubtitles.length,
          processedCount: processedSubtitles.length,
          processingOptions: {
            timingOffset: 500,
            includeSpeaker: true,
            cleanText: true,
            mergeAdjacent: false
          }
        })

        const srtFileOutput = createFileOutput(srtContent, 'srt', {
          originalCount: complexSubtitles.length,
          processedCount: processedSubtitles.length,
          processingOptions: {
            timingOffset: 500,
            includeSpeaker: true,
            cleanText: true,
            mergeAdjacent: false
          }
        })

        const vttFileOutput = createFileOutput(vttContent, 'vtt', {
          originalCount: complexSubtitles.length,
          processedCount: processedSubtitles.length,
          processingOptions: {
            timingOffset: 500,
            includeSpeaker: true,
            cleanText: true,
            mergeAdjacent: false
          }
        })

        const textFileOutput = createFileOutput(textContent, 'plain-text', {
          originalCount: complexSubtitles.length,
          processedCount: processedSubtitles.length,
          processingOptions: {
            timingOffset: 500,
            includeSpeaker: true,
            cleanText: true,
            mergeAdjacent: false
          }
        })

        // Print all file outputs
        console.log('\n=== JSON File Output ===')
        console.log(jsonFileOutput)
        console.log('\n=== SRT File Output ===')
        console.log(srtFileOutput)
        console.log('\n=== VTT File Output ===')
        console.log(vttFileOutput)
        console.log('\n=== Plain Text File Output ===')
        console.log(textFileOutput)

        // Verify the file outputs contain the expected content
        expect(jsonFileOutput).toContain('# Subtitle File Generated by SubtitleConverter')
        expect(jsonFileOutput).toContain('# Format: JSON')
        expect(jsonFileOutput).toContain('"text": "[Speaker 1]: Welcome to our presentation"')

        expect(srtFileOutput).toContain('# Format: SRT')
        expect(srtFileOutput).toContain('1\n')
        expect(srtFileOutput).toContain('00:00:00,500 --> 00:00:03,500')

        expect(vttFileOutput).toContain('# Format: VTT')
        expect(vttFileOutput).toContain('WEBVTT')
        expect(vttFileOutput).toContain('00:00:00.500 --> 00:00:03.500')

        expect(textFileOutput).toContain('# Format: PLAIN-TEXT')
        expect(textFileOutput).toContain('[Speaker 1]: Welcome to our presentation')
        // Check that the actual subtitle content doesn't contain timing (only the header metadata does)
        expect(textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/) // No timing in plain text content
        expect(textContent).not.toMatch(/-->/)

        console.log('\n=== File Output Summary ===')
        console.log(`JSON file size: ${new Blob([jsonFileOutput]).size} bytes`)
        console.log(`SRT file size: ${new Blob([srtFileOutput]).size} bytes`)
        console.log(`VTT file size: ${new Blob([vttFileOutput]).size} bytes`)
        console.log(`Plain text file size: ${new Blob([textFileOutput]).size} bytes`)
      })
    )

    it.effect('should demonstrate pipe output to file string function', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          { start: 0, end: 3000, text: 'Welcome to our presentation', speaker: 1 },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          { start: 6000, end: 9000, text: 'the future of technology', speaker: 2 },
          { start: 9000, end: 12000, text: 'and its impact on society', speaker: 2 },
          { start: 12000, end: 15000, text: 'Thank you for your attention', speaker: 1 },
        ]

        // Function that takes pipe output and returns formatted file string
        const pipeOutputToFileString = (
          pipeResult: any, 
          format: 'json' | 'srt' | 'vtt' | 'plain-text',
          filename?: string
        ) => {
          const timestamp = new Date().toISOString()
          const fileExtension = format === 'plain-text' ? 'txt' : format
          const defaultFilename = `subtitles_${timestamp.replace(/[:.]/g, '-')}.${fileExtension}`
          
          const header = [
            `# Subtitle File: ${filename || defaultFilename}`,
            `# Format: ${format.toUpperCase()}`,
            `# Generated: ${timestamp}`,
            `# Source: SubtitleConverter Pipeline`,
            `# ========================================`,
            ``,
          ].join('\n')

          const footer = [
            ``,
            `# ========================================`,
            `# End of file`,
            `# Generated by SubtitleConverter`,
          ].join('\n')

          return header + pipeResult + footer
        }

        // Simulate pipe output (this could be the result of a complex pipeline)
        const pipeOutput = yield* E.succeed(complexSubtitles)
          .pipe(
            E.flatMap((subtitles) => processSubtitles(subtitles, {
              timingOffset: 1000,
              includeSpeaker: true,
              cleanText: true,
              mergeAdjacent: false, // Disable merging to get individual subtitles
              mergeThreshold: 2000
            })),
            E.flatMap((processed) => SubtitleConverterLive.convert(processed, 'srt')),
            E.map((srtContent) => pipeOutputToFileString(srtContent, 'srt', 'presentation_subtitles.srt'))
          )

        console.log('\n=== Pipe Output to File String ===')
        console.log(pipeOutput)

        // Verify the pipe output contains the expected content
        expect(pipeOutput).toContain('# Subtitle File: presentation_subtitles.srt')
        expect(pipeOutput).toContain('# Format: SRT')
        expect(pipeOutput).toContain('1\n')
        expect(pipeOutput).toContain('00:00:01,000 --> 00:00:04,000')
        expect(pipeOutput).toContain('[Speaker 1]: Welcome to our presentation')

        console.log(`\nPipe output file size: ${new Blob([pipeOutput]).size} bytes`)
      })
    )

    it.effect('should demonstrate pipeable text replacement function', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          { start: 0, end: 3000, text: 'Welcome to our presentation', speaker: 1 },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          { start: 6000, end: 9000, text: 'the future of technology', speaker: 2 },
          { start: 9000, end: 12000, text: 'and its impact on society', speaker: 2 },
          { start: 12000, end: 15000, text: 'Thank you for your attention', speaker: 1 },
        ]

        // Function that takes pipe output and returns formatted file string
        const pipeOutputToFileString = (
          pipeResult: any, 
          format: 'json' | 'srt' | 'vtt' | 'plain-text',
          filename?: string
        ) => {
          const timestamp = new Date().toISOString()
          const fileExtension = format === 'plain-text' ? 'txt' : format
          const defaultFilename = `subtitles_${timestamp.replace(/[:.]/g, '-')}.${fileExtension}`
          
          const header = [
            `# Subtitle File: ${filename || defaultFilename}`,
            `# Format: ${format.toUpperCase()}`,
            `# Generated: ${timestamp}`,
            `# Source: SubtitleConverter Pipeline with Text Replacement`,
            `# ========================================`,
            ``,
          ].join('\n')

          const footer = [
            ``,
            `# ========================================`,
            `# End of file`,
            `# Generated by SubtitleConverter`,
          ].join('\n')

          return header + pipeResult + footer
        }

        // Complex pipeline with text replacement in the middle using generic filter
        const pipeOutput = yield* E.succeed(complexSubtitles)
          .pipe(
            // Step 1: Process subtitles with basic options
            E.flatMap((subtitles) => processSubtitles(subtitles, {
              timingOffset: 500,
              includeSpeaker: true,
              cleanText: true,
              mergeAdjacent: false,
            })),
            // Step 2: Replace all text with "Hello world!" using generic filter
            E.flatMap(replaceTextArray('Hello world!')),
            // Step 3: Convert to SRT format
            E.flatMap((processed) => SubtitleConverterLive.convert(processed, 'srt')),
            // Step 4: Format as file output
            E.map((srtContent) => pipeOutputToFileString(srtContent, 'srt', 'hello_world_subtitles.srt'))
          )

        console.log('\n=== Pipe Output with Text Replacement ===')
        console.log(pipeOutput)

        // Verify the pipe output contains the expected content
        expect(pipeOutput).toContain('# Subtitle File: hello_world_subtitles.srt')
        expect(pipeOutput).toContain('# Format: SRT')
        expect(pipeOutput).toContain('# Source: SubtitleConverter Pipeline with Text Replacement')
        expect(pipeOutput).toContain('1\n')
        expect(pipeOutput).toContain('00:00:00,500 --> 00:00:03,500')
        expect(pipeOutput).toContain('[Speaker 1]: Hello world!')
        expect(pipeOutput).toContain('2\n')
        expect(pipeOutput).toContain('00:00:03,500 --> 00:00:06,500')
        expect(pipeOutput).toContain('[Speaker 1]: Hello world!')
        expect(pipeOutput).toContain('3\n')
        expect(pipeOutput).toContain('00:00:06,500 --> 00:00:09,500')
        expect(pipeOutput).toContain('[Speaker 2]: Hello world!')

        // Verify that all original text has been replaced
        expect(pipeOutput).not.toContain('Welcome to our presentation')
        expect(pipeOutput).not.toContain('Today we will discuss')
        expect(pipeOutput).not.toContain('the future of technology')
        expect(pipeOutput).not.toContain('and its impact on society')
        expect(pipeOutput).not.toContain('Thank you for your attention')

        // Verify that all subtitles now contain "Hello world!"
        const lines = pipeOutput.split('\n')
        const subtitleLines = lines.filter(line => line.includes('Hello world!'))
        expect(subtitleLines).toHaveLength(5) // All 5 subtitles should have "Hello world!"

        console.log(`\nPipe output with text replacement file size: ${new Blob([pipeOutput]).size} bytes`)
        console.log(`All ${subtitleLines.length} subtitles now contain "Hello world!"`)
      })
    )

    it.effect('should demonstrate multiple pipe functions in sequence', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          { start: 0, end: 3000, text: 'Welcome to our presentation', speaker: 1 },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          { start: 6000, end: 9000, text: 'the future of technology', speaker: 2 },
          { start: 9000, end: 12000, text: 'and its impact on society', speaker: 2 },
          { start: 12000, end: 15000, text: 'Thank you for your attention', speaker: 1 },
        ]

        // Complex pipeline with multiple generic filter functions
        const pipeOutput = yield* E.succeed(complexSubtitles)
          .pipe(
            // Step 1: Basic processing
            E.flatMap((subtitles) => processSubtitles(subtitles, {
              includeSpeaker: true,
              cleanText: true,
              mergeAdjacent: false,
            })),
            // Step 2: Replace text with "Hello world!" using generic filter
            E.flatMap(replaceTextArray('Hello world!')),
            // Step 3: Add timing offset using generic filter
            E.flatMap(addTimingOffsetArray(1000)),
            // Step 4: Filter to only speaker 1 using generic filter
            E.flatMap(filterBySpeakerArray(1)),
            // Step 5: Add custom prefix using generic filter
            E.flatMap(addPrefixArray('[CUSTOM]')),
            // Step 6: Convert to JSON format
            E.flatMap((processed) => SubtitleConverterLive.convert(processed, 'json')),
            // Step 7: Parse and verify the result
            E.map((jsonContent) => {
              const parsed = JSON.parse(jsonContent)
              console.log('\n=== Multi-Pipe Output ===')
              console.log('JSON Result:', jsonContent)
              console.log('Parsed Result:', parsed)
              
              // Verify the pipeline worked correctly
              expect(parsed).toHaveLength(3) // Only speaker 1 subtitles
              expect(parsed[0].text).toBe('[CUSTOM] [Speaker 1]: Hello world!')
              expect(parsed[0].start).toBe(1000) // Original 0 + 1000 offset
              expect(parsed[0].end).toBe(4000)   // Original 3000 + 1000 offset
              expect(parsed[1].text).toBe('[CUSTOM] [Speaker 1]: Hello world!')
              expect(parsed[2].text).toBe('[CUSTOM] [Speaker 1]: Hello world!')
              
              return `Pipeline processed ${parsed.length} subtitles successfully!`
            })
          )

        console.log('\n=== Pipeline Summary ===')
        console.log(pipeOutput)
        console.log('All pipe functions executed successfully in sequence!')
      })
    )

    it.effect('should demonstrate composed filters and debug functions', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          { start: 0, end: 3000, text: 'Welcome to our presentation', speaker: 1 },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          { start: 6000, end: 9000, text: 'the future of technology', speaker: 2 },
          { start: 9000, end: 12000, text: 'and its impact on society', speaker: 2 },
          { start: 12000, end: 15000, text: 'Thank you for your attention', speaker: 1 },
        ]

        // Execute the pipeline with individual filters instead of composition
        const result = yield* E.succeed(complexSubtitles)
          .pipe(
            E.flatMap((subtitles) => processSubtitles(subtitles, {
              includeSpeaker: true,
              cleanText: true,
              mergeAdjacent: false,
            })),
            E.flatMap(replaceTextArray('Hello world!')),
            E.flatMap(addTimingOffsetArray(500)),
            E.flatMap(filterBySpeakerArray(1)),
            E.flatMap(addPrefixArray('[COMPOSED]')),
            E.flatMap((processed) => SubtitleConverterLive.convert(processed, 'json'))
          )

        console.log('\n=== Composed Pipeline Output ===')
        console.log(result)

        // Parse and verify the result
        const parsed = JSON.parse(result)
        expect(parsed).toHaveLength(3) // Only speaker 1 subtitles
        expect(parsed[0].text).toBe('[COMPOSED] [Speaker 1]: Hello world!')
        expect(parsed[0].start).toBe(500) // Original 0 + 500 offset
        expect(parsed[0].end).toBe(3500)  // Original 3000 + 500 offset

        console.log('Composed pipeline executed successfully!')
        console.log(`Processed ${parsed.length} subtitles through composed filters`)
      })
    )
  })

  describe('SubtitleConverterLive.convert', () => {
    it.effect('should convert to JSON format', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convert(sampleSubtitles, 'json')
        const parsed = JSON.parse(result)
        expect(parsed).toEqual(sampleSubtitles)
      })
    )

    it.effect('should convert to SRT format', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convert(sampleSubtitles, 'srt')
        
        expect(result).toContain('1\n')
        expect(result).toContain('00:00:00,000 --> 00:00:05,000\n')
        expect(result).toContain('Hello world\n')
        expect(result).toContain('2\n')
        expect(result).toContain('00:00:05,000 --> 00:00:10,000\n')
        expect(result).toContain('This is a test\n')
        expect(result).toContain('3\n')
        expect(result).toContain('00:00:10,000 --> 00:00:15,000\n')
        expect(result).toContain('Subtitle processing\n')
      })
    )

    it.effect('should convert to VTT format', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convert(sampleSubtitles, 'vtt')
        
        expect(result).toContain('WEBVTT\n')
        expect(result).toContain('00:00:00.000 --> 00:00:05.000\n')
        expect(result).toContain('Hello world\n')
        expect(result).toContain('00:00:05.000 --> 00:00:10.000\n')
        expect(result).toContain('This is a test\n')
        expect(result).toContain('00:00:10.000 --> 00:00:15.000\n')
        expect(result).toContain('Subtitle processing\n')
      })
    )

    it.effect('should convert to plain text format', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convert(sampleSubtitles, 'plain-text')
        expect(result).toBe('Hello world\n\nThis is a test\n\nSubtitle processing')
      })
    )

    it.effect('should reject unsupported format', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convert(sampleSubtitles, 'unsupported' as any)
        expect(result).toBeInstanceOf(UnsupportedFormatError)
      }).pipe(E.catchAll(E.succeed))
    )

    it.effect('should convert with processing options', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convert(sampleSubtitles, 'srt', {
          timingOffset: 1000,
          includeSpeaker: true,
        })
        
        expect(result).toContain('00:00:01,000 --> 00:00:06,000\n')
        expect(result).toContain('Hello world\n')
        expect(result).toContain('00:00:06,000 --> 00:00:11,000\n')
        expect(result).toContain('This is a test\n')
        expect(result).toContain('00:00:11,000 --> 00:00:16,000\n')
        expect(result).toContain('[Speaker 1]: Subtitle processing\n')
      })
    )
  })

  describe('SubtitleConverterLive.convertMultiple', () => {
    it.effect('should convert to multiple formats', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convertMultiple(
          sampleSubtitles,
          ['json', 'srt', 'vtt', 'plain-text']
        )

        expect(result.results).toHaveLength(4)
        
        // Check JSON result
        const jsonResult = result.results.find(r => r.format === 'json')
        expect(jsonResult).toBeDefined()
        expect(JSON.parse(jsonResult!.content)).toEqual(sampleSubtitles)
        
        // Check SRT result
        const srtResult = result.results.find(r => r.format === 'srt')
        expect(srtResult).toBeDefined()
        expect(srtResult!.content).toContain('1\n')
        expect(srtResult!.content).toContain('Hello world\n')
        
        // Check VTT result
        const vttResult = result.results.find(r => r.format === 'vtt')
        expect(vttResult).toBeDefined()
        expect(vttResult!.content).toContain('WEBVTT\n')
        expect(vttResult!.content).toContain('Hello world\n')
        
        // Check plain text result
        const textResult = result.results.find(r => r.format === 'plain-text')
        expect(textResult).toBeDefined()
        expect(textResult!.content).toBe('Hello world\n\nThis is a test\n\nSubtitle processing')
      })
    )

    it.effect('should convert to multiple formats with processing options', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convertMultiple(
          sampleSubtitles,
          ['srt', 'vtt'],
          {
            timingOffset: 1000,
            includeSpeaker: true,
          }
        )

        expect(result.results).toHaveLength(2)
        
        // Check SRT result with options
        const srtResult = result.results.find(r => r.format === 'srt')
        expect(srtResult).toBeDefined()
        expect(srtResult!.content).toContain('00:00:01,000 --> 00:00:06,000\n')
        expect(srtResult!.content).toContain('[Speaker 1]: Subtitle processing\n')
        
        // Check VTT result with options
        const vttResult = result.results.find(r => r.format === 'vtt')
        expect(vttResult).toBeDefined()
        expect(vttResult!.content).toContain('00:00:01.000 --> 00:00:06.000\n')
        expect(vttResult!.content).toContain('[Speaker 1]: Subtitle processing\n')
      })
    )
  })

  describe('Edge cases and error handling', () => {
    it.effect('should handle empty text with cleanText option', () =>
      E.gen(function* () {
        const subtitlesWithEmptyText = [
          { start: 0, end: 5000, text: '  ' },
          { start: 5000, end: 10000, text: 'Valid text' },
        ]

        const result = yield* processSubtitles(subtitlesWithEmptyText, {
          cleanText: true,
        })

        expect(result).toHaveLength(1) // Empty text should be filtered out
        expect(result[0]?.text).toBe('Valid text')
      })
    )

    it.effect('should handle negative timing offset', () =>
      E.gen(function* () {
        const result = yield* processSubtitles(sampleSubtitles, {
          timingOffset: -2000,
        })

        expect(result).toHaveLength(3)
        expect(result[0]?.start).toBe(0) // Should not go below 0
        expect(result[0]?.end).toBe(3000)
        expect(result[1]?.start).toBe(3000)
        expect(result[1]?.end).toBe(8000)
      })
    )

    it.effect('should handle speaker info with undefined speaker', () =>
      E.gen(function* () {
        const subtitlesWithoutSpeaker = [
          { start: 0, end: 5000, text: 'Hello world' },
          { start: 5000, end: 10000, text: 'This is a test' },
        ]

        const result = yield* processSubtitles(subtitlesWithoutSpeaker, {
          includeSpeaker: true,
        })

        expect(result).toHaveLength(2)
        expect(result[0]?.text).toBe('Hello world') // No speaker prefix
        expect(result[1]?.text).toBe('This is a test') // No speaker prefix
      })
    )

    it.effect('should handle merging with different speakers', () =>
      E.gen(function* () {
        const subtitlesWithDifferentSpeakers = [
          { start: 0, end: 5000, text: 'Hello', speaker: 1 },
          { start: 5000, end: 10000, text: 'world', speaker: 2 },
        ]

        const result = yield* processSubtitles(subtitlesWithDifferentSpeakers, {
          mergeAdjacent: true,
          mergeThreshold: 1000,
        })

        expect(result).toHaveLength(1)
        expect(result[0]?.text).toBe('Hello world')
        expect(result[0]?.speaker).toBeUndefined() // Should be undefined when speakers differ
      })
    )
  })

  describe('Effect Pipes Integration', () => {
    it.effect('should work with pipe operations', () =>
      E.gen(function* () {
        const result = yield* E.succeed(sampleSubtitles)
          .pipe(
            E.tap((subtitles) => E.sync(() => expect(subtitles).toHaveLength(3))),
            E.flatMap((subtitles) => SubtitleConverterLive.convert(subtitles, 'json')),
            E.map((json) => JSON.parse(json)),
            E.tap((parsed) => E.sync(() => expect(parsed).toEqual(sampleSubtitles)))
          )
        
        expect(result).toEqual(sampleSubtitles)
      })
    )

    it.effect('should handle errors in pipes', () =>
      E.gen(function* () {
        const result = yield* E.succeed(invalidSubtitles)
          .pipe(
            E.flatMap((subtitles) => SubtitleConverterLive.convert(subtitles as any, 'json')),
            E.catchAll((error) => E.succeed(error))
          )
        
        // The first validation error will be InvalidTimingError for negative start time
        expect(result).toBeInstanceOf(InvalidTimingError)
      })
    )

    it.effect('should chain multiple operations with pipes', () =>
      E.gen(function* () {
        const result = yield* E.succeed(sampleSubtitles)
          .pipe(
            E.tap(() => E.sync(() => console.log('Starting conversion'))),
            E.flatMap((subtitles) => SubtitleConverterLive.convert(subtitles, 'srt')),
            E.tap((srt) => E.sync(() => expect(srt).toContain('Hello world'))),
            E.flatMap(() => SubtitleConverterLive.convert(sampleSubtitles, 'vtt')),
            E.tap((vtt) => E.sync(() => expect(vtt).toContain('WEBVTT'))),
            E.flatMap(() => SubtitleConverterLive.convert(sampleSubtitles, 'plain-text')),
            E.map((text) => text.split('\n').length)
          )
        
        expect(result).toBe(5) // 3 subtitles + 2 empty lines
      })
    )

    it.effect('should work with processing options in pipes', () =>
      E.gen(function* () {
        const result = yield* E.succeed(sampleSubtitles)
          .pipe(
            E.flatMap((subtitles) => 
              SubtitleConverterLive.convert(subtitles, 'srt', {
                timingOffset: 1000,
                includeSpeaker: true,
                cleanText: true
              })
            ),
            E.tap((srt) => E.sync(() => {
              expect(srt).toContain('00:00:01,000 --> 00:00:06,000')
              expect(srt).toContain('[Speaker 1]: Subtitle processing')
            }))
          )
        
        expect(result).toContain('Hello world')
      })
    )

    it.effect('should handle multiple format conversion with pipes', () =>
      E.gen(function* () {
        const result = yield* E.succeed(sampleSubtitles)
          .pipe(
            E.flatMap((subtitles) => 
              SubtitleConverterLive.convertMultiple(subtitles, ['json', 'srt', 'vtt'])
            ),
            E.map((multiResult) => multiResult.results.map(r => r.format)),
            E.tap((formats) => E.sync(() => expect(formats).toContain('json')))
          )
        
        expect(result).toEqual(['json', 'srt', 'vtt'])
      })
    )

    it.effect('should work with error recovery in pipes', () =>
      E.gen(function* () {
        const result = yield* E.succeed(sampleSubtitles)
          .pipe(
            E.flatMap(() => SubtitleConverterLive.convert(sampleSubtitles, 'unsupported' as any)),
            E.catchAll((error) => {
              expect(error).toBeInstanceOf(UnsupportedFormatError)
              return E.succeed('recovered')
            })
          )
        
        expect(result).toBe('recovered')
      })
    )
  })

  describe('Middleware filter debug', () => {
    it('should print subtitles before and after each filter', () => {
      const originalSubtitles: SubtitleItem[] = [
        { start: 0, end: 2000, text: 'First line', speaker: 1 },
        { start: 2000, end: 4000, text: 'Second line', speaker: 2 },
      ]

      // Print before any filters
      console.log('\n[DEBUG] Original subtitles:', JSON.stringify(originalSubtitles, null, 2))

      // Apply addTimingOffset
      const offsetSubtitles = originalSubtitles.map(addTimingOffset(1000))
      console.log('[DEBUG] After addTimingOffset(+1000):', JSON.stringify(offsetSubtitles, null, 2))

      // Apply replaceText
      const replacedSubtitles = offsetSubtitles.map(replaceText('Replaced!'))
      console.log('[DEBUG] After replaceText("Replaced!"):', JSON.stringify(replacedSubtitles, null, 2))

      // Apply addPrefix
      const prefixedSubtitles = replacedSubtitles.map(addPrefix('[PREFIX]'))
      console.log('[DEBUG] After addPrefix("[PREFIX]"):', JSON.stringify(prefixedSubtitles, null, 2))

      // Final assertion (just to keep the test green)
      expect(prefixedSubtitles[0]?.text).toBe('[PREFIX] Replaced!')
      expect(prefixedSubtitles[1]?.text).toBe('[PREFIX] Replaced!')
    })
  })

  describe('Streaming Processing', () => {
    it.effect('should process subtitles in parallel using streams', () =>
      E.gen(function* () {
        const result = yield* runSubtitleProcessingStream(sampleSubtitles, {
          timingOffset: 1000,
          includeSpeaker: true,
        })

        // Type guard to check if result has error property
        const hasError = typeof result === 'object' && result !== null && 'error' in result
        expect(hasError).toBe(false)
        
        if (!hasError && Array.isArray(result)) {
          expect(result).toHaveLength(3)
          expect(result[0]?.start).toBe(1000)
          expect(result[0]?.end).toBe(6000)
          expect(result[2]?.text).toBe('[Speaker 1]: Subtitle processing')
        }
      })
    )

    it.effect('should convert to format using stream processing', () =>
      E.gen(function* () {
        const result = yield* runSubtitleConversionStream(sampleSubtitles, 'srt', {
          timingOffset: 1000,
          includeSpeaker: true,
        })

        // Type guard to check if result has error property
        const hasError = typeof result === 'object' && result !== null && 'error' in result
        expect(hasError).toBe(false)
        
        if (!hasError && typeof result === 'string') {
          expect(result).toContain('00:00:01,000 --> 00:00:06,000')
          expect(result).toContain('[Speaker 1]: Subtitle processing')
        }
      })
    )

    it.effect('should handle errors in stream processing', () =>
      E.gen(function* () {
        const result = yield* runSubtitleProcessingStream(invalidSubtitles as any, {
          timingOffset: 1000,
        })

        // Type guard to check if result has error property
        const hasError = typeof result === 'object' && result !== null && 'error' in result
        expect(hasError).toBe(true)
        
        if (hasError && typeof result === 'object' && result !== null && 'error' in result) {
          expect(result.error).toBeInstanceOf(InvalidTimingError)
        }
      })
    )

    it.effect('should handle errors in stream conversion', () =>
      E.gen(function* () {
        const result = yield* runSubtitleConversionStream(invalidSubtitles as any, 'json')

        // Type guard to check if result has error property
        const hasError = typeof result === 'object' && result !== null && 'error' in result
        expect(hasError).toBe(true)
        
        if (hasError && typeof result === 'object' && result !== null && 'error' in result) {
          expect(result.error).toBeInstanceOf(InvalidTimingError)
        }
      })
    )

    it.effect('should work with stream processing and pipes', () =>
      E.gen(function* () {
        const result = yield* E.succeed(sampleSubtitles)
          .pipe(
            E.flatMap((subtitles) => runSubtitleProcessingStream(subtitles, {
              timingOffset: 1000,
              cleanText: true
            })),
            E.map((processed) => {
              const hasError = typeof processed === 'object' && processed !== null && 'error' in processed
              if (hasError && typeof processed === 'object' && processed !== null && 'error' in processed) {
                throw processed.error
              }
              return processed
            }),
            E.map((processed) => Array.isArray(processed) ? processed.length : 0),
            E.catchAll((error) => E.succeed({ error }))
          )

        // Type guard to check if result has error property
        const hasError = typeof result === 'object' && result !== null && 'error' in result
        expect(hasError).toBe(false)
        
        if (!hasError && typeof result === 'number') {
          expect(result).toBe(3)
        }
      })
    )

    it.effect('should save subtitle content to file using Bun FS', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          { start: 0, end: 3000, text: 'Welcome to our presentation', speaker: 1 },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          { start: 6000, end: 9000, text: 'the future of technology', speaker: 2 },
          { start: 9000, end: 12000, text: 'and its impact on society', speaker: 2 },
          { start: 12000, end: 15000, text: 'Thank you for your attention', speaker: 1 },
        ]

        // Process subtitles and convert to different formats
        const srtContent = yield* SubtitleConverterLive.convert(complexSubtitles, 'srt', {
          timingOffset: 500,
          includeSpeaker: true,
          cleanText: true,
        })

        const jsonContent = yield* SubtitleConverterLive.convert(complexSubtitles, 'json', {
          timingOffset: 500,
          includeSpeaker: true,
          cleanText: true,
        })

        const vttContent = yield* SubtitleConverterLive.convert(complexSubtitles, 'vtt', {
          timingOffset: 500,
          includeSpeaker: true,
          cleanText: true,
        })

        // Create temporary directory for test files
        const tempDir = yield* E.try({
          try: () => os.tmpdir(),
          catch: () => '/tmp'
        })

        const testDir = yield* E.try({
          try: () => path.join(tempDir, `subtitle-test-${Date.now()}`),
          catch: () => path.join('/tmp', `subtitle-test-${Date.now()}`)
        })

        // Create test directory and write files
        yield* E.try({
          try: () => {
            // Create directory if it doesn't exist
            if (!fs.existsSync(testDir)) {
              fs.mkdirSync(testDir, { recursive: true })
            }
            
            // Write files using Node.js fs
            fs.writeFileSync(path.join(testDir, 'test.srt'), srtContent)
            fs.writeFileSync(path.join(testDir, 'test.json'), jsonContent)
            fs.writeFileSync(path.join(testDir, 'test.vtt'), vttContent)
          },
          catch: (error) => new Error(`Failed to write files: ${error}`)
        })

        // Verify files were created and contain expected content
        const srtFileContent = yield* E.try({
          try: () => {
            return Promise.resolve(fs.readFileSync(path.join(testDir, 'test.srt'), 'utf8'))
          },
          catch: (error) => Promise.resolve(`Error reading file: ${error}`)
        })

        const jsonFileContent = yield* E.try({
          try: () => {
            return Promise.resolve(fs.readFileSync(path.join(testDir, 'test.json'), 'utf8'))
          },
          catch: (error) => Promise.resolve(`Error reading file: ${error}`)
        })

        const vttFileContent = yield* E.try({
          try: () => {
            return Promise.resolve(fs.readFileSync(path.join(testDir, 'test.vtt'), 'utf8'))
          },
          catch: (error) => Promise.resolve(`Error reading file: ${error}`)
        })

        // Wait for file operations to complete
        const [srtResult, jsonResult, vttResult] = yield* E.all([
          E.promise(() => srtFileContent),
          E.promise(() => jsonFileContent),
          E.promise(() => vttFileContent)
        ])

        // Verify SRT file content
        expect(srtResult).toContain('1\n')
        expect(srtResult).toContain('00:00:00,500 --> 00:00:03,500')
        expect(srtResult).toContain('[Speaker 1]: Welcome to our presentation')
        expect(srtResult).toContain('2\n')
        expect(srtResult).toContain('00:00:03,500 --> 00:00:06,500')
        expect(srtResult).toContain('[Speaker 1]: Today we will discuss')
        expect(srtResult).toContain('3\n')
        expect(srtResult).toContain('00:00:06,500 --> 00:00:09,500')
        expect(srtResult).toContain('[Speaker 2]: the future of technology')

        // Verify JSON file content
        const parsedJson = JSON.parse(jsonResult)
        expect(parsedJson).toHaveLength(5)
        expect(parsedJson[0].text).toBe('[Speaker 1]: Welcome to our presentation')
        expect(parsedJson[0].start).toBe(500)
        expect(parsedJson[0].end).toBe(3500)
        expect(parsedJson[2].text).toBe('[Speaker 2]: the future of technology')
        expect(parsedJson[2].speaker).toBe(2)

        // Verify VTT file content
        expect(vttResult).toContain('WEBVTT')
        expect(vttResult).toContain('00:00:00.500 --> 00:00:03.500')
        expect(vttResult).toContain('[Speaker 1]: Welcome to our presentation')
        expect(vttResult).toContain('00:00:06.500 --> 00:00:09.500')
        expect(vttResult).toContain('[Speaker 2]: the future of technology')

        // Clean up test files
        yield* E.try({
          try: () => {
            // Clean up files using Node.js fs
            const files = ['test.srt', 'test.json', 'test.vtt']
            files.forEach(file => {
              const filePath = path.join(testDir, file)
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
              }
            })
            
            // Remove the test directory
            if (fs.existsSync(testDir)) {
              fs.rmdirSync(testDir)
            }
            
            console.log(`Cleaned up files in: ${testDir}`)
          },
          catch: (error) => console.log(`Cleanup warning: ${error}`)
        })

        console.log('\n=== File System Test Results ===')
        console.log(`SRT file size: ${srtResult.length} characters`)
        console.log(`JSON file size: ${jsonResult.length} characters`)
        console.log(`VTT file size: ${vttResult.length} characters`)
        console.log('All subtitle files saved and verified successfully!')
        console.log('=== End File System Test ===\n')

        // Return summary for verification
        return {
          srtLines: srtResult.split('\n').length,
          jsonEntries: parsedJson.length,
          vttLines: vttResult.split('\n').length,
          testDir
        }
      })
    )
  })

  describe('Unified streaming pipeline with multiple format collectors', () => {
    /**
     * Streams subtitles in input (forward) order, applying each filter to each item.
     * @param subtitles Array of SubtitleItem
     * @param filters List of single-item filter functions
     */
    function* subtitleStreamUnified(subtitles: SubtitleItem[], ...filters: Array<(item: SubtitleItem) => SubtitleItem>): Generator<SubtitleItem, void, unknown> {
      for (const item of subtitles) {
        let current = item
        for (const filter of filters) {
          current = filter(current)
        }
        yield current
      }
    }

    it('should stream subtitles and collect to SRT, VTT, JSON, and plain text', () => {
      const originalSubtitles: SubtitleItem[] = [
        { start: 0, end: 2000, text: 'First line', speaker: 1 },
        { start: 2000, end: 4000, text: 'Second line', speaker: 2 },
        { start: 4000, end: 6000, text: 'Third line', speaker: 1 },
      ]

      // Example single-item filters
      const offset = (item: SubtitleItem): SubtitleItem => ({ ...item, start: item.start + 1000, end: item.end + 1000 })
      const upper = (item: SubtitleItem): SubtitleItem => ({ ...item, text: item.text.toUpperCase() })
      const prefix = (item: SubtitleItem): SubtitleItem => ({ ...item, text: `[SPEAKER ${item.speaker}] ${item.text}` })

      // Stream processing (shared)
      const streamed = Array.from(subtitleStreamUnified(originalSubtitles, offset, upper, prefix)).filter((s): s is SubtitleItem => s !== undefined)
      const reversed = reverseArray(streamed).filter((s): s is SubtitleItem => s !== undefined)
      console.log('[DEBUG] Streamed (forward):', streamed.map(s => s.text))
      console.log('[DEBUG] Reversed after streaming:', reversed.map(s => s.text))

      // Assertions
      expect(streamed.length).toBe(3)
      expect(reversed.length).toBe(3)
      expect(streamed[0]!.text).toBe('[SPEAKER 1] FIRST LINE')
      expect(streamed[1]!.text).toBe('[SPEAKER 2] SECOND LINE')
      expect(streamed[2]!.text).toBe('[SPEAKER 1] THIRD LINE')
      expect(reversed[0]!.text).toBe('[SPEAKER 1] THIRD LINE')
      expect(reversed[1]!.text).toBe('[SPEAKER 2] SECOND LINE')
      expect(reversed[2]!.text).toBe('[SPEAKER 1] FIRST LINE')
    })
  })

  describe('Reverse iteration and post-stream reversing for streaming', () => {
    /**
     * Streams subtitles in input (forward) order, applying each filter to each item.
     * @param subtitles Array of SubtitleItem
     * @param filters List of single-item filter functions
     */
    function* subtitleStreamNormal(subtitles: SubtitleItem[], ...filters: Array<(item: SubtitleItem) => SubtitleItem>): Generator<SubtitleItem, void, unknown> {
      for (let i = 0; i < subtitles.length; i++) {
        let current: SubtitleItem = subtitles[i] as SubtitleItem;
        for (const filter of filters) {
          current = filter(current);
        }
        yield current;
      }
    }

    it('streams normally, then reverses after streaming', () => {
      const originalSubtitles: SubtitleItem[] = [
        { start: 1000, end: 2000, text: 'First', speaker: 2 },
        { start: 2000, end: 3000, text: 'Second', speaker: 1 },
        { start: 3000, end: 4000, text: 'Third', speaker: 1 },
      ]

      /** Identity filter for demonstration */
      const identity = (item: SubtitleItem) => item

      // Normal streaming (forward order)
      const streamed = Array.from(subtitleStreamNormal(originalSubtitles, identity)).filter((s): s is SubtitleItem => s !== undefined)
      const reversed = reverseArray(streamed).filter((s): s is SubtitleItem => s !== undefined)
      console.log('[DEBUG] Streamed (forward):', streamed.map(s => s.text))
      console.log('[DEBUG] Reversed after streaming:', reversed.map(s => s.text))

      // Assertions
      expect(streamed.length).toBe(3)
      expect(reversed.length).toBe(3)
      expect(streamed[0]!.text).toBe('First')
      expect(streamed[1]!.text).toBe('Second')
      expect(streamed[2]!.text).toBe('Third')
      expect(reversed[0]!.text).toBe('Third')
      expect(reversed[1]!.text).toBe('Second')
      expect(reversed[2]!.text).toBe('First')
    })
  })
}) 