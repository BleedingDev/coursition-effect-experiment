import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Effect as E } from 'effect'
import { 
  enhancedProcessSubtitlesHandler,
  processSubtitlesHandler,
  getSupportedFormatsHandler, 
  healthCheckHandler 
} from './subtitle-processor-enhanced.handler'
import { ProcessSubtitlesRequest } from './endpoints'
import { SubtitleItem, SubtitleFormat } from './subtitle-formats.schema'
import { 
  SubtitleDataInvalid, 
  SubtitleFormatUnsupported, 
  SubtitleConversionFailed,
  SubtitleProcessingFailed 
} from './subtitle-formats.errors'

// Mock the subtitle converter
vi.mock('./subtitle-converter', () => ({
  SubtitleConverterLive: {
    convert: vi.fn()
  }
}))

// Get the mocked module
const { SubtitleConverterLive } = await import('./subtitle-converter')
const mockConvert = vi.mocked(SubtitleConverterLive.convert)

describe('Enhanced Subtitle Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('enhancedProcessSubtitlesHandler', () => {
    it('should process single format request successfully', async () => {
      const request = {
        title: 'Single Format Test',
        outputFormat: 'srt',
        subtitleData: [
          {
            start: 0,
            end: 1000,
            text: 'Hello, world!',
            speaker: 1
          }
        ]
      }

      // Mock successful conversion
      mockConvert.mockReturnValue(E.succeed('1\n00:00:00,000 --> 00:00:01,000\nHello, world!'))

      const result = await E.runPromise(enhancedProcessSubtitlesHandler(request))

      expect(result.title).toBe('Single Format Test')
      expect(result.results).toHaveLength(1)
      expect(result.results[0].format).toBe('srt')
      expect(result.results[0].content).toContain('Hello, world!')
      expect(result.totalItemCount).toBe(1)
      expect(result.processedAt).toBeDefined()
    })

    it('should process multiple format request successfully', async () => {
      const request = {
        title: 'Multi Format Test',
        outputFormat: 'srt,vtt,json',
        subtitleData: [
          {
            start: 0,
            end: 1000,
            text: 'Multi format test'
          }
        ]
      }

      // Mock successful conversions for each format
      mockConvert
        .mockReturnValueOnce(E.succeed('1\n00:00:00,000 --> 00:00:01,000\nMulti format test'))
        .mockReturnValueOnce(E.succeed('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nMulti format test'))
        .mockReturnValueOnce(E.succeed('[{"start":0,"end":1000,"text":"Multi format test"}]'))

      const result = await E.runPromise(enhancedProcessSubtitlesHandler(request))

      expect(result.title).toBe('Multi Format Test')
      expect(result.results).toHaveLength(3)
      expect(result.results[0].format).toBe('srt')
      expect(result.results[1].format).toBe('vtt')
      expect(result.results[2].format).toBe('json')
      expect(result.totalItemCount).toBe(1)
    })

    it('should handle mixed case and whitespace in format string', async () => {
      const request = {
        title: 'Mixed Case Test',
        outputFormat: ' SRT , VTT , JSON ',
        subtitleData: [
          {
            start: 0,
            end: 1000,
            text: 'Mixed case test'
          }
        ]
      }

      mockConvert
        .mockReturnValueOnce(E.succeed('1\n00:00:00,000 --> 00:00:01,000\nMixed case test'))
        .mockReturnValueOnce(E.succeed('WEBVTT\n\n00:00:00.000 --> 00:00:01,000\nMixed case test'))
        .mockReturnValueOnce(E.succeed('[{"start":0,"end":1000,"text":"Mixed case test"}]'))

      const result = await E.runPromise(enhancedProcessSubtitlesHandler(request))

      expect(result.results).toHaveLength(3)
      expect(result.results[0].format).toBe('srt')
      expect(result.results[1].format).toBe('vtt')
      expect(result.results[2].format).toBe('json')
    })

    it('should fail with SubtitleFormatUnsupported for invalid format', async () => {
      const request = {
        title: 'Invalid Format Test',
        outputFormat: 'invalid',
        subtitleData: [
          {
            start: 0,
            end: 1000,
            text: 'Test'
          }
        ]
      }

      await expect(
        E.runPromise(enhancedProcessSubtitlesHandler(request))
      ).rejects.toThrow()
    })

    it('should fail with SubtitleFormatUnsupported for mixed valid/invalid formats', async () => {
      const request = {
        title: 'Mixed Valid/Invalid Test',
        outputFormat: 'srt,invalid,vtt',
        subtitleData: [
          {
            start: 0,
            end: 1000,
            text: 'Test'
          }
        ]
      }

      await expect(
        E.runPromise(enhancedProcessSubtitlesHandler(request))
      ).rejects.toThrow()
    })

    it('should fail with SubtitleDataInvalid for empty subtitle data', async () => {
      const request = {
        title: 'Empty Data Test',
        outputFormat: 'srt',
        subtitleData: []
      }

      await expect(
        E.runPromise(enhancedProcessSubtitlesHandler(request))
      ).rejects.toThrow()
    })

    it('should fail with SubtitleDataInvalid for invalid subtitle timing', async () => {
      const request = {
        title: 'Invalid Timing Test',
        outputFormat: 'srt',
        subtitleData: [
          {
            start: 2000, // start > end
            end: 1000,
            text: 'Invalid timing'
          }
        ]
      }

      await expect(
        E.runPromise(enhancedProcessSubtitlesHandler(request))
      ).rejects.toThrow()
    })

    it('should fail with SubtitleDataInvalid for negative timing', async () => {
      const request = {
        title: 'Negative Timing Test',
        outputFormat: 'srt',
        subtitleData: [
          {
            start: -1000,
            end: 1000,
            text: 'Negative start time'
          }
        ]
      }

      await expect(
        E.runPromise(enhancedProcessSubtitlesHandler(request))
      ).rejects.toThrow()
    })

    it('should fail with SubtitleDataInvalid for empty text', async () => {
      const request = {
        title: 'Empty Text Test',
        outputFormat: 'srt',
        subtitleData: [
          {
            start: 0,
            end: 1000,
            text: '   ' // whitespace only
          }
        ]
      }

      await expect(
        E.runPromise(enhancedProcessSubtitlesHandler(request))
      ).rejects.toThrow()
    })

    it('should fail with SubtitleDataInvalid for invalid speaker ID', async () => {
      const request = {
        title: 'Invalid Speaker Test',
        outputFormat: 'srt',
        subtitleData: [
          {
            start: 0,
            end: 1000,
            text: 'Test subtitle',
            speaker: -1 // negative speaker ID
          }
        ]
      }

      await expect(
        E.runPromise(enhancedProcessSubtitlesHandler(request))
      ).rejects.toThrow()
    })

    it('should handle conversion errors properly', async () => {
      const request = {
        title: 'Conversion Error Test',
        outputFormat: 'srt',
        subtitleData: [
          {
            start: 0,
            end: 1000,
            text: 'Test subtitle'
          }
        ]
      }

      // Mock conversion failure
      mockConvert.mockReturnValue(E.fail(
        new Error('Conversion failed')
      ))

      await expect(
        E.runPromise(enhancedProcessSubtitlesHandler(request))
      ).rejects.toThrow()
    })

    it('should process request with options correctly', async () => {
      const request = {
        title: 'With Options Test',
        outputFormat: 'vtt',
        subtitleData: [
          {
            start: 0,
            end: 1000,
            text: 'Test subtitle'
          }
        ],
        options: {
          timingOffset: 500,
          includeSpeaker: true,
          cleanText: true
        }
      }

      mockConvert.mockReturnValue(E.succeed('WEBVTT\n\n00:00:00.500 --> 00:00:01.500\nTest subtitle'))

      const result = await E.runPromise(enhancedProcessSubtitlesHandler(request))

      expect(result.results[0].format).toBe('vtt')
      expect(mockConvert).toHaveBeenCalledWith(
        request.subtitleData,
        'vtt',
        request.options
      )
    })
  })

  describe('processSubtitlesHandler (Legacy)', () => {
    it('should process valid subtitle request successfully', async () => {
      const request: ProcessSubtitlesRequest = {
        title: 'Legacy Test',
        outputFormat: 'srt',
        subtitleData: [
          {
            start: 0,
            end: 1000,
            text: 'Legacy test'
          }
        ]
      }

      mockConvert.mockReturnValue(E.succeed('1\n00:00:00,000 --> 00:00:01,000\nLegacy test'))

      const result = await E.runPromise(processSubtitlesHandler(request))

      expect(result.title).toBe('Legacy Test')
      expect(result.format).toBe('srt')
      expect(result.content).toContain('Legacy test')
      expect(result.itemCount).toBe(1)
    })
  })

  describe('getSupportedFormatsHandler', () => {
    it('should return all supported subtitle formats', async () => {
      const result = await E.runPromise(getSupportedFormatsHandler())

      expect(result).toEqual(['json', 'srt', 'vtt', 'plain-text'])
    })
  })

  describe('healthCheckHandler', () => {
    it('should return healthy status', async () => {
      const result = await E.runPromise(healthCheckHandler())

      expect(result.status).toBe('healthy')
      expect(result.service).toBe('subtitle-processor')
      expect(result.timestamp).toBeDefined()
      expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0)
    })
  })

  describe('Type Safety', () => {
    it('should enforce type safety for subtitle data', () => {
      // This test ensures TypeScript compilation works correctly
      const validSubtitleItem: SubtitleItem = {
        start: 0,
        end: 1000,
        text: 'Valid subtitle',
        speaker: 1
      }

      expect(validSubtitleItem.start).toBe(0)
      expect(validSubtitleItem.end).toBe(1000)
      expect(validSubtitleItem.text).toBe('Valid subtitle')
      expect(validSubtitleItem.speaker).toBe(1)
    })

    it('should enforce type safety for format enum', () => {
      const validFormats: SubtitleFormat[] = ['json', 'srt', 'vtt', 'plain-text']
      
      validFormats.forEach(format => {
        expect(['json', 'srt', 'vtt', 'plain-text']).toContain(format)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle all error types properly', () => {
      // Test that all error classes can be instantiated
      expect(() => new SubtitleDataInvalid()).not.toThrow()
      expect(() => new SubtitleFormatUnsupported({ format: 'test', supportedFormats: ['srt'] })).not.toThrow()
      expect(() => new SubtitleConversionFailed({ format: 'test' })).not.toThrow()
      expect(() => new SubtitleProcessingFailed({ step: 'test' })).not.toThrow()
    })
  })
})
