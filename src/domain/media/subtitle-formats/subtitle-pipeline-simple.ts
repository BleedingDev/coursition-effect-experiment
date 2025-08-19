import { Effect as E, Option } from 'effect'
import type { SubtitleItem } from './subtitle-formats.schema'

// ============================================================================
// Pipeline Types and Interfaces
// ============================================================================

/**
 * Represents a single filter function that processes one SubtitleItem
 */
export type SubtitleFilter = (
  item: SubtitleItem,
) => SubtitleItem | Option.Option<SubtitleItem>

/**
 * Represents a filter that can process items in parallel
 */
export type ParallelSubtitleFilter = (items: SubtitleItem[]) => SubtitleItem[]

/**
 * Represents a collector function that gathers items into a buffer
 */
export type SubtitleCollector = (items: SubtitleItem[]) => SubtitleItem[]

/**
 * Represents a formatter function that converts subtitle array to output format
 */
export type SubtitleFormatter = (items: SubtitleItem[]) => string[]

/**
 * Pipeline stage types
 */
export type PipelineStage =
  | { type: 'stream'; generator: () => Generator<SubtitleItem, void, unknown> }
  | { type: 'filter'; filter: SubtitleFilter }
  | { type: 'parallel-filter'; filter: ParallelSubtitleFilter }
  | { type: 'collector'; collector: SubtitleCollector }
  | { type: 'formatter'; formatter: SubtitleFormatter }

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  readonly parallelProcessing: boolean
  readonly batchSize: number
  readonly bufferSize: number
}

// ============================================================================
// Core Pipeline Implementation
// ============================================================================

/**
 * Creates a streaming generator from an array of subtitle items
 */
export const createStreamGenerator = (items: SubtitleItem[]) =>
  function* (): Generator<SubtitleItem, void, unknown> {
    for (const item of items) {
      yield item
    }
  }

/**
 * Applies a single filter to a subtitle item
 */
export const applySingleFilter =
  (filter: SubtitleFilter) =>
  (item: SubtitleItem): Option.Option<SubtitleItem> => {
    const result = filter(item)
    if (Option.isOption(result)) {
      return result
    }
    return Option.some(result)
  }

/**
 * Applies multiple filters in sequence to a subtitle item
 */
export const applyFilters =
  (...filters: SubtitleFilter[]) =>
  (item: SubtitleItem): Option.Option<SubtitleItem> => {
    let current = item

    for (const filter of filters) {
      const result = applySingleFilter(filter)(current)
      if (Option.isNone(result)) {
        return Option.none()
      }
      current = result.value
    }

    return Option.some(current)
  }

/**
 * Processes items in parallel using EffectTS
 */
export const processParallel =
  (filter: SubtitleFilter) =>
  (items: SubtitleItem[]): SubtitleItem[] => {
    const program = E.all(
      items.map((item) => {
        const result = applySingleFilter(filter)(item)
        if (Option.isSome(result)) {
          return E.succeed(result.value)
        }
        return E.succeed(null)
      }),
    ).pipe(
      E.map((results) =>
        results.filter((item): item is SubtitleItem => item !== null),
      ),
    )

    return E.runSync(program)
  }

/**
 * Collects items into a buffer
 */
export const createCollector = (): SubtitleCollector => {
  const buffer: SubtitleItem[] = []

  return (items: SubtitleItem[]) => {
    buffer.push(...items)
    return buffer
  }
}

/**
 * Reverses the order of subtitle items
 */
export const reverseItems = (items: SubtitleItem[]): SubtitleItem[] => {
  return [...items].reverse()
}

// ============================================================================
// Pipeline Builder
// ============================================================================

/**
 * Pipeline builder class for constructing subtitle processing pipelines
 */
export class SubtitlePipeline {
  private stages: PipelineStage[] = []
  private config: PipelineConfig

  constructor(
    config: PipelineConfig = {
      parallelProcessing: true,
      batchSize: 10,
      bufferSize: 100,
    },
  ) {
    this.config = config
  }

  /**
   * Adds a streaming stage to the pipeline
   */
  stream(generator: () => Generator<SubtitleItem, void, unknown>): this {
    this.stages.push({ type: 'stream', generator })
    return this
  }

  /**
   * Adds a filter stage to the pipeline
   */
  filter(filter: SubtitleFilter): this {
    this.stages.push({ type: 'filter', filter })
    return this
  }

  /**
   * Adds a parallel filter stage to the pipeline
   */
  parallelFilter(filter: ParallelSubtitleFilter): this {
    this.stages.push({ type: 'parallel-filter', filter })
    return this
  }

  /**
   * Adds a collector stage to the pipeline
   */
  collector(collector: SubtitleCollector): this {
    this.stages.push({ type: 'collector', collector })
    return this
  }

  /**
   * Adds a formatter stage to the pipeline
   */
  formatter(formatter: SubtitleFormatter): this {
    this.stages.push({ type: 'formatter', formatter })
    return this
  }

