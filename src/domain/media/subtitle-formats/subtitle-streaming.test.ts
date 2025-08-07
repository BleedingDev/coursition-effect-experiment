import { Effect as E } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  addPrefix,
  // Individual filters
  addTimingOffset,
  applyFilters,
  collectGenerator,
  collectStream,
  createSubtitleStream,
  filterBySpeaker,
  processAndCollect,
  processSubtitlesParallel,
  processSubtitlesWithGenerator,
  removeEmptySubtitles,
  streamSubtitlesGenerator,
  toUpperCase,
  validateSubtitle,
} from './subtitle-filters'
import type { SubtitleItem } from './subtitle-formats.schema'

// Test data
const testSubtitles: SubtitleItem[] = [
  { start: 0, end: 2000, text: 'Hello, world!', speaker: 1 },
  {
    start: 2500,
    end: 4500,
    text: 'Welcome to the subtitle converter.',
    speaker: 2,
  },
  { start: 5000, end: 7000, text: 'This is a test.', speaker: 1 },
  { start: 7500, end: 9500, text: '', speaker: 3 }, // Empty subtitle
  { start: 10000, end: 12000, text: 'Processing with streams.', speaker: 2 },
]

describe('Streaming Subtitle Filters', () => {
  describe('Basic Streaming Operations', () => {
    it('should create a stream from subtitle array', async () => {
      const result = await E.runPromise(
        collectStream(createSubtitleStream(testSubtitles)),
      )

      expect(result).toHaveLength(5)
      expect(result[0]).toEqual(testSubtitles[0])
      expect(result[4]).toEqual(testSubtitles[4])
    })

    it('should apply single filter to stream', async () => {
      const result = await E.runPromise(
        collectStream(
          createSubtitleStream(testSubtitles).pipe(applyFilters(toUpperCase)),
        ),
      )

      expect(result).toHaveLength(5)
      expect(result[0]?.text).toBe('HELLO, WORLD!')
      expect(result[1]?.text).toBe('WELCOME TO THE SUBTITLE CONVERTER.')
    })

    it('should apply multiple filters to stream', async () => {
      const result = await E.runPromise(
        collectStream(
          createSubtitleStream(testSubtitles).pipe(
            applyFilters(
              removeEmptySubtitles,
              addTimingOffset(1000),
              toUpperCase,
            ),
          ),
        ),
      )

      expect(result).toHaveLength(3) // One empty subtitle filtered out
      expect(result[0]?.start).toBe(1000) // Timing offset applied
      expect(result[0]?.text).toBe('HELLO, WORLD!') // Text transformed
    })
  })

  describe('Pipeline Processing', () => {
    it('should process subtitles through pipeline', async () => {
      const result = await E.runPromise(
        processAndCollect(
          testSubtitles,
          removeEmptySubtitles,
          addTimingOffset(500),
          filterBySpeaker(1),
        ),
      )

      expect(result).toHaveLength(1) // Only speaker 1, no empty subtitles
      expect(result[0]?.start).toBe(500) // Timing offset applied
    })

    it('should process subtitles in parallel', async () => {
      const result = await E.runPromise(
        processSubtitlesParallel(
          testSubtitles,
          removeEmptySubtitles,
          addPrefix('[PROCESSED]'),
          filterBySpeaker(2),
        ),
      )

      expect(result).toHaveLength(0) // Only speaker 2, no empty subtitles
    })
  })

  describe('Generator Processing', () => {
    it('should process subtitles using generator', () => {
      const generator = streamSubtitlesGenerator(
        testSubtitles,
        validateSubtitle,
        removeEmptySubtitles,
        toUpperCase,
      )

      const result = collectGenerator(generator)

      expect(result).toHaveLength(4) // One empty subtitle filtered out
      expect(result[0]?.text).toBe('HELLO, WORLD!')
      expect(result[1]?.text).toBe('WELCOME TO THE SUBTITLE CONVERTER.')
    })

    it('should process subtitles with generator function', () => {
      const result = processSubtitlesWithGenerator(
        testSubtitles,
        validateSubtitle,
        addTimingOffset(-500),
        removeEmptySubtitles,
        filterBySpeaker(1),
      )

      expect(result).toHaveLength(2) // Only speaker 1, no empty subtitles
      expect(result[0]?.start).toBe(0) // Timing offset applied
      expect(result[1]?.start).toBe(4500) // Timing offset applied
    })
  })

  describe('Filter Operations', () => {
    it('should filter by speaker', async () => {
      const result = await E.runPromise(
        collectStream(
          createSubtitleStream(testSubtitles).pipe(
            applyFilters(filterBySpeaker(1)),
          ),
        ),
      )

      expect(result).toHaveLength(1)
      expect(result[0]?.speaker).toBe(1)
    })

    it('should remove empty subtitles', async () => {
      const result = await E.runPromise(
        collectStream(
          createSubtitleStream(testSubtitles).pipe(
            applyFilters(removeEmptySubtitles),
          ),
        ),
      )

      expect(result).toHaveLength(3) // One empty subtitle removed
      expect(result.every((subtitle) => subtitle.text.trim().length > 0)).toBe(
        true,
      )
    })

    it('should add timing offset', async () => {
      const result = await E.runPromise(
        collectStream(
          createSubtitleStream(testSubtitles).pipe(
            applyFilters(addTimingOffset(1000)),
          ),
        ),
      )

      expect(result).toHaveLength(5)
      expect(result[0]?.start).toBe(1000)
      expect(result[0]?.end).toBe(3000)
      expect(result[1]?.start).toBe(3500)
      expect(result[1]?.end).toBe(5500)
    })

    it('should transform text to uppercase', async () => {
      const result = await E.runPromise(
        collectStream(
          createSubtitleStream(testSubtitles).pipe(applyFilters(toUpperCase)),
        ),
      )

      expect(result).toHaveLength(5)
      expect(result[0]?.text).toBe('HELLO, WORLD!')
      expect(result[1]?.text).toBe('WELCOME TO THE SUBTITLE CONVERTER.')
    })

    it('should add prefix to text', async () => {
      const result = await E.runPromise(
        collectStream(
          createSubtitleStream(testSubtitles).pipe(
            applyFilters(addPrefix('[TEST]')),
          ),
        ),
      )

      expect(result).toHaveLength(5)
      expect(result[0]?.text).toBe('[TEST] Hello, world!')
      expect(result[1]?.text).toBe('[TEST] Welcome to the subtitle converter.')
    })
  })

  describe('Validation and Error Handling', () => {
    it('should validate subtitles and filter invalid ones', () => {
      const invalidSubtitles: SubtitleItem[] = [
        { start: -1000, end: 0, text: 'Invalid timing', speaker: 1 },
        { start: 2000, end: 1000, text: 'Invalid order', speaker: 2 },
        { start: 0, end: 2000, text: 'Valid subtitle', speaker: 3 },
      ]

      const result = processSubtitlesWithGenerator(
        invalidSubtitles,
        validateSubtitle,
      )

      expect(result).toHaveLength(1) // Only valid subtitle remains
      expect(result[0]?.text).toBe('Valid subtitle')
    })

    it('should handle empty subtitle array', async () => {
      const result = await E.runPromise(collectStream(createSubtitleStream([])))

      expect(result).toHaveLength(0)
    })
  })

  describe('Complex Pipeline Operations', () => {
    it('should handle complex filter chain', async () => {
      const result = await E.runPromise(
        collectStream(
          createSubtitleStream(testSubtitles).pipe(
            applyFilters(validateSubtitle, removeEmptySubtitles),
            applyFilters(addTimingOffset(2000)),
            applyFilters(toUpperCase, addPrefix('[PROCESSED]')),
            applyFilters(filterBySpeaker(1)),
          ),
        ),
      )

      expect(result).toHaveLength(1) // Only speaker 1, no empty subtitles
      expect(result[0]?.start).toBe(2000) // Timing offset applied
      expect(result[0]?.text).toBe('[PROCESSED] HELLO, WORLD!') // Text transformed
    })

    it('should process large subtitle arrays efficiently', async () => {
      // Create a large array of subtitles
      const largeSubtitles: SubtitleItem[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          start: i * 1000,
          end: (i + 1) * 1000,
          text: `Subtitle ${i}`,
          speaker: (i % 3) + 1,
        }),
      )

      const result = await E.runPromise(
        processAndCollect(
          largeSubtitles,
          addTimingOffset(500),
          filterBySpeaker(1),
          toUpperCase,
        ),
      )

      expect(result.length).toBeGreaterThan(0)
      expect(result.every((subtitle) => subtitle.speaker === 1)).toBe(true)
      expect(
        result.every(
          (subtitle) => subtitle.text === subtitle.text.toUpperCase(),
        ),
      ).toBe(true)
      expect(result.every((subtitle) => subtitle.start >= 500)).toBe(true)
    })
  })
})
