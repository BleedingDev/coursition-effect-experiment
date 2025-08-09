import { describe, expect, it } from '@effect/vitest'
import { Effect as E } from 'effect'
import { makeTestLayer } from '../../test-utils'
import { MediaStore } from './media.store'

const MediaStoreTestLayer = makeTestLayer(MediaStore)({
  parseMedia: () =>
    E.succeed({
      json: [
        { start: 0, end: 5000, text: 'Hello world' },
        { start: 5000, end: 10000, text: 'This is a test' },
        { start: 10000, end: 15000, text: 'Sub parsing complete' },
      ],
    }),
})

describe('MediaStore', () => {
  describe('parseMedia', () => {
    it.effect('should parse media successfully', () =>
      E.gen(function* () {
        const store = yield* MediaStore
        const result = yield* store.parseMedia(
          new URL('https://example.com/video.mp4'),
          'en-GB',
        )

        expect(result.json).toHaveLength(3)
        expect(result.json[0]?.text).toBe('Hello world')
        expect(result.json[1]?.text).toBe('This is a test')
        expect(result.json[2]?.text).toBe('Sub parsing complete')
      }).pipe(E.provide(MediaStoreTestLayer)),
    )

    it.effect('should handle file upload request', () =>
      E.gen(function* () {
        const store = yield* MediaStore
        const result = yield* store.parseMedia(
          new URL('https://example.com/uploaded-file.mp4'),
          'es-ES',
        )

        expect(result.json).toHaveLength(3)
        expect(result.json[0]?.start).toBe(0)
        expect(result.json[0]?.end).toBe(5000)
        expect(result.json[0]?.text).toBe('Hello world')
      }).pipe(E.provide(MediaStoreTestLayer)),
    )
  })
})