  /**
   * Executes the pipeline and returns the result
   */
  execute(): SubtitleItem[] | string[] {
    let currentItems: SubtitleItem[] = []
    let currentStrings: string[] = []

    type StreamStage = {
      type: 'stream'
      generator: () => Generator<SubtitleItem, void, unknown>
    }
    type FilterStage = { type: 'filter'; filter: SubtitleFilter }
    type ParallelFilterStage = {
      type: 'parallel-filter'
      filter: ParallelSubtitleFilter
    }
    type CollectorStage = { type: 'collector'; collector: SubtitleCollector }
    type FormatterStage = { type: 'formatter'; formatter: SubtitleFormatter }
    type Stage =
      | StreamStage
      | FilterStage
      | ParallelFilterStage
      | CollectorStage
      | FormatterStage

    const handleStream = (stage: StreamStage): SubtitleItem[] => {
      const generator = stage.generator()
      const items: SubtitleItem[] = []
      for (const item of generator) {
        items.push(item)
      }
      return items
    }

    const handleFilter = (
      stage: FilterStage,
      items: SubtitleItem[],
    ): SubtitleItem[] => {
      if (this.config.parallelProcessing) {
        return processParallel(stage.filter)(items)
      }
      const filtered: SubtitleItem[] = []
      for (const item of items) {
        const result = applySingleFilter(stage.filter)(item)
        if (Option.isSome(result)) {
          filtered.push(result.value)
        }
      }
      return filtered
    }

    const handleParallelFilter = (
      stage: ParallelFilterStage,
      items: SubtitleItem[],
    ): SubtitleItem[] => {
      return stage.filter(items)
    }

    const handleCollector = (
      stage: CollectorStage,
      items: SubtitleItem[],
    ): SubtitleItem[] => {
      return stage.collector(items)
    }

    const handleFormatter = (
      stage: FormatterStage,
      items: SubtitleItem[],
    ): string[] => {
      return stage.formatter(items)
    }

    for (const stage of this.stages as Stage[]) {
      switch (stage.type) {
        case 'stream':
          currentItems = handleStream(stage)
          break
        case 'filter':
          currentItems = handleFilter(stage, currentItems)
          break
        case 'parallel-filter':
          currentItems = handleParallelFilter(stage, currentItems)
          break
        case 'collector':
          currentItems = handleCollector(stage, currentItems)
          break
        case 'formatter':
          currentStrings = handleFormatter(stage, currentItems)
          break
        default: {
          // This should never happen due to TypeScript's exhaustive checking
          break
        }
      }
    }

    return currentStrings.length > 0 ? currentStrings : currentItems
  }
}

// ============================================================================
// Pre-built Pipeline Components
// ============================================================================

/**
 * Creates a pipeline for processing subtitle items
 */
export const createPipeline = (config?: PipelineConfig): SubtitlePipeline => {
  return new SubtitlePipeline(config)
}

/**
 * Creates a pipeline that processes an array of subtitle items
 */
export const createArrayPipeline = (
  items: SubtitleItem[],
  config?: PipelineConfig,
): SubtitlePipeline => {
  const pipeline = createPipeline(config)
  return pipeline.stream(createStreamGenerator(items))
}

// ============================================================================
// Formatter Functions
// ============================================================================

/**
 * Formats subtitles to SRT format
 */
export const formatToSrt = (items: SubtitleItem[]): string[] => {
  const lines: string[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) {
      continue
    }
    const startTime = formatTimeSrt(item.start)
    const endTime = formatTimeSrt(item.end)

    lines.push(`${i + 1}`)
    lines.push(`${startTime} --> ${endTime}`)
    lines.push(item.text)
    lines.push('')
  }

  return lines
}

/**
 * Formats subtitles to VTT format
 */
export const formatToVtt = (items: SubtitleItem[]): string[] => {
  const lines: string[] = ['WEBVTT', '']

  for (const item of items) {
    const startTime = formatTimeVtt(item.start)
    const endTime = formatTimeVtt(item.end)

    lines.push(`${startTime} --> ${endTime}`)
    lines.push(item.text)
    lines.push('')
  }

  return lines
}

/**
 * Formats subtitles to plain text format
 */
export const formatToPlainText = (items: SubtitleItem[]): string[] => {
  return items.map((item) => item.text)
}

/**
 * Formats subtitles to JSON format
 */
export const formatToJson = (items: SubtitleItem[]): string[] => {
  return [JSON.stringify(items, null, 2)]
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Formats time in milliseconds to SRT format (HH:MM:SS,mmm)
 */
const formatTimeSrt = (ms: number): string => {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = ms % 1000
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
}

/**
 * Formats time in milliseconds to VTT format (HH:MM:SS.mmm)
 */
const formatTimeVtt = (ms: number): string => {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = ms % 1000
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

// ============================================================================
// Example Usage Functions
// ============================================================================

/**
 * Example: Process subtitles with filters and convert to SRT
 */
export const processToSrt = (
  items: SubtitleItem[],
  filters: SubtitleFilter[] = [],
): string[] => {
  return createArrayPipeline(items)
    .filter(applyFilters(...filters))
    .collector(createCollector())
    .formatter(formatToSrt)
    .execute() as string[]
}

/**
 * Example: Process subtitles with parallel filters and convert to VTT
 */
export const processToVtt = (
  items: SubtitleItem[],
  filters: SubtitleFilter[] = [],
): string[] => {
  return createArrayPipeline(items)
    .filter(applyFilters(...filters))
    .collector(createCollector())
    .formatter(formatToVtt)
    .execute() as string[]
}

/**
 * Example: Process subtitles with custom pipeline configuration
 */
export const processWithConfig = (
  items: SubtitleItem[],
  filters: SubtitleFilter[] = [],
  config: PipelineConfig = {
    parallelProcessing: true,
    batchSize: 10,
    bufferSize: 100,
  },
): string[] => {
  return createArrayPipeline(items, config)
    .filter(applyFilters(...filters))
    .collector(createCollector())
    .formatter(formatToSrt)
    .execute() as string[]
}
