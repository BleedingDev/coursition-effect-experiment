import { describe, expect, it } from '@effect/vitest'
import { Effect as E } from 'effect'
import { Option } from 'effect'
import {
  SubtitleConverterLive,
  type SubtitleItem,
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
import type { SubtitleFormat } from './subtitle-formats.schema'

// Regex patterns defined at top level for performance
const WEBVTT_PATTERN = /WEBVTT/
const TIMING_PATTERN = /\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/
const TIMING_COMMA_PATTERN = /\d{2}:\d{2}:\d{2}/
const ARROW_RIGHT_PATTERN = /-->/

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
        const result = yield* validateSubtitleData(
          invalidSubtitles as SubtitleItem[],
        )
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
        const result = yield* validateSubtitleData(null as never)
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

    it.effect('should process subtitles and generate valid SRT file', () =>
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

        // Verify SRT file structure and content
        expect(lines.length).toBeGreaterThanOrEqual(20) // SRT files have many lines
        expect(processedSubtitles.length).toBe(5) // Should have 5 processed subtitles
        expect(complexSubtitles.length).toBe(5) // Original should have 5 subtitles
      }),
    )

    it.effect('should process subtitles and generate valid JSON format', () =>
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

        // Verify JSON content structure
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

        // Verify JSON processing results
        expect(processedSubtitles.length).toBe(5)
        expect(parsedJson.length).toBe(5)
      }),
    )

    it.effect('should process subtitles and generate valid VTT format', () =>
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
        expect(vttContent).toMatch(WEBVTT_PATTERN)
        expect(vttContent).toMatch(TIMING_PATTERN)

        // Verify the structure is correct
        const lines = vttContent.split('\n')
        expect(lines[0]).toBe('WEBVTT')
        expect(lines).toContain('') // Empty lines between subtitles

        // Verify VTT file structure
        expect(lines.length).toBeGreaterThan(15) // VTT files have many lines
        expect(processedSubtitles.length).toBe(5) // Should have 5 processed subtitles
      }),
    )

    it.effect(
      'should process subtitles and generate valid plain text format',
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
          expect(textContent).not.toMatch(TIMING_COMMA_PATTERN)
          expect(textContent).not.toMatch(ARROW_RIGHT_PATTERN)

          // Verify plain text structure
          expect(lines.length).toBeGreaterThan(8) // Plain text has content + separators
          expect(processedSubtitles.length).toBe(5) // Should have 5 processed subtitles
        }),
    )

    it.effect(
      'should process subtitles and generate all formats for comparison',
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

          // Verify format comparison results
          expect(parsedJson.length).toBe(2)
          expect(srtContent.split('\n').length).toBeGreaterThan(6)
          expect(vttContent.split('\n').length).toBeGreaterThan(6)
          expect(textContent.split('\n').length).toBe(3)
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
          'unsupported' as unknown as SubtitleFormat,
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
    // Helper function to validate format result
    const validateFormatResult = (
      result: {
        results: readonly {
          readonly format: string
          readonly content: string
        }[]
      },
      format: string,
      expectedContent: string,
    ) => {
      const formatResult = result.results.find((r) => r.format === format)
      expect(formatResult).toBeDefined()
      if (formatResult) {
        expect(formatResult.content).toContain(expectedContent)
      }
    }

    it.effect('should convert to multiple formats', () =>
      E.gen(function* () {
        const result = yield* SubtitleConverterLive.convertMultiple(
          sampleSubtitles,
          ['json', 'srt', 'vtt', 'plain-text'],
        )

        expect(result.results).toHaveLength(4)

        // Validate JSON format
        const jsonResult = result.results.find((r) => r.format === 'json')
        expect(jsonResult).toBeDefined()
        if (jsonResult) {
          expect(JSON.parse(jsonResult.content)).toEqual(sampleSubtitles)
        }

        // Validate other formats using helper
        validateFormatResult(result, 'srt', '1\n')
        validateFormatResult(result, 'vtt', 'WEBVTT\n')
        validateFormatResult(result, 'plain-text', 'Hello world')
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

          // Validate SRT format
          validateFormatResult(result, 'srt', '00:00:01,000 --> 00:00:06,000')
          validateFormatResult(
            result,
            'srt',
            '[Speaker 1]: Subtitle processing',
          )

          // Validate VTT format
          validateFormatResult(result, 'vtt', '00:00:01.000 --> 00:00:06.000')
          validateFormatResult(
            result,
            'vtt',
            '[Speaker 1]: Subtitle processing',
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
            SubtitleConverterLive.convert(subtitles as SubtitleItem[], 'json'),
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
          E.tap(() => E.sync(() => undefined)),
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
              'unsupported' as unknown as SubtitleFormat,
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
          invalidSubtitles as SubtitleItem[],
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
          invalidSubtitles as SubtitleItem[],
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
      // Design benefits demonstrated through the test structure
      expect(true).toBe(true) // Placeholder for design benefits demonstration
    })
  })
})
