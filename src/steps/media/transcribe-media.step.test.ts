import { FileSystem } from '@effect/platform'
import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { MediaStore } from '../../stores/media/media.store'
import { makeTestLayer } from '../../utils/test-utils'
import { transcribeMediaEffect } from './transcribe-media.step'

const MediaStoreTestLayer = makeTestLayer(MediaStore)({
  parseMedia: () =>
    Effect.succeed({
      json: [
        { start: 0, end: 5000, text: 'Hello world' },
        { start: 5000, end: 10_000, text: 'This is a test' },
        { start: 10_000, end: 15_000, text: 'Sub parsing complete' },
      ],
    }),
}).pipe(Layer.merge(FileSystem.layerNoop({})))

describe('parseMediaUsecase', () => {
  it.effect('should parse media from URL', () =>
    Effect.gen(function* () {
      const result = yield* transcribeMediaEffect(
        'https://example.com/video.mp4',
        'en-GB',
      )

      expect(result.json).toHaveLength(3)
      expect(result.json[0]?.text).toBe('Hello world')
      expect(result.json[1]?.start).toBe(5000)
      expect(result.json[2]?.end).toBe(15_000)
    }).pipe(Effect.provide(MediaStoreTestLayer)),
  )
})
