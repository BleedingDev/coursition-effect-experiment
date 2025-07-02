import { FileSystem } from '@effect/platform'
import { describe, expect, it } from '@effect/vitest'
import { Effect as E, Layer } from 'effect'
import { MediaStore } from '../../stores/media/media.store'
import { makeTestLayer } from '../../test-utils'
import { parseMediaUsecase } from './parse-media.usecase'

const MediaStoreTestLayer = makeTestLayer(MediaStore)({
  parseMedia: () =>
    E.succeed({
      json: [
        { start: 0, end: 5000, text: 'Hello world' },
        { start: 5000, end: 10000, text: 'This is a test' },
        { start: 10000, end: 15000, text: 'Sub parsing complete' },
      ],
    }),
}).pipe(Layer.merge(FileSystem.layerNoop({})))

describe('parseMediaUsecase', () => {
  it.effect('should parse media from URL', () =>
    E.gen(function* () {
      const request = {
        url: new URL('https://example.com/video.mp4'),
        language: 'en',
      }
      const result = yield* parseMediaUsecase(request)

      expect(result.json).toHaveLength(3)
      expect(result.json[0]?.text).toBe('Hello world')
      expect(result.json[1]?.start).toBe(5000)
      expect(result.json[2]?.end).toBe(15000)
    }).pipe(E.provide(MediaStoreTestLayer)),
  )
})
