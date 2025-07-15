import { describe, expect, it } from '@effect/vitest'
import { Effect as E } from 'effect'
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

/**
 * Sample subtitle data for testing
 */
const sampleSubtitles: SubtitleItem[] = [
  { start: 0, end: 5000, text: 'Hello world' },
  { start: 5000, end: 10000, text: 'This is a test' },
  { start: 10000, end: 15000, text: 'Subtitle processing', speaker: 1 },
]

/**
 * Invalid subtitle data for testing error cases
 */
const invalidSubtitles = [
  { start: -1000, end: 5000, text: 'Negative start time' },
  { start: 5000, end: 3000, text: 'End before start' },
  { start: 10000, end: 15000, text: '' }, // Empty text
]

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
  })
}) 