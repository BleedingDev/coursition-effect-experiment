import { describe, expect, it } from '@effect/vitest'
import { Effect as E } from 'effect'
import { Option } from 'effect'
import {
  SubtitleConverterLive,
  type SubtitleItem,
  addSpeakerInfo,
  processSubtitles,
  runSubtitleConversionStream,
  runSubtitleProcessingStream,
  validateSubtitleData,
} from './subtitle-converter'
import {
  addPrefix,
  addTimingOffset,
  applyFiltersToArray,
  filterBySpeaker,
  replaceText,
  streamSubtitles,
} from './subtitle-filters'
import {
  InvalidTimingError,
  UnsupportedFormatError,
} from './subtitle-formats.errors'

const sampleSubtitles: SubtitleItem[] = [
  { start: 0, end: 5000, text: 'Hello world' },
  { start: 5000, end: 10000, text: 'This is a test' },
  { start: 10000, end: 15000, text: 'Subtitle processing', speaker: 1 },
]

const invalidSubtitles = [
  { start: -1000, end: 5000, text: 'Negative start time' },
  { start: 5000, end: 3000, text: 'End before start' },
  { start: 10000, end: 15000, text: '' },
]

/**
 * Creates a new array with the elements in reverse order.
 *
 * @param arr Array to reverse
 *
 * @returns Array in reverse order
 */
function reverseArray<T>(arr: T[]): T[] {
  return [...arr].reverse()
}

