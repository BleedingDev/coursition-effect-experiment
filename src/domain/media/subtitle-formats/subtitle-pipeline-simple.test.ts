import { describe, expect, it } from 'vitest'
import {
  addPrefix,
  addTimingOffset,
  capitalize,
  filterBySpeakers,
  removeEmptySubtitles,
  toUpperCase,
  transformText,
  validateSubtitle,
} from './subtitle-filters'
import type { SubtitleItem } from './subtitle-formats.schema'
import {
  type PipelineConfig,
  SubtitlePipeline,
  applyFilters,
  createArrayPipeline,
  createCollector,
  createPipeline,
  formatToJson,
  formatToPlainText,
  formatToSrt,
  formatToVtt,
  processToSrt,
  processToVtt,
  processWithConfig,
} from './subtitle-pipeline-simple'

// ============================================================================
// Test Data
// ============================================================================

const testSubtitles: SubtitleItem[] = [
  {
    start: 0,
    end: 2000,
    text: 'Hello, world.',
    speaker: 1,
  },
  {
    start: 2000,
    end: 4000,
    text: 'This is a test.',
    speaker: 2,
  },
  {
    start: 4000,
    end: 6000,
    text: 'Testing the pipeline.',
    speaker: 1,
  },
  {
    start: 6000,
    end: 8000,
    text: '',
    speaker: 3,
  },
]

// ============================================================================
// Pipeline Creation Tests
// ============================================================================

