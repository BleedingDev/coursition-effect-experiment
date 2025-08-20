import { HttpApiEndpoint, HttpApiGroup, HttpApi } from '@effect/platform'
import { Schema } from 'effect'
import { SubtitleItem, SubtitleFormat, ConversionOptions } from './subtitle-formats.schema'
import { 
  SubtitleDataInvalid, 
  SubtitleFormatUnsupported, 
  SubtitleConversionFailed,
  SubtitleProcessingFailed 
} from './subtitle-formats.errors'
import { EnhancedProcessSubtitlesRequest, MultiFormatResponse } from './subtitle-formats.schema'

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Request schema for subtitle processing endpoint
 */
export const ProcessSubtitlesRequest = Schema.Struct({
  /** Title/name for the subtitle content */
  title: Schema.String,
  /** Desired output format */
  outputFormat: SubtitleFormat,
  /** Subtitle data to process */
  subtitleData: Schema.Array(SubtitleItem),
  /** Optional processing options */
  options: Schema.optional(ConversionOptions),
})

/**
 * Response schema for subtitle processing endpoint
 */
export const ProcessSubtitlesResponse = Schema.Struct({
  /** Title of the processed subtitles */
  title: Schema.String,
  /** Output format used */
  format: SubtitleFormat,
  /** Processed subtitle content */
  content: Schema.String,
  /** Number of subtitle items processed */
  itemCount: Schema.Number,
  /** Processing timestamp */
  processedAt: Schema.String,
})

// ============================================================================
// Endpoint Definitions
// ============================================================================

/**
 * POST endpoint for processing subtitles
 * Converts subtitle data to the specified output format
 */
export const processSubtitles = HttpApiEndpoint.post('processSubtitles', '/process')
  .setPayload(ProcessSubtitlesRequest)
  .addSuccess(ProcessSubtitlesResponse)
  .addError(SubtitleDataInvalid, { status: 400 })
  .addError(SubtitleFormatUnsupported, { status: 400 })
  .addError(SubtitleConversionFailed, { status: 422 })
  .addError(SubtitleProcessingFailed, { status: 500 })

/**
 * Enhanced POST endpoint for processing subtitles with multiple format support
 * Supports both single format (e.g., "srt") and multiple formats (e.g., "srt,vtt,json")
 */
export const enhancedProcessSubtitles = HttpApiEndpoint.post('enhancedProcessSubtitles', '/process-enhanced')
  .setPayload(EnhancedProcessSubtitlesRequest)
  .addSuccess(MultiFormatResponse)
  .addError(SubtitleDataInvalid, { status: 400 })
  .addError(SubtitleFormatUnsupported, { status: 400 })
  .addError(SubtitleConversionFailed, { status: 422 })
  .addError(SubtitleProcessingFailed, { status: 500 })

/**
 * GET endpoint for retrieving supported subtitle formats
 */
export const getSupportedFormats = HttpApiEndpoint.get('getSupportedFormats', '/formats')
  .addSuccess(Schema.Array(Schema.String))

/**
 * GET endpoint for health check of subtitle processing service
 */
export const healthCheck = HttpApiEndpoint.get('healthCheck', '/health')
  .addSuccess(Schema.Struct({
    status: Schema.Literal('healthy'),
    service: Schema.Literal('subtitle-processor'),
    timestamp: Schema.String,
  }))

// ============================================================================
// API Group
// ============================================================================

/**
 * Subtitle processing API group
 * Groups all subtitle-related endpoints under /subtitles prefix
 */
export const subtitleGroup = HttpApiGroup.make('subtitles')
  .add(processSubtitles)
  .add(enhancedProcessSubtitles)
  .add(getSupportedFormats)
  .add(healthCheck)
  .prefix('/subtitles')

// ============================================================================
// Type Exports
// ============================================================================

export type ProcessSubtitlesRequest = Schema.Schema.Type<typeof ProcessSubtitlesRequest>
export type ProcessSubtitlesResponse = Schema.Schema.Type<typeof ProcessSubtitlesResponse>

// ============================================================================
// API Integration
// ============================================================================

/**
 * Helper function to add subtitle endpoints to an existing API
 * Usage: api.add(subtitleGroup)
 */
export const addSubtitleEndpoints = (api: HttpApi.HttpApi) => 
  api.add(subtitleGroup)

/**
 * Create a standalone subtitle processing API
 * Usage: const subtitleApi = createSubtitleApi()
 */
export const createSubtitleApi = () => 
  HttpApi.make('subtitleApi').add(subtitleGroup)