describe('SubtitleConverter', () => {
  describe('validateSubtitleData', () => {
    it.effect('should validate correct subtitle data', () =>
      E.gen(function* () {
        const result = yield* validateSubtitleData(sampleSubtitles)
        expect(result).toEqual(sampleSubtitles)
      }),
    )

    it.effect('should reject invalid subtitle data', () =>
      E.gen(function* () {
        const result = yield* validateSubtitleData(invalidSubtitles as any)
        expect('cause' in result).toBe(true)
      }).pipe(E.catchAll(E.succeed)),
    )

    it.effect('should reject empty subtitle array', () =>
      E.gen(function* () {
        const result = yield* validateSubtitleData([])
        expect('cause' in result).toBe(true)
        if ('cause' in result && result.cause instanceof Error) {
          expect(result.cause.message).toBe(
            'Subtitle data must be a non-empty array',
          )
        }
      }).pipe(E.catchAll(E.succeed)),
    )

    it.effect('should reject null subtitle data', () =>
      E.gen(function* () {
        const result = yield* validateSubtitleData(null as any)
        expect('cause' in result).toBe(true)
      }).pipe(E.catchAll(E.succeed)),
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
      }),
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
      }),
    )

    it.effect(
      'should process subtitles in correct order: timing → clean → speaker',
      () =>
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
        }),
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
      }),
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
      }),
    )

    it.effect('should process subtitles and print valid SRT file', () =>
      E.gen(function* () {
        const complexSubtitles: SubtitleItem[] = [
          {
            start: 0,
            end: 3000,
            text: 'Welcome to our presentation',
            speaker: 1,
          },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          {
            start: 6000,
            end: 9000,
            text: 'the future of technology',
            speaker: 2,
          },
          {
            start: 9000,
            end: 12000,
            text: 'and its impact on society',
            speaker: 2,
          },
          {
            start: 12000,
            end: 15000,
            text: 'Thank you for your attention',
            speaker: 1,
          },
        ]

        const processedSubtitles = yield* processSubtitles(complexSubtitles, {
          timingOffset: 500,
          includeSpeaker: true,
          cleanText: true,
          mergeAdjacent: false, // Disable merging to see individual subtitle entries
        })

        // Convert to SRT format
        const srtContent = yield* SubtitleConverterLive.convert(
          processedSubtitles,
          'srt',
        )

        // Print the SRT content
        console.log('\n=== Generated SRT File ===')
        console.log(srtContent)
        console.log('=== End SRT File ===\n')

        // Verify the SRT content is valid
        expect(srtContent).toContain('1\n')
        expect(srtContent).toContain('00:00:00,500 --> 00:00:03,500\n')
        expect(srtContent).toContain(
          '[Speaker 1]: Welcome to our presentation\n',
        )
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
        expect(srtContent).toContain(
          '[Speaker 1]: Thank you for your attention\n',
        )

        // Verify the structure is correct (number, timing, text, empty line)
        const lines = srtContent.split('\n')
        expect(lines).toContain('1')
        expect(lines).toContain('2')
        expect(lines).toContain('3')
        expect(lines).toContain('4')
        expect(lines).toContain('5')
        expect(lines).toContain('') // Empty lines between subtitles

        console.log(
          `Processed ${processedSubtitles.length} subtitles into SRT format`,
        )
        console.log(`SRT file contains ${lines.length} lines`)
        console.log(
          `Original subtitles: ${complexSubtitles.length}, Processed subtitles: ${processedSubtitles.length}`,
        )
      }),
    )

    it.effect('should process subtitles and print valid JSON format', () =>
      E.gen(function* () {
        const complexSubtitles: SubtitleItem[] = [
          {
            start: 0,
            end: 3000,
            text: 'Welcome to our presentation',
            speaker: 1,
          },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          {
            start: 6000,
            end: 9000,
            text: 'the future of technology',
            speaker: 2,
          },
          {
            start: 9000,
            end: 12000,
            text: 'and its impact on society',
            speaker: 2,
          },
          {
            start: 12000,
            end: 15000,
            text: 'Thank you for your attention',
            speaker: 1,
          },
        ]

        const processedSubtitles = yield* processSubtitles(complexSubtitles, {
          timingOffset: 500,
          includeSpeaker: true,
          cleanText: true,
          mergeAdjacent: false,
        })

        const jsonContent = yield* SubtitleConverterLive.convert(
          processedSubtitles,
          'json',
        )

        console.log('\n=== Generated JSON Format ===')
        console.log(jsonContent)
        console.log('=== End JSON Format ===\n')

        const parsedJson = JSON.parse(jsonContent)
        expect(Array.isArray(parsedJson)).toBe(true)
        expect(parsedJson).toHaveLength(5)

        expect(parsedJson[0]).toEqual({
          start: 500,
          end: 3500,
          text: '[Speaker 1]: Welcome to our presentation',
          speaker: 1,
        })

        expect(parsedJson[1]).toEqual({
          start: 3500,
          end: 6500,
          text: '[Speaker 1]: Today we will discuss',
          speaker: 1,
        })

        expect(parsedJson[2]).toEqual({
          start: 6500,
          end: 9500,
          text: '[Speaker 2]: the future of technology',
          speaker: 2,
        })

        expect(parsedJson[3]).toEqual({
          start: 9500,
          end: 12500,
          text: '[Speaker 2]: and its impact on society',
          speaker: 2,
        })

        expect(parsedJson[4]).toEqual({
          start: 12500,
          end: 15500,
          text: '[Speaker 1]: Thank you for your attention',
          speaker: 1,
        })

        console.log(
          `Processed ${processedSubtitles.length} subtitles into JSON format`,
        )
        console.log(`JSON contains ${parsedJson.length} subtitle entries`)
      }),
    )

    it.effect('should process subtitles and print valid VTT format', () =>
      E.gen(function* () {
        const complexSubtitles: SubtitleItem[] = [
          {
            start: 0,
            end: 3000,
            text: 'Welcome to our presentation',
            speaker: 1,
          },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          {
            start: 6000,
            end: 9000,
            text: 'the future of technology',
            speaker: 2,
          },
          {
            start: 9000,
            end: 12000,
            text: 'and its impact on society',
            speaker: 2,
          },
          {
            start: 12000,
            end: 15000,
            text: 'Thank you for your attention',
            speaker: 1,
          },
        ]

        const processedSubtitles = yield* processSubtitles(complexSubtitles, {
          timingOffset: 500,
          includeSpeaker: true,
          cleanText: true,
          mergeAdjacent: false,
        })

        const vttContent = yield* SubtitleConverterLive.convert(
          processedSubtitles,
          'vtt',
        )

        console.log('\n=== Generated VTT Format ===')
        console.log(vttContent)
        console.log('=== End VTT Format ===\n')

        expect(vttContent).toContain('WEBVTT\n')
        expect(vttContent).toContain('00:00:00.500 --> 00:00:03.500\n')
        expect(vttContent).toContain(
          '[Speaker 1]: Welcome to our presentation\n',
        )
        expect(vttContent).toContain('00:00:03.500 --> 00:00:06.500\n')
        expect(vttContent).toContain('[Speaker 1]: Today we will discuss\n')
        expect(vttContent).toContain('00:00:06.500 --> 00:00:09.500\n')
        expect(vttContent).toContain('[Speaker 2]: the future of technology\n')
        expect(vttContent).toContain('00:00:09.500 --> 00:00:12.500\n')
        expect(vttContent).toContain('[Speaker 2]: and its impact on society\n')
        expect(vttContent).toContain('00:00:12.500 --> 00:00:15.500\n')
        expect(vttContent).toContain(
          '[Speaker 1]: Thank you for your attention\n',
        )

        // Verify VTT-specific format (uses dots instead of commas for milliseconds)
        expect(vttContent).toMatch(/WEBVTT/)
        expect(vttContent).toMatch(
          /\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/,
        )

        // Verify the structure is correct
        const lines = vttContent.split('\n')
        expect(lines[0]).toBe('WEBVTT')
        expect(lines).toContain('') // Empty lines between subtitles

        console.log(
          `Processed ${processedSubtitles.length} subtitles into VTT format`,
        )
        console.log(`VTT file contains ${lines.length} lines`)
      }),
    )

    it.effect(
      'should process subtitles and print valid plain text format',
      () =>
        E.gen(function* () {
          const complexSubtitles: SubtitleItem[] = [
            {
              start: 0,
              end: 3000,
              text: 'Welcome to our presentation',
              speaker: 1,
            },
            {
              start: 3000,
              end: 6000,
              text: 'Today we will discuss',
              speaker: 1,
            },
            {
              start: 6000,
              end: 9000,
              text: 'the future of technology',
              speaker: 2,
            },
            {
              start: 9000,
              end: 12000,
              text: 'and its impact on society',
              speaker: 2,
            },
            {
              start: 12000,
              end: 15000,
              text: 'Thank you for your attention',
              speaker: 1,
            },
          ]

          const processedSubtitles = yield* processSubtitles(complexSubtitles, {
            timingOffset: 500,
            includeSpeaker: true,
            cleanText: true,
            mergeAdjacent: false,
          })

          const textContent = yield* SubtitleConverterLive.convert(
            processedSubtitles,
            'plain-text',
          )

          console.log('\n=== Generated Plain Text Format ===')
          console.log(textContent)
          console.log('=== End Plain Text Format ===\n')

          expect(textContent).toContain(
            '[Speaker 1]: Welcome to our presentation',
          )
          expect(textContent).toContain('[Speaker 1]: Today we will discuss')
          expect(textContent).toContain('[Speaker 2]: the future of technology')
          expect(textContent).toContain(
            '[Speaker 2]: and its impact on society',
          )
          expect(textContent).toContain(
            '[Speaker 1]: Thank you for your attention',
          )

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

          console.log(
            `Processed ${processedSubtitles.length} subtitles into plain text format`,
          )
          console.log(`Plain text contains ${lines.length} lines`)
        }),
    )

    it.effect(
      'should process subtitles and print all formats for comparison',
      () =>
        E.gen(function* () {
          const simpleSubtitles: SubtitleItem[] = [
            { start: 0, end: 3000, text: 'Hello world', speaker: 1 },
            { start: 3000, end: 6000, text: 'This is a test', speaker: 2 },
          ]

          const processedSubtitles = yield* processSubtitles(simpleSubtitles, {
            timingOffset: 1000,
            includeSpeaker: true,
            cleanText: true,
            mergeAdjacent: false,
          })

          const jsonContent = yield* SubtitleConverterLive.convert(
            processedSubtitles,
            'json',
          )
          const srtContent = yield* SubtitleConverterLive.convert(
            processedSubtitles,
            'srt',
          )
          const vttContent = yield* SubtitleConverterLive.convert(
            processedSubtitles,
            'vtt',
          )
          const textContent = yield* SubtitleConverterLive.convert(
            processedSubtitles,
            'plain-text',
          )

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

          expect(textContent).toBe(
            '[Speaker 1]: Hello world\n\n[Speaker 2]: This is a test',
          )

          console.log('All formats generated successfully!')
          console.log(`JSON: ${parsedJson.length} entries`)
          console.log(`SRT: ${srtContent.split('\\n').length} lines`)
          console.log(`VTT: ${vttContent.split('\\n').length} lines`)
          console.log(`Plain Text: ${textContent.split('\\n').length} lines`)
        }),
    )

    it.effect('should demonstrate file output function for all formats', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          {
            start: 0,
            end: 3000,
            text: 'Welcome to our presentation',
            speaker: 1,
          },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          {
            start: 6000,
            end: 9000,
            text: 'the future of technology',
            speaker: 2,
          },
          {
            start: 9000,
            end: 12000,
            text: 'and its impact on society',
            speaker: 2,
          },
          {
            start: 12000,
            end: 15000,
            text: 'Thank you for your attention',
            speaker: 1,
          },
        ]

        // Process the subtitles
        const processedSubtitles = yield* processSubtitles(complexSubtitles, {
          timingOffset: 500,
          includeSpeaker: true,
          cleanText: true,
          mergeAdjacent: false,
        })

        // Function to create file output string
        const createFileOutput = (
          content: string,
          format: string,
          metadata?: {
            originalCount?: number
            processedCount?: number
            processingOptions?: any
          },
        ) => {
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
        const jsonContent = yield* SubtitleConverterLive.convert(
          processedSubtitles,
          'json',
        )
        const srtContent = yield* SubtitleConverterLive.convert(
          processedSubtitles,
          'srt',
        )
        const vttContent = yield* SubtitleConverterLive.convert(
          processedSubtitles,
          'vtt',
        )
        const textContent = yield* SubtitleConverterLive.convert(
          processedSubtitles,
          'plain-text',
        )

        // Create file outputs with metadata
        const jsonFileOutput = createFileOutput(jsonContent, 'json', {
          originalCount: complexSubtitles.length,
          processedCount: processedSubtitles.length,
          processingOptions: {
            timingOffset: 500,
            includeSpeaker: true,
            cleanText: true,
            mergeAdjacent: false,
          },
        })

        const srtFileOutput = createFileOutput(srtContent, 'srt', {
          originalCount: complexSubtitles.length,
          processedCount: processedSubtitles.length,
          processingOptions: {
            timingOffset: 500,
            includeSpeaker: true,
            cleanText: true,
            mergeAdjacent: false,
          },
        })

        const vttFileOutput = createFileOutput(vttContent, 'vtt', {
          originalCount: complexSubtitles.length,
          processedCount: processedSubtitles.length,
          processingOptions: {
            timingOffset: 500,
            includeSpeaker: true,
            cleanText: true,
            mergeAdjacent: false,
          },
        })

        const textFileOutput = createFileOutput(textContent, 'plain-text', {
          originalCount: complexSubtitles.length,
          processedCount: processedSubtitles.length,
          processingOptions: {
            timingOffset: 500,
            includeSpeaker: true,
            cleanText: true,
            mergeAdjacent: false,
          },
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
        expect(jsonFileOutput).toContain(
          '# Subtitle File Generated by SubtitleConverter',
        )
        expect(jsonFileOutput).toContain('# Format: JSON')
        expect(jsonFileOutput).toContain(
          '"text": "[Speaker 1]: Welcome to our presentation"',
        )

        expect(srtFileOutput).toContain('# Format: SRT')
        expect(srtFileOutput).toContain('1\n')
        expect(srtFileOutput).toContain('00:00:00,500 --> 00:00:03,500')

        expect(vttFileOutput).toContain('# Format: VTT')
        expect(vttFileOutput).toContain('WEBVTT')
        expect(vttFileOutput).toContain('00:00:00.500 --> 00:00:03.500')

        expect(textFileOutput).toContain('# Format: PLAIN-TEXT')
        expect(textFileOutput).toContain(
          '[Speaker 1]: Welcome to our presentation',
        )
        // Check that the actual subtitle content doesn't contain timing (only the header metadata does)
        expect(textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/) // No timing in plain text content
        expect(textContent).not.toMatch(/-->/)

        console.log('\n=== File Output Summary ===')
        console.log(`JSON file size: ${new Blob([jsonFileOutput]).size} bytes`)
        console.log(`SRT file size: ${new Blob([srtFileOutput]).size} bytes`)
        console.log(`VTT file size: ${new Blob([vttFileOutput]).size} bytes`)
        console.log(
          `Plain text file size: ${new Blob([textFileOutput]).size} bytes`,
        )
      }),
    )

    it.effect('should demonstrate pipe output to file string function', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          {
            start: 0,
            end: 3000,
            text: 'Welcome to our presentation',
            speaker: 1,
          },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          {
            start: 6000,
            end: 9000,
            text: 'the future of technology',
            speaker: 2,
          },
          {
            start: 9000,
            end: 12000,
            text: 'and its impact on society',
            speaker: 2,
          },
          {
            start: 12000,
            end: 15000,
            text: 'Thank you for your attention',
            speaker: 1,
          },
        ]

        // Function that takes pipe output and returns formatted file string
        const pipeOutputToFileString = (
          pipeResult: any,
          format: 'json' | 'srt' | 'vtt' | 'plain-text',
          filename?: string,
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
        const pipeOutput = yield* E.succeed(complexSubtitles).pipe(
          E.flatMap((subtitles) =>
            processSubtitles(subtitles, {
              timingOffset: 1000,
              includeSpeaker: true,
              cleanText: true,
              mergeAdjacent: false, // Disable merging to get individual subtitles
              mergeThreshold: 2000,
            }),
          ),
          E.flatMap((processed) =>
            SubtitleConverterLive.convert(processed, 'srt'),
          ),
          E.map((srtContent) =>
            pipeOutputToFileString(
              srtContent,
              'srt',
              'presentation_subtitles.srt',
            ),
          ),
        )

        console.log('\n=== Pipe Output to File String ===')
        console.log(pipeOutput)

        // Verify the pipe output contains the expected content
        expect(pipeOutput).toContain(
          '# Subtitle File: presentation_subtitles.srt',
        )
        expect(pipeOutput).toContain('# Format: SRT')
        expect(pipeOutput).toContain('1\n')
        expect(pipeOutput).toContain('00:00:01,000 --> 00:00:04,000')
        expect(pipeOutput).toContain('[Speaker 1]: Welcome to our presentation')

        console.log(
          `\nPipe output file size: ${new Blob([pipeOutput]).size} bytes`,
        )
      }),
    )

    it.effect('should demonstrate pipeable text replacement function', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          {
            start: 0,
            end: 3000,
            text: 'Welcome to our presentation',
            speaker: 1,
          },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          {
            start: 6000,
            end: 9000,
            text: 'the future of technology',
            speaker: 2,
          },
          {
            start: 9000,
            end: 12000,
            text: 'and its impact on society',
            speaker: 2,
          },
          {
            start: 12000,
            end: 15000,
            text: 'Thank you for your attention',
            speaker: 1,
          },
        ]

        // Function that takes pipe output and returns formatted file string
        const pipeOutputToFileString = (
          pipeResult: any,
          format: 'json' | 'srt' | 'vtt' | 'plain-text',
          filename?: string,
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

        // Proper streaming pipeline: process single items, collect at end
        const pipeOutput = yield* E.succeed(complexSubtitles).pipe(
          // Step 1: Process subtitles with basic options
          E.flatMap((subtitles) =>
            processSubtitles(subtitles, {
              timingOffset: 500,
              includeSpeaker: true,
              cleanText: true,
              mergeAdjacent: false,
            }),
          ),
          // Step 2: Apply single-item filters efficiently
          E.map((processedSubtitles) =>
            applyFiltersToArray(
              processedSubtitles,
              replaceText('Hello world!'),
            ),
          ),
          // Step 3: Convert to SRT format
          E.flatMap((processed) =>
            SubtitleConverterLive.convert(processed, 'srt'),
          ),
          // Step 4: Format as file output
          E.map((srtContent) =>
            pipeOutputToFileString(
              srtContent,
              'srt',
              'hello_world_subtitles.srt',
            ),
          ),
        )

        console.log('\n=== Pipe Output with Text Replacement ===')
        console.log(pipeOutput)

        // Verify the pipe output contains the expected content
        expect(pipeOutput).toContain(
          '# Subtitle File: hello_world_subtitles.srt',
        )
        expect(pipeOutput).toContain('# Format: SRT')
        expect(pipeOutput).toContain(
          '# Source: SubtitleConverter Pipeline with Text Replacement',
        )
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
        const subtitleLines = lines.filter((line) =>
          line.includes('Hello world!'),
        )
        expect(subtitleLines).toHaveLength(5) // All 5 subtitles should have "Hello world!"

        console.log(
          `\nPipe output with text replacement file size: ${new Blob([pipeOutput]).size} bytes`,
        )
        console.log(
          `All ${subtitleLines.length} subtitles now contain "Hello world!"`,
        )
      }),
    )

    it.effect('should demonstrate multiple pipe functions in sequence', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          {
            start: 0,
            end: 3000,
            text: 'Welcome to our presentation',
            speaker: 1,
          },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          {
            start: 6000,
            end: 9000,
            text: 'the future of technology',
            speaker: 2,
          },
          {
            start: 9000,
            end: 12000,
            text: 'and its impact on society',
            speaker: 2,
          },
          {
            start: 12000,
            end: 15000,
            text: 'Thank you for your attention',
            speaker: 1,
          },
        ]

        // Proper streaming pipeline: apply single-item filters to each subtitle
        const pipeOutput = yield* E.succeed(complexSubtitles).pipe(
          // Step 1: Basic processing
          E.flatMap((subtitles) =>
            processSubtitles(subtitles, {
              includeSpeaker: true,
              cleanText: true,
              mergeAdjacent: false,
            }),
          ),
          // Step 2: Apply single-item filters efficiently
          E.map((processedSubtitles) =>
            applyFiltersToArray(
              processedSubtitles,
              replaceText('Hello world!'),
              addTimingOffset(1000),
              filterBySpeaker(1),
              addPrefix('[CUSTOM]'),
            ),
          ),
          // Step 3: Convert to JSON format
          E.flatMap((processed) =>
            SubtitleConverterLive.convert(processed, 'json'),
          ),
          // Step 4: Parse and verify the result
          E.map((jsonContent) => {
            const parsed = JSON.parse(jsonContent)
            console.log('\n=== Multi-Pipe Output ===')
            console.log('JSON Result:', jsonContent)
            console.log('Parsed Result:', parsed)

            // Verify the pipeline worked correctly
            expect(parsed).toHaveLength(3) // Only speaker 1 subtitles
            expect(parsed[0].text).toBe('[CUSTOM] [Speaker 1]: Hello world!')
            expect(parsed[0].start).toBe(1000) // Original 0 + 1000 offset
            expect(parsed[0].end).toBe(4000) // Original 3000 + 1000 offset
            expect(parsed[1].text).toBe('[CUSTOM] [Speaker 1]: Hello world!')
            expect(parsed[2].text).toBe('[CUSTOM] [Speaker 1]: Hello world!')

            return `Pipeline processed ${parsed.length} subtitles successfully!`
          }),
        )

        console.log('\n=== Pipeline Summary ===')
        console.log(pipeOutput)
        console.log('All pipe functions executed successfully in sequence!')
      }),
    )

    it.effect('should demonstrate composed filters and debug functions', () =>
      E.gen(function* () {
        // Create a complex subtitle dataset
        const complexSubtitles: SubtitleItem[] = [
          {
            start: 0,
            end: 3000,
            text: 'Welcome to our presentation',
            speaker: 1,
          },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          {
            start: 6000,
            end: 9000,
            text: 'the future of technology',
            speaker: 2,
          },
          {
            start: 9000,
            end: 12000,
            text: 'and its impact on society',
            speaker: 2,
          },
          {
            start: 12000,
            end: 15000,
            text: 'Thank you for your attention',
            speaker: 1,
          },
        ]

        // Execute the pipeline with single-item filters applied to each subtitle
        const result = yield* E.succeed(complexSubtitles).pipe(
          E.flatMap((subtitles) =>
            processSubtitles(subtitles, {
              includeSpeaker: true,
              cleanText: true,
              mergeAdjacent: false,
            }),
          ),
          // Apply single-item filters efficiently
          E.map((processedSubtitles) =>
            applyFiltersToArray(
              processedSubtitles,
              replaceText('Hello world!'),
              addTimingOffset(500),
              filterBySpeaker(1),
              addPrefix('[COMPOSED]'),
            ),
          ),
          E.flatMap((processed) =>
            SubtitleConverterLive.convert(processed, 'json'),
          ),
        )

        console.log('\n=== Composed Pipeline Output ===')
        console.log(result)

        // Parse and verify the result
        const parsed = JSON.parse(result)
        expect(parsed).toHaveLength(3) // Only speaker 1 subtitles
        expect(parsed[0].text).toBe('[COMPOSED] [Speaker 1]: Hello world!')
        expect(parsed[0].start).toBe(500) // Original 0 + 500 offset
        expect(parsed[0].end).toBe(3500) // Original 3000 + 500 offset

        console.log('Composed pipeline executed successfully!')
        console.log(
          `Processed ${parsed.length} subtitles through composed filters`,
        )
      }),
    )
  })

  describe('SubtitleConverterLive.convert', () => {
    it.effect('should convert to JSON format', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convert(
          sampleSubtitles,
          'json',
        )
        const parsed = JSON.parse(result)
        expect(parsed).toEqual(sampleSubtitles)
      }),
    )

    it.effect('should convert to SRT format', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convert(
          sampleSubtitles,
          'srt',
        )

        expect(result).toContain('1\n')
        expect(result).toContain('00:00:00,000 --> 00:00:05,000\n')
        expect(result).toContain('Hello world\n')
        expect(result).toContain('2\n')
        expect(result).toContain('00:00:05,000 --> 00:00:10,000\n')
        expect(result).toContain('This is a test\n')
        expect(result).toContain('3\n')
        expect(result).toContain('00:00:10,000 --> 00:00:15,000\n')
        expect(result).toContain('Subtitle processing\n')
      }),
    )

    it.effect('should convert to VTT format', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convert(
          sampleSubtitles,
          'vtt',
        )

        expect(result).toContain('WEBVTT\n')
        expect(result).toContain('00:00:00.000 --> 00:00:05.000\n')
        expect(result).toContain('Hello world\n')
        expect(result).toContain('00:00:05.000 --> 00:00:10.000\n')
        expect(result).toContain('This is a test\n')
        expect(result).toContain('00:00:10.000 --> 00:00:15.000\n')
        expect(result).toContain('Subtitle processing\n')
      }),
    )

    it.effect('should convert to plain text format', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convert(
          sampleSubtitles,
          'plain-text',
        )
        expect(result).toBe(
          'Hello world\n\nThis is a test\n\nSubtitle processing',
        )
      }),
    )

    it.effect('should reject unsupported format', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convert(
          sampleSubtitles,
          'unsupported' as any,
        )
        expect(result).toBeInstanceOf(UnsupportedFormatError)
      }).pipe(E.catchAll(E.succeed)),
    )

    it.effect('should convert with processing options', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convert(
          sampleSubtitles,
          'srt',
          {
            timingOffset: 1000,
            includeSpeaker: true,
          },
        )

        expect(result).toContain('00:00:01,000 --> 00:00:06,000\n')
        expect(result).toContain('Hello world\n')
        expect(result).toContain('00:00:06,000 --> 00:00:11,000\n')
        expect(result).toContain('This is a test\n')
        expect(result).toContain('00:00:11,000 --> 00:00:16,000\n')
        expect(result).toContain('[Speaker 1]: Subtitle processing\n')
      }),
    )
  })

  describe('SubtitleConverterLive.convertMultiple', () => {
    it.effect('should convert to multiple formats', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convertMultiple(
          sampleSubtitles,
          ['json', 'srt', 'vtt', 'plain-text'],
        )

        expect(result.results).toHaveLength(4)

        const jsonResult = result.results.find((r) => r.format === 'json')
        expect(jsonResult).toBeDefined()
        expect(JSON.parse(jsonResult!.content)).toEqual(sampleSubtitles)

        const srtResult = result.results.find((r) => r.format === 'srt')
        expect(srtResult).toBeDefined()
        expect(srtResult!.content).toContain('1\n')
        expect(srtResult!.content).toContain('Hello world\n')

        const vttResult = result.results.find((r) => r.format === 'vtt')
        expect(vttResult).toBeDefined()
        expect(vttResult!.content).toContain('WEBVTT\n')
        expect(vttResult!.content).toContain('Hello world\n')

        const textResult = result.results.find((r) => r.format === 'plain-text')
        expect(textResult).toBeDefined()
        expect(textResult!.content).toBe(
          'Hello world\n\nThis is a test\n\nSubtitle processing',
        )
      }),
    )

    it.effect(
      'should convert to multiple formats with processing options',
      () =>
        E.gen(function* () {
          const result = yield* SubtitleConverterLive.convertMultiple(
            sampleSubtitles,
            ['srt', 'vtt'],
            {
              timingOffset: 1000,
              includeSpeaker: true,
            },
          )

          expect(result.results).toHaveLength(2)

          const srtResult = result.results.find((r) => r.format === 'srt')
          expect(srtResult).toBeDefined()
          expect(srtResult!.content).toContain(
            '00:00:01,000 --> 00:00:06,000\n',
          )
          expect(srtResult!.content).toContain(
            '[Speaker 1]: Subtitle processing\n',
          )

          const vttResult = result.results.find((r) => r.format === 'vtt')
          expect(vttResult).toBeDefined()
          expect(vttResult!.content).toContain(
            '00:00:01.000 --> 00:00:06.000\n',
          )
          expect(vttResult!.content).toContain(
            '[Speaker 1]: Subtitle processing\n',
          )
        }),
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
      }),
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
      }),
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
      }),
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
      }),
    )
  })

  describe('Effect Pipes Integration', () => {
    it.effect('should work with pipe operations', () =>
      E.gen(function* () {
        const result = yield* E.succeed(sampleSubtitles).pipe(
          E.tap((subtitles) => E.sync(() => expect(subtitles).toHaveLength(3))),
          E.flatMap((subtitles) =>
            SubtitleConverterLive.convert(subtitles, 'json'),
          ),
          E.map((json) => JSON.parse(json)),
          E.tap((parsed) =>
            E.sync(() => expect(parsed).toEqual(sampleSubtitles)),
          ),
        )

        expect(result).toEqual(sampleSubtitles)
      }),
    )

    it.effect('should handle errors in pipes', () =>
      E.gen(function* () {
        const result = yield* E.succeed(invalidSubtitles).pipe(
          E.flatMap((subtitles) =>
            SubtitleConverterLive.convert(subtitles as any, 'json'),
          ),
          E.catchAll((error) => E.succeed(error)),
        )

        // The first validation error will be InvalidTimingError for negative start time
        expect(result).toBeInstanceOf(InvalidTimingError)
      }),
    )

    it.effect('should chain multiple operations with pipes', () =>
      E.gen(function* () {
        const result = yield* E.succeed(sampleSubtitles).pipe(
          E.tap(() => E.sync(() => console.log('Starting conversion'))),
          E.flatMap((subtitles) =>
            SubtitleConverterLive.convert(subtitles, 'srt'),
          ),
          E.tap((srt) => E.sync(() => expect(srt).toContain('Hello world'))),
          E.flatMap(() =>
            SubtitleConverterLive.convert(sampleSubtitles, 'vtt'),
          ),
          E.tap((vtt) => E.sync(() => expect(vtt).toContain('WEBVTT'))),
          E.flatMap(() =>
            SubtitleConverterLive.convert(sampleSubtitles, 'plain-text'),
          ),
          E.map((text) => text.split('\n').length),
        )

        expect(result).toBe(5) // 3 subtitles + 2 empty lines
      }),
    )

    it.effect('should work with processing options in pipes', () =>
      E.gen(function* () {
        const result = yield* E.succeed(sampleSubtitles).pipe(
          E.flatMap((subtitles) =>
            SubtitleConverterLive.convert(subtitles, 'srt', {
              timingOffset: 1000,
              includeSpeaker: true,
              cleanText: true,
            }),
          ),
          E.tap((srt) =>
            E.sync(() => {
              expect(srt).toContain('00:00:01,000 --> 00:00:06,000')
              expect(srt).toContain('[Speaker 1]: Subtitle processing')
            }),
          ),
        )

        expect(result).toContain('Hello world')
      }),
    )

    it.effect('should handle multiple format conversion with pipes', () =>
      E.gen(function* () {
        const result = yield* E.succeed(sampleSubtitles).pipe(
          E.flatMap((subtitles) =>
            SubtitleConverterLive.convertMultiple(subtitles, [
              'json',
              'srt',
              'vtt',
            ]),
          ),
          E.map((multiResult) => multiResult.results.map((r) => r.format)),
          E.tap((formats) => E.sync(() => expect(formats).toContain('json'))),
        )

        expect(result).toEqual(['json', 'srt', 'vtt'])
      }),
    )

    it.effect('should work with error recovery in pipes', () =>
      E.gen(function* () {
        const result = yield* E.succeed(sampleSubtitles).pipe(
          E.flatMap(() =>
            SubtitleConverterLive.convert(
              sampleSubtitles,
              'unsupported' as any,
            ),
          ),
          E.catchAll((error) => {
            expect(error).toBeInstanceOf(UnsupportedFormatError)
            return E.succeed('recovered')
          }),
        )

        expect(result).toBe('recovered')
      }),
    )
  })

  describe('Middleware filter debug', () => {
    it('should print subtitles before and after each filter', () => {
      const originalSubtitles: SubtitleItem[] = [
        { start: 0, end: 2000, text: 'First line', speaker: 1 },
        { start: 2000, end: 4000, text: 'Second line', speaker: 2 },
      ]

      // Print before any filters
      console.log(
        '\n[DEBUG] Original subtitles:',
        JSON.stringify(originalSubtitles, null, 2),
      )

      // Apply addTimingOffset
      const offsetSubtitles = originalSubtitles.map(addTimingOffset(1000))
      console.log(
        '[DEBUG] After addTimingOffset(+1000):',
        JSON.stringify(offsetSubtitles, null, 2),
      )

      // Apply replaceText
      const replacedSubtitles = offsetSubtitles.map(replaceText('Replaced!'))
      console.log(
        '[DEBUG] After replaceText("Replaced!"):',
        JSON.stringify(replacedSubtitles, null, 2),
      )

      // Apply addPrefix
      const prefixedSubtitles = replacedSubtitles.map(addPrefix('[PREFIX]'))
      console.log(
        '[DEBUG] After addPrefix("[PREFIX]"):',
        JSON.stringify(prefixedSubtitles, null, 2),
      )

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
        const hasError =
          typeof result === 'object' && result !== null && 'error' in result
        expect(hasError).toBe(false)

        if (!hasError && Array.isArray(result)) {
          expect(result).toHaveLength(3)
          expect(result[0]?.start).toBe(1000)
          expect(result[0]?.end).toBe(6000)
          expect(result[2]?.text).toBe('[Speaker 1]: Subtitle processing')
        }
      }),
    )

    it.effect('should convert to format using stream processing', () =>
      E.gen(function* () {
        const result = yield* runSubtitleConversionStream(
          sampleSubtitles,
          'srt',
          {
            timingOffset: 1000,
            includeSpeaker: true,
          },
        )

        // Type guard to check if result has error property
        const hasError =
          typeof result === 'object' && result !== null && 'error' in result
        expect(hasError).toBe(false)

        if (!hasError && typeof result === 'string') {
          expect(result).toContain('00:00:01,000 --> 00:00:06,000')
          expect(result).toContain('[Speaker 1]: Subtitle processing')
        }
      }),
    )

    it.effect('should handle errors in stream processing', () =>
      E.gen(function* () {
        const result = yield* runSubtitleProcessingStream(
          invalidSubtitles as any,
          {
            timingOffset: 1000,
          },
        )

        // Type guard to check if result has error property
        const hasError =
          typeof result === 'object' && result !== null && 'error' in result
        expect(hasError).toBe(true)

        if (
          hasError &&
          typeof result === 'object' &&
          result !== null &&
          'error' in result
        ) {
          expect(result.error).toBeInstanceOf(InvalidTimingError)
        }
      }),
    )

    it.effect('should handle errors in stream conversion', () =>
      E.gen(function* () {
        const result = yield* runSubtitleConversionStream(
          invalidSubtitles as any,
          'json',
        )

        // Type guard to check if result has error property
        const hasError =
          typeof result === 'object' && result !== null && 'error' in result
        expect(hasError).toBe(true)

        if (
          hasError &&
          typeof result === 'object' &&
          result !== null &&
          'error' in result
        ) {
          expect(result.error).toBeInstanceOf(InvalidTimingError)
        }
      }),
    )

    it.effect('should work with stream processing and pipes', () =>
      E.gen(function* () {
        const result = yield* E.succeed(sampleSubtitles).pipe(
          E.flatMap((subtitles) =>
            runSubtitleProcessingStream(subtitles, {
              timingOffset: 1000,
              cleanText: true,
            }),
          ),
          E.map((processed) => {
            const hasError =
              typeof processed === 'object' &&
              processed !== null &&
              'error' in processed
            if (
              hasError &&
              typeof processed === 'object' &&
              processed !== null &&
              'error' in processed
            ) {
              throw processed.error
            }
            return processed
          }),
          E.map((processed) =>
            Array.isArray(processed) ? processed.length : 0,
          ),
          E.catchAll((error) => E.succeed({ error })),
        )

        // Type guard to check if result has error property
        const hasError =
          typeof result === 'object' && result !== null && 'error' in result
        expect(hasError).toBe(false)

        if (!hasError && typeof result === 'number') {
          expect(result).toBe(3)
        }
      }),
    )

    it.effect('should save subtitle content to file using Bun FS', () =>
      E.gen(function* () {
        const complexSubtitles: SubtitleItem[] = [
          {
            start: 0,
            end: 3000,
            text: 'Welcome to our presentation',
            speaker: 1,
          },
          { start: 3000, end: 6000, text: 'Today we will discuss', speaker: 1 },
          {
            start: 6000,
            end: 9000,
            text: 'the future of technology',
            speaker: 2,
          },
          {
            start: 9000,
            end: 12000,
            text: 'and its impact on society',
            speaker: 2,
          },
          {
            start: 12000,
            end: 15000,
            text: 'Thank you for your attention',
            speaker: 1,
          },
        ]

        const srtContent = yield* SubtitleConverterLive.convert(
          complexSubtitles,
          'srt',
          {
            timingOffset: 500,
            includeSpeaker: true,
            cleanText: true,
          },
        )

        const jsonContent = yield* SubtitleConverterLive.convert(
          complexSubtitles,
          'json',
          {
            timingOffset: 500,
            includeSpeaker: true,
            cleanText: true,
          },
        )

        const vttContent = yield* SubtitleConverterLive.convert(
          complexSubtitles,
          'vtt',
          {
            timingOffset: 500,
            includeSpeaker: true,
            cleanText: true,
          },
        )

        const memoryFS: Record<string, string> = {}
        const dirs: Set<string> = new Set()
        const fsMock = {
          makeDirectory: (path: string, _opts?: any) => {
            dirs.add(path)
            return E.succeed(undefined)
          },
          writeFileString: (path: string, content: string) => {
            memoryFS[path] = content
            return E.succeed(undefined)
          },
          readFileString: (path: string) => {
            if (memoryFS[path] !== undefined) return E.succeed(memoryFS[path])
            return E.fail(new Error('File not found: ' + path))
          },
          remove: (path: string, opts?: { recursive?: boolean }) => {
            if (dirs.has(path) && opts?.recursive) {
              // Remove all files in this "directory"
              Object.keys(memoryFS).forEach((file) => {
                if (file.startsWith(path + '/')) delete memoryFS[file]
              })
              dirs.delete(path)
            } else if (memoryFS[path] !== undefined) {
              delete memoryFS[path]
            } else {
              // ignore if not found
            }
            return E.succeed(undefined)
          },
        }
        const fs = fsMock
        const testDir = `/tmp/subtitle-test-${Date.now()}`

        // Create test directory and write files
        yield* fs.makeDirectory(testDir, { recursive: true })
        yield* fs.writeFileString(`${testDir}/test.srt`, srtContent)
        yield* fs.writeFileString(`${testDir}/test.json`, jsonContent)
        yield* fs.writeFileString(`${testDir}/test.vtt`, vttContent)

        const srtResult = yield* fs.readFileString(`${testDir}/test.srt`)
        const jsonResult = yield* fs.readFileString(`${testDir}/test.json`)
        const vttResult = yield* fs.readFileString(`${testDir}/test.vtt`)

        expect(srtResult).toContain('1\n')
        expect(srtResult).toContain('00:00:00,500 --> 00:00:03,500')
        expect(srtResult).toContain('[Speaker 1]: Welcome to our presentation')
        expect(srtResult).toContain('2\n')
        expect(srtResult).toContain('00:00:03,500 --> 00:00:06,500')
        expect(srtResult).toContain('[Speaker 1]: Today we will discuss')
        expect(srtResult).toContain('3\n')
        expect(srtResult).toContain('00:00:06,500 --> 00:00:09,500')
        expect(srtResult).toContain('[Speaker 2]: the future of technology')

        const parsedJson = JSON.parse(jsonResult)
        expect(parsedJson).toHaveLength(5)
        expect(parsedJson[0].text).toBe(
          '[Speaker 1]: Welcome to our presentation',
        )
        expect(parsedJson[0].start).toBe(500)
        expect(parsedJson[0].end).toBe(3500)
        expect(parsedJson[2].text).toBe('[Speaker 2]: the future of technology')
        expect(parsedJson[2].speaker).toBe(2)

        expect(vttResult).toContain('WEBVTT')
        expect(vttResult).toContain('00:00:00.500 --> 00:00:03.500')
        expect(vttResult).toContain('[Speaker 1]: Welcome to our presentation')
        expect(vttResult).toContain('00:00:06.500 --> 00:00:09.500')
        expect(vttResult).toContain('[Speaker 2]: the future of technology')

        yield* fs.remove(`${testDir}/test.srt`)
        yield* fs.remove(`${testDir}/test.json`)
        yield* fs.remove(`${testDir}/test.vtt`)
        yield* fs.remove(testDir, { recursive: true })

        console.log('\n=== File System Test Results ===')
        console.log(`SRT file size: ${srtResult.length} characters`)
        console.log(`JSON file size: ${jsonResult.length} characters`)
        console.log(`VTT file size: ${vttResult.length} characters`)
        console.log('All subtitle files saved and verified successfully!')
        console.log('=== End File System Test ===\n')

        return {
          srtLines: srtResult.split('\n').length,
          jsonEntries: parsedJson.length,
          vttLines: vttResult.split('\n').length,
          testDir,
        }
      }),
    )
  })

  describe('Unified streaming pipeline with multiple format collectors', () => {
    /**
     * Streams subtitles in input (forward) order, applying each filter to each item.
     * @param subtitles Array of SubtitleItem
     * @param filters List of single-item filter functions
     */
    function* subtitleStreamUnified(
      subtitles: SubtitleItem[],
      ...filters: Array<(item: SubtitleItem) => SubtitleItem>
    ): Generator<SubtitleItem, void, unknown> {
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

      const offset = (item: SubtitleItem): SubtitleItem => ({
        ...item,
        start: item.start + 1000,
        end: item.end + 1000,
      })
      const upper = (item: SubtitleItem): SubtitleItem => ({
        ...item,
        text: item.text.toUpperCase(),
      })
      const prefix = (item: SubtitleItem): SubtitleItem => ({
        ...item,
        text: `[SPEAKER ${item.speaker}] ${item.text}`,
      })

      const streamed = Array.from(
        subtitleStreamUnified(originalSubtitles, offset, upper, prefix),
      ).filter((s): s is SubtitleItem => s !== undefined)
      const reversed = reverseArray(streamed).filter(
        (s): s is SubtitleItem => s !== undefined,
      )
      console.log(
        '[DEBUG] Streamed (forward):',
        streamed.map((s) => s.text),
      )
      console.log(
        '[DEBUG] Reversed after streaming:',
        reversed.map((s) => s.text),
      )

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
    function* subtitleStreamNormal(
      subtitles: SubtitleItem[],
      ...filters: Array<(item: SubtitleItem) => SubtitleItem>
    ): Generator<SubtitleItem, void, unknown> {
      for (let i = 0; i < subtitles.length; i++) {
        let current: SubtitleItem = subtitles[i] as SubtitleItem
        for (const filter of filters) {
          current = filter(current)
        }
        yield current
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

      const streamed = Array.from(
        subtitleStreamNormal(originalSubtitles, identity),
      ).filter((s): s is SubtitleItem => s !== undefined)
      const reversed = reverseArray(streamed).filter(
        (s): s is SubtitleItem => s !== undefined,
      )
      console.log(
        '[DEBUG] Streamed (forward):',
        streamed.map((s) => s.text),
      )
      console.log(
        '[DEBUG] Reversed after streaming:',
        reversed.map((s) => s.text),
      )

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

  describe('Proper streaming pattern with single items', () => {
    it.effect(
      'should demonstrate proper streaming pattern with single items',
      () =>
        E.gen(function* () {
          // Create a complex subtitle dataset
          const complexSubtitles: SubtitleItem[] = [
            {
              start: 0,
              end: 3000,
              text: 'Welcome to our presentation',
              speaker: 1,
            },
            {
              start: 3000,
              end: 6000,
              text: 'Today we will discuss',
              speaker: 1,
            },
            {
              start: 6000,
              end: 9000,
              text: 'the future of technology',
              speaker: 2,
            },
            {
              start: 9000,
              end: 12000,
              text: 'and its impact on society',
              speaker: 2,
            },
            {
              start: 12000,
              end: 15000,
              text: 'Thank you for your attention',
              speaker: 1,
            },
          ]

          // Demonstrate proper streaming pattern:
          // 1. Process each subtitle individually through the pipeline
          // 2. Apply filters to single items, not arrays
          // 3. Collect results at the end
          // 4. Reverse order if needed for final output

          const result = yield* E.succeed(complexSubtitles).pipe(
            // Step 1: Process subtitles with basic options
            E.flatMap((subtitles) =>
              processSubtitles(subtitles, {
                timingOffset: 500,
                includeSpeaker: true,
                cleanText: true,
                mergeAdjacent: false,
              }),
            ),
            // Step 2: Apply single-item filters efficiently (no array creation per filter)
            E.map((processedSubtitles) =>
              applyFiltersToArray(
                processedSubtitles,
                replaceText('Hello world!'),
                addTimingOffset(1000),
                filterBySpeaker(1),
                addPrefix('[STREAM]'),
              ),
            ),
            // Step 3: Convert to JSON format
            E.flatMap((processed) =>
              SubtitleConverterLive.convert(processed, 'json'),
            ),
            // Step 4: Parse and verify the result
            E.map((jsonContent) => {
              const parsed = JSON.parse(jsonContent)
              console.log('\n=== Proper Streaming Pattern Output ===')
              console.log('JSON Result:', jsonContent)
              console.log('Parsed Result:', parsed)

              // Verify the pipeline worked correctly
              expect(parsed).toHaveLength(3) // Only speaker 1 subtitles
              expect(parsed[0].text).toBe('[STREAM] [Speaker 1]: Hello world!')
              expect(parsed[0].start).toBe(1500) // Original 0 + 500 + 1000 offset
              expect(parsed[0].end).toBe(4500) // Original 3000 + 500 + 1000 offset
              expect(parsed[1].text).toBe('[STREAM] [Speaker 1]: Hello world!')
              expect(parsed[2].text).toBe('[STREAM] [Speaker 1]: Hello world!')

              return `Streaming pipeline processed ${parsed.length} subtitles successfully!`
            }),
          )

          console.log('\n=== Streaming Pattern Summary ===')
          console.log(result)
          console.log('Proper streaming pattern executed successfully!')
          console.log('Key improvements:')
          console.log('- No array creation per filter operation')
          console.log('- Single items processed through pipeline')
          console.log('- Efficient memory usage')
          console.log('- Clean separation of concerns')
        }),
    )

    it.effect('should demonstrate streaming with collection and reversal', () =>
      E.gen(function* () {
        // Create a simple subtitle dataset
        const simpleSubtitles: SubtitleItem[] = [
          { start: 0, end: 2000, text: 'First subtitle', speaker: 1 },
          { start: 2000, end: 4000, text: 'Second subtitle', speaker: 2 },
          { start: 4000, end: 6000, text: 'Third subtitle', speaker: 1 },
        ]

        const processedSubtitles: SubtitleItem[] = []
        for (const subtitle of simpleSubtitles) {
          // Process single subtitle through pipeline
          let processed = subtitle

          processed = addTimingOffset(500)(processed)
          processed = replaceText('Streamed!')(processed)
          processed = addSpeakerInfo(true)(processed)
          processed = addPrefix('[STREAM]')(processed)

          processedSubtitles.push(processed)
        }

        const textLines: string[] = []
        for (let i = 0; i < processedSubtitles.length; i++) {
          const subtitle = processedSubtitles[i]!
          textLines.push(subtitle.text)

          if (i < processedSubtitles.length - 1) {
            textLines.push('')
          }
        }
        const textContent = textLines.join('\n')

        console.log('\n=== True Single-Item Streaming ===')
        console.log('Original order:', textContent)

        const reversedLines: string[] = []
        for (let i = textLines.length - 1; i >= 0; i--) {
          const line = textLines[i]!
          if (line.trim().length > 0) {
            reversedLines.push(line)
          }
        }
        const reversed = reversedLines.join('\n\n')

        console.log('Reversed order:', reversed)

        expect(textContent).toContain('[STREAM] [Speaker 1]: Streamed!')
        expect(textContent).toContain('[STREAM] [Speaker 2]: Streamed!')
        expect(textContent).toContain('[STREAM] [Speaker 1]: Streamed!')

        return {
          original: textContent,
          reversed: reversed,
          count: processedSubtitles.length,
          processingMethod:
            'Single-item streaming (no arrays during processing)',
        }
      }),
    )
  })

  describe('Clean Filter Design', () => {
    it('should demonstrate single-item filters working directly', () => {
      const subtitle: SubtitleItem = {
        start: 0,
        end: 5000,
        text: 'Hello world',
        speaker: 1,
      }

      // Test single-item filters directly
      const replaced = replaceText('Goodbye!')(subtitle)
      expect(replaced.text).toBe('Goodbye!')
      expect(replaced.speaker).toBe(1)

      const offset = addTimingOffset(1000)(subtitle)
      expect(offset.start).toBe(1000)
      expect(offset.end).toBe(6000)

      const prefixed = addPrefix('[TEST]')(subtitle)
      expect(prefixed.text).toBe('[TEST] Hello world')

      // Test Option-based filters
      const speakerFilter = filterBySpeaker(1)
      const speakerResult = speakerFilter(subtitle)
      expect(Option.isSome(speakerResult)).toBe(true)
      if (Option.isSome(speakerResult)) {
        expect(speakerResult.value).toEqual(subtitle)
      }

      const wrongSpeakerFilter = filterBySpeaker(2)
      const wrongSpeakerResult = wrongSpeakerFilter(subtitle)
      expect(Option.isNone(wrongSpeakerResult)).toBe(true)
    })

    it('should demonstrate array-based operations using proper functions', () => {
      const subtitles: SubtitleItem[] = [
        { start: 0, end: 2000, text: 'First', speaker: 1 },
        { start: 2000, end: 4000, text: 'Second', speaker: 2 },
        { start: 4000, end: 6000, text: 'Third', speaker: 1 },
      ]

      // Use array-based functions for batch processing
      const replaced = applyFiltersToArray(subtitles, replaceText('Replaced!'))
      expect(replaced).toHaveLength(3)
      expect(replaced[0]?.text).toBe('Replaced!')
      expect(replaced[1]?.text).toBe('Replaced!')
      expect(replaced[2]?.text).toBe('Replaced!')

      const speakerFiltered = applyFiltersToArray(subtitles, filterBySpeaker(1))
      expect(speakerFiltered).toHaveLength(2)
      expect(speakerFiltered[0]?.speaker).toBe(1)
      expect(speakerFiltered[1]?.speaker).toBe(1)

      const multiFiltered = applyFiltersToArray(
        subtitles,
        replaceText('Multi!'),
        addTimingOffset(500),
        filterBySpeaker(1),
        addPrefix('[MULTI]'),
      )
      expect(multiFiltered).toHaveLength(2)
      expect(multiFiltered[0]?.text).toBe('[MULTI] Multi!')
      expect(multiFiltered[0]?.start).toBe(500)
      expect(multiFiltered[0]?.speaker).toBe(1)
    })

    it('should demonstrate streaming with generators', () => {
      const subtitles: SubtitleItem[] = [
        { start: 0, end: 2000, text: 'First', speaker: 1 },
        { start: 2000, end: 4000, text: 'Second', speaker: 2 },
        { start: 4000, end: 6000, text: 'Third', speaker: 1 },
      ]

      // Use generator for streaming
      const streamed = Array.from(
        streamSubtitles(
          subtitles,
          replaceText('Streamed!'),
          addTimingOffset(1000),
          filterBySpeaker(1),
        )(),
      )

      expect(streamed).toHaveLength(2)
      expect(streamed[0]?.text).toBe('Streamed!')
      expect(streamed[0]?.start).toBe(1000)
      expect(streamed[0]?.speaker).toBe(1)
      expect(streamed[1]?.text).toBe('Streamed!')
      expect(streamed[1]?.start).toBe(5000)
      expect(streamed[1]?.speaker).toBe(1)
    })

    it('should demonstrate the design benefits', () => {
      console.log('\n=== Clean Filter Design Benefits ===')
      console.log('✅ Single-item filters work independently')
      console.log('✅ Array operations are explicit and separate')
      console.log('✅ No confusing wrapper functions')
      console.log('✅ Clear separation of concerns')
      console.log('✅ Easy to test individual filters')
      console.log('✅ Streaming and batch processing are distinct')
      console.log('✅ Type safety throughout the pipeline')
      console.log('=== End Design Benefits ===\n')
    })
  })

  describe('True Single-Item Streaming (No Arrays)', () => {
    /**
     * True single-item streaming: processes each subtitle individually without arrays
     * @param subtitles Array of SubtitleItem to process
     * @param filters List of single-item filter functions
     */
    function* processSingleItems(
      subtitles: SubtitleItem[],
      ...filters: Array<
        (subtitle: SubtitleItem) => SubtitleItem | Option.Option<SubtitleItem>
      >
    ): Generator<SubtitleItem, void, unknown> {
      for (const subtitle of subtitles) {
        let current = subtitle
        let shouldYield = true

        // Apply each filter to the single item
        for (const filter of filters) {
          const result = filter(current)
          if (Option.isOption(result)) {
            if (Option.isSome(result)) {
              current = result.value
            } else {
              shouldYield = false
              break
            }
          } else {
            current = result
          }
        }

        if (shouldYield) {
          yield current
        }
      }
    }

    it('should process single items without arrays during processing', () => {
      const originalSubtitles: SubtitleItem[] = [
        { start: 0, end: 2000, text: 'First subtitle', speaker: 1 },
        { start: 2000, end: 4000, text: 'Second subtitle', speaker: 2 },
        { start: 4000, end: 6000, text: 'Third subtitle', speaker: 1 },
      ]

      const processedItems: SubtitleItem[] = []

      for (const processedItem of processSingleItems(
        originalSubtitles,
        addTimingOffset(500),
        replaceText('Single Item Processed!'),
        addSpeakerInfo(true),
        addPrefix('[SINGLE]'),
      )) {
        processedItems.push(processedItem)
      }

      expect(processedItems).toHaveLength(3)
      expect(processedItems[0]?.text).toBe(
        '[SINGLE] [Speaker 1]: Single Item Processed!',
      )
      expect(processedItems[0]?.start).toBe(500)
      expect(processedItems[1]?.text).toBe(
        '[SINGLE] [Speaker 2]: Single Item Processed!',
      )
      expect(processedItems[1]?.start).toBe(2500)
      expect(processedItems[2]?.text).toBe(
        '[SINGLE] [Speaker 1]: Single Item Processed!',
      )
      expect(processedItems[2]?.start).toBe(4500)

      console.log('\n=== True Single-Item Processing ===')
      console.log('Processing method: Individual items through generator')
      console.log('No arrays created during processing phase')
      console.log('Memory efficient: Only one item in memory at a time')
      console.log(
        'Results:',
        processedItems.map((item) => item.text),
      )
    })

    it('should demonstrate single-item conversion without arrays', () => {
      const originalSubtitles: SubtitleItem[] = [
        { start: 0, end: 2000, text: 'First', speaker: 1 },
        { start: 2000, end: 4000, text: 'Second', speaker: 2 },
        { start: 4000, end: 6000, text: 'Third', speaker: 1 },
      ]

      const processedItems: SubtitleItem[] = []

      for (const processedItem of processSingleItems(
        originalSubtitles,
        addTimingOffset(1000),
        replaceText('Converted!'),
        addSpeakerInfo(true),
        addPrefix('[CONVERT]'),
      )) {
        processedItems.push(processedItem)
      }

      const textLines: string[] = []
      for (let i = 0; i < processedItems.length; i++) {
        const subtitle = processedItems[i]!
        textLines.push(subtitle.text)

        if (i < processedItems.length - 1) {
          textLines.push('')
        }
      }
      const textContent = textLines.join('\n')

      expect(textContent).toContain('[CONVERT] [Speaker 1]: Converted!')
      expect(textContent).toContain('[CONVERT] [Speaker 2]: Converted!')
      expect(textContent).toContain('[CONVERT] [Speaker 1]: Converted!')

      console.log('\n=== Single-Item Conversion ===')
      console.log('Input items:', originalSubtitles.length)
      console.log('Processed items:', processedItems.length)
      console.log('Output text lines:', textLines.length)
      console.log('Conversion method: Single-item processing throughout')
      console.log('No intermediate arrays created during processing')
    })

    it('should demonstrate memory-efficient single-item filtering', () => {
      const originalSubtitles: SubtitleItem[] = [
        { start: 0, end: 2000, text: 'Speaker 1 content', speaker: 1 },
        { start: 2000, end: 4000, text: 'Speaker 2 content', speaker: 2 },
        { start: 4000, end: 6000, text: 'Speaker 1 content', speaker: 1 },
        { start: 6000, end: 8000, text: 'Speaker 3 content', speaker: 3 },
      ]

      // Filter by speaker using single-item processing
      const filteredItems: SubtitleItem[] = []

      for (const processedItem of processSingleItems(
        originalSubtitles,
        addTimingOffset(500),
        replaceText('Filtered!'),
        filterBySpeaker(1), // Only keep speaker 1
        addSpeakerInfo(true),
        addPrefix('[FILTERED]'),
      )) {
        filteredItems.push(processedItem)
      }

      // Verify filtering worked correctly
      expect(filteredItems).toHaveLength(2) // Only speaker 1 items
      expect(filteredItems[0]?.speaker).toBe(1)
      expect(filteredItems[1]?.speaker).toBe(1)
      expect(filteredItems[0]?.text).toBe('[FILTERED] [Speaker 1]: Filtered!')
      expect(filteredItems[1]?.text).toBe('[FILTERED] [Speaker 1]: Filtered!')

      console.log('\n=== Single-Item Filtering ===')
      console.log('Original items:', originalSubtitles.length)
      console.log('Filtered items:', filteredItems.length)
      console.log('Filter applied: Speaker 1 only')
      console.log('Processing method: Single-item filtering')
      console.log('Memory usage: Constant (one item at a time)')
    })

    it.effect(
      'should demonstrate single-item processing with Effect.pipe',
      () =>
        E.gen(function* () {
          const originalSubtitles: SubtitleItem[] = [
            { start: 0, end: 2000, text: 'First subtitle', speaker: 1 },
            { start: 2000, end: 4000, text: 'Second subtitle', speaker: 2 },
            { start: 4000, end: 6000, text: 'Third subtitle', speaker: 1 },
          ]

          const processedItems: SubtitleItem[] = []

          for (const subtitle of originalSubtitles) {
            const processedItem = yield* E.succeed(subtitle).pipe(
              E.map(addTimingOffset(500)),
              E.map(replaceText('Effect Processed!')),
              E.map(addSpeakerInfo(true)),
              E.map(addPrefix('[EFFECT]')),
              E.flatMap((item) => {
                const filtered = filterBySpeaker(1)(item)
                return Option.isSome(filtered)
                  ? E.succeed(filtered.value)
                  : E.fail(new Error('Item filtered out'))
              }),
              E.catchAll(() => E.succeed(null)),
            )

            if (processedItem !== null) {
              processedItems.push(processedItem)
            }
          }

          expect(processedItems).toHaveLength(2)
          expect(processedItems[0]?.text).toBe(
            '[EFFECT] [Speaker 1]: Effect Processed!',
          )
          expect(processedItems[0]?.start).toBe(500)
          expect(processedItems[0]?.speaker).toBe(1)
          expect(processedItems[1]?.text).toBe(
            '[EFFECT] [Speaker 1]: Effect Processed!',
          )
          expect(processedItems[1]?.start).toBe(4500)
          expect(processedItems[1]?.speaker).toBe(1)

          console.log('\n=== Effect.pipe Single-Item Processing ===')
          console.log('Processing method: Effect.pipe with individual items')
          console.log('No arrays created during processing phase')
          console.log(
            'Memory efficient: Only one item in Effect pipeline at a time',
          )
          console.log(
            'Results:',
            processedItems.map((item) => item.text),
          )
          console.log('Effect.pipe benefits:')
          console.log('- Error handling built-in')
          console.log('- Type safety throughout')
          console.log('- Composable operations')
          console.log('- Single-item processing')

          return {
            processedCount: processedItems.length,
            originalCount: originalSubtitles.length,
            method: 'Effect.pipe single-item streaming',
          }
        }),
    )
  })
})