describe('SubtitlePipeline Simple', () => {
  describe('Pipeline Creation', () => {
    it('should create a basic pipeline', () => {
      const pipeline = createPipeline()
      expect(pipeline).toBeInstanceOf(SubtitlePipeline)
    })

    it('should create an array pipeline', () => {
      const pipeline = createArrayPipeline(testSubtitles)
      expect(pipeline).toBeInstanceOf(SubtitlePipeline)
    })

    it('should create a pipeline with custom config', () => {
      const config: PipelineConfig = {
        parallelProcessing: false,
        batchSize: 5,
        bufferSize: 50,
      }
      const pipeline = createArrayPipeline(testSubtitles, config)
      expect(pipeline).toBeInstanceOf(SubtitlePipeline)
    })
  })

  describe('Basic Pipeline Execution', () => {
    it('should execute a simple pipeline with uppercase filter', () => {
      const result = createArrayPipeline(testSubtitles)
        .filter(toUpperCase)
        .collector(createCollector())
        .execute()

      expect(result).toBeInstanceOf(Array)
      const items = result as SubtitleItem[]
      expect(items.length).toBe(4)
      expect(items[0]?.text).toBe('HELLO, WORLD.')
    })

    it('should execute a pipeline with multiple filters', () => {
      const result = createArrayPipeline(testSubtitles)
        .filter(
          applyFilters(removeEmptySubtitles, toUpperCase, addPrefix('[TEST]')),
        )
        .collector(createCollector())
        .execute()

      expect(result).toBeInstanceOf(Array)
      const items = result as SubtitleItem[]
      expect(items.length).toBe(3) // Empty subtitle filtered out
      expect(items[0]?.text).toBe('[TEST] HELLO, WORLD.')
    })
  })

  describe('Formatter Tests', () => {
    it('should format to SRT correctly', () => {
      const result = createArrayPipeline(testSubtitles)
        .filter(removeEmptySubtitles)
        .collector(createCollector())
        .formatter(formatToSrt)
        .execute()

      expect(result).toBeInstanceOf(Array)
      const strings = result as string[]
      expect(strings.length).toBeGreaterThan(0)
      expect(strings[0]).toBe('1')
      expect(strings[1]).toMatch(
        /^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/,
      )
    })

    it('should format to VTT correctly', () => {
      const result = createArrayPipeline(testSubtitles)
        .filter(removeEmptySubtitles)
        .collector(createCollector())
        .formatter(formatToVtt)
        .execute()

      expect(result).toBeInstanceOf(Array)
      const strings = result as string[]
      expect(strings[0]).toBe('WEBVTT')
      expect(strings[1]).toBe('')
    })

    it('should format to plain text correctly', () => {
      const result = createArrayPipeline(testSubtitles)
        .filter(removeEmptySubtitles)
        .collector(createCollector())
        .formatter(formatToPlainText)
        .execute()

      expect(result).toBeInstanceOf(Array)
      const strings = result as string[]
      expect(strings.length).toBe(3)
      expect(strings[0]).toBe('Hello, world.')
    })

    it('should format to JSON correctly', () => {
      const result = createArrayPipeline(testSubtitles)
        .filter(removeEmptySubtitles)
        .collector(createCollector())
        .formatter(formatToJson)
        .execute()

      expect(result).toBeInstanceOf(Array)
      const strings = result as string[]
      expect(strings.length).toBe(1)
      const jsonContent = JSON.parse(strings[0]!)
      expect(jsonContent).toBeInstanceOf(Array)
      expect(jsonContent.length).toBe(3)
    })
  })

  describe('Filter Tests', () => {
    it('should filter by speaker correctly', () => {
      const result = createArrayPipeline(testSubtitles)
        .filter(applyFilters(filterBySpeakers([1]), removeEmptySubtitles))
        .collector(createCollector())
        .execute()

      expect(result).toBeInstanceOf(Array)
      const items = result as SubtitleItem[]
      expect(items.length).toBe(2)
      expect(items.every((item) => item.speaker === 1)).toBe(true)
    })

    it('should add timing offset correctly', () => {
      const result = createArrayPipeline(testSubtitles)
        .filter(applyFilters(addTimingOffset(1000), removeEmptySubtitles))
        .collector(createCollector())
        .execute()

      expect(result).toBeInstanceOf(Array)
      const items = result as SubtitleItem[]
      expect(items[0]?.start).toBe(1000)
      expect(items[0]?.end).toBe(3000)
    })

    it('should transform text correctly', () => {
      const customTransform = transformText((text) =>
        text.replace(/world/gi, 'WORLD'),
      )

      const result = createArrayPipeline(testSubtitles)
        .filter(applyFilters(customTransform, removeEmptySubtitles))
        .collector(createCollector())
        .execute()

      expect(result).toBeInstanceOf(Array)
      const items = result as SubtitleItem[]
      expect(items[0]?.text).toBe('Hello, WORLD.')
    })
  })

  describe('Parallel Processing Tests', () => {
    it('should process items in parallel', () => {
      const config: PipelineConfig = {
        parallelProcessing: true,
        batchSize: 2,
        bufferSize: 10,
      }

      const result = createArrayPipeline(testSubtitles, config)
        .filter(applyFilters(toUpperCase, addPrefix('[PARALLEL]')))
        .collector(createCollector())
        .execute()

      expect(result).toBeInstanceOf(Array)
      const items = result as SubtitleItem[]
      expect(items.length).toBe(4)
      expect(items[0]?.text).toBe('[PARALLEL] HELLO, WORLD.')
    })

    it('should process items sequentially when parallel is disabled', () => {
      const config: PipelineConfig = {
        parallelProcessing: false,
        batchSize: 2,
        bufferSize: 10,
      }

      const result = createArrayPipeline(testSubtitles, config)
        .filter(applyFilters(toUpperCase, addPrefix('[SEQUENTIAL]')))
        .collector(createCollector())
        .execute()

      expect(result).toBeInstanceOf(Array)
      const items = result as SubtitleItem[]
      expect(items.length).toBe(4)
      expect(items[0]?.text).toBe('[SEQUENTIAL] HELLO, WORLD.')
    })
  })

  describe('Pre-built Function Tests', () => {
    it('should process to SRT using pre-built function', () => {
      const result = processToSrt(testSubtitles, [
        removeEmptySubtitles,
        toUpperCase,
      ])

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should process to VTT using pre-built function', () => {
      const result = processToVtt(testSubtitles, [
        removeEmptySubtitles,
        capitalize,
      ])

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should process with custom config', () => {
      const config: PipelineConfig = {
        parallelProcessing: true,
        batchSize: 5,
        bufferSize: 20,
      }

      const result = processWithConfig(
        testSubtitles,
        [removeEmptySubtitles, toUpperCase],
        config,
      )

      expect(result).toBeInstanceOf(Array)
    })
  })

  describe('Error Handling Tests', () => {
    it('should handle invalid subtitle items gracefully', () => {
      const invalidSubtitles: SubtitleItem[] = [
        {
          start: -1000, // Invalid start time
          end: 2000,
          text: 'Invalid subtitle',
          speaker: 1,
        },
        {
          start: 0,
          end: 0, // Invalid end time
          text: 'Another invalid subtitle',
          speaker: 2,
        },
      ]

      const result = createArrayPipeline(invalidSubtitles)
        .filter(validateSubtitle)
        .collector(createCollector())
        .execute()

      expect(result).toBeInstanceOf(Array)
      expect((result as SubtitleItem[]).length).toBe(0) // All invalid items should be filtered out
    })

    it('should handle empty input gracefully', () => {
      const result = createArrayPipeline([])
        .filter(toUpperCase)
        .collector(createCollector())
        .execute()

      expect(result).toBeInstanceOf(Array)
      expect((result as SubtitleItem[]).length).toBe(0)
    })
  })

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', () => {
      const largeDataset: SubtitleItem[] = []
      for (let i = 0; i < 100; i++) {
        largeDataset.push({
          start: i * 1000,
          end: (i + 1) * 1000,
          text: `Subtitle ${i + 1}`,
          speaker: (i % 3) + 1,
        })
      }

      const startTime = Date.now()
      const result = createArrayPipeline(largeDataset)
        .filter(
          applyFilters(validateSubtitle, toUpperCase, addPrefix('[PROCESSED]')),
        )
        .collector(createCollector())
        .formatter(formatToSrt)
        .execute()
      const endTime = Date.now()

      expect(result).toBeInstanceOf(Array)
      expect((result as string[]).length).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })
  })
})
