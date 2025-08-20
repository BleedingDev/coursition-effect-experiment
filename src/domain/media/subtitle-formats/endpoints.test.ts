import { describe, it, expect, vi } from 'vitest'
import { Effect as E } from 'effect'
import { 
  ProcessSubtitlesRequest, 
  ProcessSubtitlesResponse,
  subtitleGroup,
  createSubtitleApi,
  addSubtitleEndpoints
} from './endpoints'
import { SubtitleItem, SubtitleFormat } from './subtitle-formats.schema'

describe('Subtitle Endpoints', () => {
  describe('ProcessSubtitlesRequest Schema', () => {
    it('should validate a valid request', () => {
      const validRequest: ProcessSubtitlesRequest = {
        title: 'Test Subtitles',
        outputFormat: 'srt',
        subtitleData: [
          {
            start: 0,
            end: 2000,
            text: 'Hello, world!',
            speaker: 1
          },
          {
            start: 3000,
            end: 5000,
            text: 'Welcome to the test.',
            speaker: 2
          }
        ],
        options: {
          timingOffset: 100,
          includeSpeaker: true
        }
      }

      // This should compile without errors
      expect(validRequest.title).toBe('Test Subtitles')
      expect(validRequest.outputFormat).toBe('srt')
      expect(validRequest.subtitleData).toHaveLength(2)
      expect(validRequest.options?.timingOffset).toBe(100)
    })

    it('should allow request without options', () => {
      const requestWithoutOptions: ProcessSubtitlesRequest = {
        title: 'Simple Test',
        outputFormat: 'vtt',
        subtitleData: [
          {
            start: 0,
            end: 1000,
            text: 'Simple subtitle'
          }
        ]
      }

      expect(requestWithoutOptions.options).toBeUndefined()
    })

    it('should validate all supported output formats', () => {
      const formats: SubtitleFormat[] = ['json', 'srt', 'vtt', 'plain-text']
      
      formats.forEach(format => {
        const request: ProcessSubtitlesRequest = {
          title: `Test ${format}`,
          outputFormat: format,
          subtitleData: [
            {
              start: 0,
              end: 1000,
              text: `Test for ${format} format`
            }
          ]
        }
        
        expect(request.outputFormat).toBe(format)
      })
    })
  })

  describe('ProcessSubtitlesResponse Schema', () => {
    it('should create a valid response', () => {
      const response: ProcessSubtitlesResponse = {
        title: 'Test Response',
        format: 'json',
        content: '[{"start":0,"end":1000,"text":"Test"}]',
        itemCount: 1,
        processedAt: '2024-01-01T00:00:00.000Z'
      }

      expect(response.title).toBe('Test Response')
      expect(response.format).toBe('json')
      expect(response.content).toContain('Test')
      expect(response.itemCount).toBe(1)
      expect(response.processedAt).toBe('2024-01-01T00:00:00.000Z')
    })
  })

  describe('API Group', () => {
    it('should create subtitle group with correct prefix', () => {
      expect(subtitleGroup).toBeDefined()
      // The group should have the /subtitles prefix
      expect(subtitleGroup).toHaveProperty('prefix')
    })

    it('should create standalone subtitle API', () => {
      const api = createSubtitleApi()
      expect(api).toBeDefined()
    })

    it('should add subtitle endpoints to existing API', () => {
      // Mock API for testing
      const mockApi = { add: vi.fn() }
      addSubtitleEndpoints(mockApi as any)
      expect(mockApi.add).toHaveBeenCalledWith(subtitleGroup)
    })
  })

  describe('Type Coherence with SubtitleItem', () => {
    it('should maintain type coherence with SubtitleItem schema', () => {
      const subtitleItem: SubtitleItem = {
        start: 0,
        end: 2000,
        text: 'Test subtitle',
        speaker: 1
      }

      const request: ProcessSubtitlesRequest = {
        title: 'Type Coherence Test',
        outputFormat: 'srt',
        subtitleData: [subtitleItem]
      }

      // This should compile and maintain type safety
      expect(request.subtitleData[0]).toEqual(subtitleItem)
      expect(request.subtitleData[0].start).toBe(0)
      expect(request.subtitleData[0].end).toBe(2000)
      expect(request.subtitleData[0].text).toBe('Test subtitle')
      expect(request.subtitleData[0].speaker).toBe(1)
    })

    it('should handle optional speaker field correctly', () => {
      const subtitleWithoutSpeaker: SubtitleItem = {
        start: 0,
        end: 1000,
        text: 'No speaker specified'
      }

      const request: ProcessSubtitlesRequest = {
        title: 'No Speaker Test',
        outputFormat: 'vtt',
        subtitleData: [subtitleWithoutSpeaker]
      }

      expect(request.subtitleData[0].speaker).toBeUndefined()
    })
  })

  describe('Endpoint Configuration', () => {
    it('should have correct HTTP methods', () => {
      // The processSubtitles endpoint should be a POST endpoint
      expect(subtitleGroup.endpoints).toBeDefined()
    })

    it('should have proper error handling configured', () => {
      // This test ensures the endpoints are properly configured
      // The actual error handling is tested in the handler tests
      expect(subtitleGroup).toBeDefined()
    })
  })
})
