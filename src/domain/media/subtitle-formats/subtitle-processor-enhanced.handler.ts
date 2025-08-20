import { Effect as E, Option } from 'effect'
import { SubtitleConverterLive } from './subtitle-converter'
import { ProcessSubtitlesRequest, ProcessSubtitlesResponse } from './endpoints'
import { 
  SubtitleDataInvalid, 
  SubtitleFormatUnsupported, 
  SubtitleConversionFailed,
  SubtitleProcessingFailed 
} from './subtitle-formats.errors'
import { SubtitleItem, SubtitleFormat, ConversionOptions } from './subtitle-formats.schema'

export interface EnhancedProcessSubtitlesRequest {
  title: string
  outputFormat: string
  subtitleData: SubtitleItem[]
  options?: ConversionOptions
}

export interface MultiFormatResponse {
  title: string
  results: Array<{
    format: SubtitleFormat
    content: string
    itemCount: number
  }>
  totalItemCount: number
  processedAt: string
}

export const enhancedProcessSubtitlesHandler = (request: EnhancedProcessSubtitlesRequest) =>
  E.gen(function* () {
    const { title, outputFormat, subtitleData, options } = request

    yield* E.logInfo('Processing enhanced subtitle request', { 
      title, 
      outputFormat, 
      itemCount: subtitleData.length 
    })

    const formats = yield* parseAndValidateFormats(outputFormat)
    yield* validateSubtitleData(subtitleData)

    const results = yield* E.forEach(formats, (format) =>
      processSingleFormat(subtitleData, format, options)
    )

    const response: MultiFormatResponse = {
      title,
      results: results.map((result, index) => ({
        format: formats[index]!,
        content: result,
        itemCount: subtitleData.length
      })),
      totalItemCount: subtitleData.length,
      processedAt: new Date().toISOString(),
    }

    yield* E.logInfo('Enhanced subtitle processing completed successfully', {
      title,
      formats: formats.join(','),
      itemCount: subtitleData.length,
    })

    return response
  }).pipe(
    E.tapError(E.logError),
    E.catchTags({
      SubtitleDataInvalid: () => E.fail(new SubtitleDataInvalid()),
      SubtitleFormatUnsupported: (error) => E.fail(new SubtitleFormatUnsupported({
        format: error.format,
        supportedFormats: error.supportedFormats,
      })),
      ConversionError: (error) => E.fail(new SubtitleConversionFailed({
        format: error.format,
      })),
      ProcessingError: (error) => E.fail(new SubtitleProcessingFailed({
        step: error.step,
      })),
      InvalidSubtitleDataError: () => E.fail(new SubtitleDataInvalid()),
      UnsupportedFormatError: (error) => E.fail(new SubtitleFormatUnsupported({
        format: error.format,
        supportedFormats: error.supportedFormats,
      })),
      InvalidTimingError: () => E.fail(new SubtitleDataInvalid()),
    }),
    E.withSpan('enhancedProcessSubtitlesHandler', {
      attributes: {
        title: request.title,
        outputFormat: request.outputFormat,
        itemCount: request.subtitleData.length,
      },
    }),
  )

/**
 * Legacy handler for backward compatibility - processes single format
 */
export const processSubtitlesHandler = (request: ProcessSubtitlesRequest) =>
  E.gen(function* () {
    const { title, outputFormat, subtitleData, options } = request

    yield* E.logInfo('Processing subtitle request', { 
      title, 
      format: outputFormat, 
      itemCount: subtitleData.length 
    })

    yield* validateSubtitleData(subtitleData)

    yield* E.logInfo('Converting subtitles', { 
      format: outputFormat, 
      itemCount: subtitleData.length,
      options 
    })
    
    const content = yield* SubtitleConverterLive.convert(
      subtitleData, 
      outputFormat, 
      options
    )

    const response: ProcessSubtitlesResponse = {
      title,
      format: outputFormat,
      content,
      itemCount: subtitleData.length,
      processedAt: new Date().toISOString(),
    }

    yield* E.logInfo('Subtitle processing completed successfully', {
      title,
      format: outputFormat,
      itemCount: subtitleData.length,
    })

    return response
  }).pipe(
    E.tapError(E.logError),
    E.catchTags({
      SubtitleDataInvalid: (error) => {
        console.log('🔍 Caught SubtitleDataInvalid error:', error)
        return E.fail(new SubtitleDataInvalid())
      },
      SubtitleFormatUnsupported: (error) => {
        console.log('🔍 Caught SubtitleFormatUnsupported error:', error)
        return E.fail(new SubtitleFormatUnsupported({
          format: error.format,
          supportedFormats: error.supportedFormats,
        }))
      },
      ConversionError: (error) => {
        console.log('🔍 Caught ConversionError:', error)
        return E.fail(new SubtitleConversionFailed({
          format: error.format,
        }))
      },
      ProcessingError: (error) => E.fail(new SubtitleProcessingFailed({
        step: error.step,
      })),
      InvalidSubtitleDataError: () => E.fail(new SubtitleDataInvalid()),
      UnsupportedFormatError: (error) => E.fail(new SubtitleFormatUnsupported({
        format: error.format,
        supportedFormats: error.supportedFormats,
      })),
      InvalidTimingError: () => E.fail(new SubtitleDataInvalid()),
    }),
    E.withSpan('processSubtitlesHandler', {
      attributes: {
        title: request.title,
        format: request.outputFormat,
        itemCount: request.subtitleData.length,
      },
    }),
  )


