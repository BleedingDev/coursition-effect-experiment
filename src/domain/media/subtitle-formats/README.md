# Subtitle Pipeline System

EffectTS-based streaming processor for subtitle data with support for parallel processing, filtering, and multiple output formats.

## Overview

The subtitle pipeline system provides a flexible, type-safe way to process subtitle data through a series of filters and transformations. It supports both sequential and parallel processing, with generators for streaming data and collectors for gathering results.

## Architecture

### Core Components

1. **Streaming Generator**: Creates a stream of subtitle items from arrays or other sources
2. **Filters**: Process individual subtitle items (can be chained)
3. **Parallel Filters**: Process multiple items simultaneously
4. **Collectors**: Gather processed items into buffers
5. **Formatters**: Convert subtitle arrays to output formats (SRT, VTT, JSON, etc.)

### Pipeline Stages

```typescript
type PipelineStage = 
  | { type: 'stream'; generator: () => Generator<SubtitleItem, void, unknown> }
  | { type: 'filter'; filter: SubtitleFilter }
  | { type: 'parallel-filter'; filter: ParallelSubtitleFilter }
  | { type: 'collector'; collector: SubtitleCollector }
  | { type: 'formatter'; formatter: SubtitleFormatter }
```

## Quick Start

### Basic Usage

```typescript
import { createArrayPipeline, processToSrt } from './subtitle-pipeline-simple'
import { toUpperCase, removeEmptySubtitles } from './subtitle-filters'

// Simple pipeline
const result = processToSrt(subtitles, [removeEmptySubtitles, toUpperCase])
console.log(result.join('\n'))
```

### Advanced Pipeline

```typescript
import { createArrayPipeline, applyFilters, createCollector, formatToSrt } from './subtitle-pipeline-simple'
import { filterBySpeakers, addPrefix, capitalize } from './subtitle-filters'

const pipeline = createArrayPipeline(subtitles)
  .filter(applyFilters(
    filterBySpeakers([1, 2]), // Only speakers 1 and 2
    addPrefix("[Speaker]"),
    capitalize
  ))
  .collector(createCollector())
  .formatter(formatToSrt)
  .execute()

console.log(pipeline.join('\n'))
```

## API Reference

### Pipeline Creation

#### `createPipeline(config?)`
Creates a new pipeline with optional configuration.

#### `createArrayPipeline(items, config?)`
Creates a pipeline that processes an array of subtitle items.

### Pipeline Methods

#### `.stream(generator)`
Adds a streaming stage to the pipeline.

#### `.filter(filter)`
Adds a filter stage to the pipeline.

#### `.parallelFilter(filter)`
Adds a parallel filter stage to the pipeline.

#### `.collector(collector)`
Adds a collector stage to the pipeline.

#### `.formatter(formatter)`
Adds a formatter stage to the pipeline.

#### `.execute()`
Executes the pipeline and returns the result.

### Pre-built Functions

#### `processToSrt(items, filters?)`
Processes subtitles and converts to SRT format.

#### `processToVtt(items, filters?)`
Processes subtitles and converts to VTT format.

#### `processWithConfig(items, filters?, config?)`
Processes subtitles with custom configuration.

## Example Filters

### Text Filters
- `toUpperCase()` - Converts text to uppercase
- `toLowerCase()` - Converts text to lowercase
- `capitalize()` - Capitalizes first letter
- `addPrefix(prefix)` - Adds prefix to text
- `addSuffix(suffix)` - Adds suffix to text
- `replaceText(replacement)` - Replaces text content
- `transformText(transformer)` - Applies custom text transformation

### Timing Filters
- `addTimingOffset(offset)` - Adds timing offset in milliseconds
- `filterByDuration(min, max)` - Filters by subtitle duration
- `filterByTimeRange(start, end)` - Filters by time range

### Speaker Filters
- `filterBySpeaker(speakerId)` - Filters by specific speaker
- `filterBySpeakers(speakerIds)` - Filters by multiple speakers

### Validation Filters
- `validateSubtitle()` - Validates subtitle data
- `removeEmptySubtitles()` - Removes empty or whitespace-only subtitles

### Debug Filters
- `debugSubtitle(label?)` - Logs subtitle information for debugging

## Output Formats

### SRT Format
```
1
00:00:00,000 --> 00:00:02,000
Hello, world.

2
00:00:02,000 --> 00:00:04,000
This is a test.
```

### VTT Format
```
WEBVTT

00:00:00.000 --> 00:00:02.000
Hello, world.

00:00:02.000 --> 00:00:04.000
This is a test.
```

### JSON Format
```json
[
  {
    "start": 0,
    "end": 2000,
    "text": "Hello, world.",
    "speaker": 1
  }
]
```

### Plain Text Format
```
Hello, world.
This is a test.
```

## Examples

### Example 1: Basic Processing
```typescript
import { processToSrt } from './subtitle-pipeline-simple'
import { toUpperCase, removeEmptySubtitles } from './subtitle-filters'

const result = processToSrt(subtitles, [removeEmptySubtitles, toUpperCase])
console.log(result.join('\n'))
```

### Example 2: Speaker-Specific Processing
```typescript
import { createArrayPipeline, applyFilters, createCollector, formatToVtt } from './subtitle-pipeline-simple'
import { filterBySpeakers, addPrefix, capitalize } from './subtitle-filters'

const pipeline = createArrayPipeline(subtitles)
  .filter(applyFilters(
    filterBySpeakers([1, 2]), // Only speakers 1 and 2
    addPrefix("[Speaker]"),
    capitalize
  ))
  .collector(createCollector())
  .formatter(formatToVtt)
  .execute()
```

### Example 3: Custom Text Transformation
```typescript
import { transformText } from './subtitle-filters'

const customTransform = transformText((text) => 
  text.replace(/EffectTS/g, "Effect TypeScript")
)

const result = createArrayPipeline(subtitles)
  .filter(applyFilters(
    customTransform,
    toLowerCase,
    addPrefix("> ")
  ))
  .collector(createCollector())
  .formatter(formatToJson)
  .execute()
```

### Example 4: Parallel Processing
```typescript
const config = {
  parallelProcessing: true,
  batchSize: 5,
  bufferSize: 50
}

const result = createArrayPipeline(subtitles, config)
  .filter(applyFilters(
    validateSubtitle,
    toUpperCase,
    addPrefix("[PROCESSED]")
  ))
  .collector(createCollector())
  .formatter(formatToSrt)
  .execute()
```

## Performance Considerations

### Parallel Processing
- Enable parallel processing for large datasets
- Adjust batch size based on available CPU cores
- Monitor memory usage with large buffers

### Memory Management
- Use appropriate buffer sizes
- Consider streaming for very large datasets
- Clean up references after processing

### Error Handling
- Always validate input data
- Handle empty or invalid subtitles gracefully
- Use try-catch blocks for custom transformations

## Best Practices

1. **Type Safety**: Always use TypeScript for better type safety
2. **Validation**: Validate input data before processing
3. **Composition**: Compose filters using `applyFilters()` for better readability
4. **Performance**: Use parallel processing for large datasets
5. **Testing**: Write tests for custom filters and transformations
6. **Documentation**: Document custom filters and their behavior

## Testing

Run the test suite to ensure everything works correctly:

```bash
npm test -- src/domain/media/subtitle-formats/subtitle-pipeline-simple.test.ts
```

## Contributing

When adding new filters or formatters:

1. Follow the existing naming conventions
2. Add comprehensive tests
3. Update this documentation
4. Ensure type safety
5. Consider performance implications 