const parseAndValidateFormats = (outputFormat: string) =>
  E.gen(function* () {
    const formats = outputFormat.split(',').map(f => f.trim().toLowerCase())
    
    yield* E.logInfo('Parsing output formats', { formats })
    
    const validFormats: SubtitleFormat[] = []
    const supportedFormats: SubtitleFormat[] = ['json', 'srt', 'vtt', 'plain-text']
    
    for (const format of formats) {
      if (supportedFormats.includes(format as SubtitleFormat)) {
        validFormats.push(format as SubtitleFormat)
      } else {
        yield* E.fail(new SubtitleFormatUnsupported({
          format,
          supportedFormats,
        }))
      }
    }
    
    if (validFormats.length === 0) {
      yield* E.fail(new SubtitleFormatUnsupported({
        format: outputFormat,
        supportedFormats,
      }))
    }
    
    yield* E.logInfo('Validated output formats', { validFormats })
    return validFormats
  })


const validateSubtitleData = (subtitleData: SubtitleItem[]) =>
  E.gen(function* () {
    if (subtitleData.length === 0) {
      yield* E.fail(new SubtitleDataInvalid())
    }

    yield* E.logInfo('Starting subtitle validation', { itemCount: subtitleData.length })
    for (let i = 0; i < subtitleData.length; i++) {
      yield* E.logInfo('Validating subtitle item', { index: i, item: subtitleData[i] })
      yield* validateSubtitleItem(subtitleData[i], i)
    }
    yield* E.logInfo('Subtitle validation completed successfully')
  })


const processSingleFormat = (
  subtitleData: SubtitleItem[], 
  format: SubtitleFormat, 
  options?: ConversionOptions
) =>
  E.gen(function* () {
    yield* E.logInfo('Processing single format', { format, itemCount: subtitleData.length })
    
    const content = yield* SubtitleConverterLive.convert(
      subtitleData, 
      format, 
      options
    )
    
    yield* E.logInfo('Single format processing completed', { format })
    return content
  })

const validateSubtitleItem = (item: SubtitleItem, index: number) =>
  E.gen(function* () {
    if (typeof item.start !== 'number' || typeof item.end !== 'number' || typeof item.text !== 'string') {
      yield* E.fail(new SubtitleDataInvalid())
    }

    if (item.start < 0 || item.end < 0) {
      yield* E.fail(new SubtitleDataInvalid())
    }

    if (item.start >= item.end) {
      yield* E.fail(new SubtitleDataInvalid())
    }

    if (item.text.trim().length === 0) {
      yield* E.fail(new SubtitleDataInvalid())
    }

    if (item.speaker !== undefined && (item.speaker < 0 || !Number.isInteger(item.speaker))) {
      yield* E.fail(new SubtitleDataInvalid())
    }

    yield* E.logInfo('Subtitle item validation passed', { index, item })
  })


export const getSupportedFormatsHandler = () =>
  E.gen(function* () {
    const formats: SubtitleFormat[] = ['json', 'srt', 'vtt', 'plain-text']
    
    yield* E.logInfo('Retrieved supported subtitle formats', { formats })
    
    return formats
  }).pipe(
    E.tapError(E.logError),
    E.withSpan('getSupportedFormatsHandler'),
  )


export const healthCheckHandler = () =>
  E.gen(function* () {
    yield* E.logInfo('Health check requested')
    
    return {
      status: 'healthy' as const,
      service: 'subtitle-processor',
      timestamp: new Date().toISOString(),
    }
  }).pipe(
    E.tapError(E.logError),
    E.withSpan('healthCheckHandler'),
  )
