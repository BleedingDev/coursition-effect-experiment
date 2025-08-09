import { FileSystem, Path } from '@effect/platform'
import { BunContext } from '@effect/platform-bun'
import { spawn } from 'bun'
import { Effect as E } from 'effect'
import {
  YtDlpDownloadError,
  YtDlpValidationError,
} from 'src/domain/media/media.errors'
import type { RestateParsedMediaRequestType } from '../../domain/media/media.schema'

const downloadLinkEffect = (request: RestateParsedMediaRequestType) =>
  E.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    if ('url' in request) {
      const canDownload = yield* E.tryPromise({
        try: async () => {
          const proc = spawn(['yt-dlp', '--simulate', '--quiet', request.url])
          const exitCode = await proc.exited
          return exitCode === 0
        },
        catch: (error) => new YtDlpValidationError({ error }),
      })

      if (canDownload) {
        const timestamp = Date.now()
        const tmpDir = path.join(process.cwd(), 'tmp')
        const outputPath = path.join(tmpDir, `${timestamp}.mp3`)

        yield* fs.makeDirectory(tmpDir, { recursive: true })

        yield* E.tryPromise({
          try: async () => {
            const proc = spawn([
              'yt-dlp',
              '-x',
              '--audio-format',
              'mp3',
              '-o',
              outputPath,
              request.url,
            ])
            const exitCode = await proc.exited
            if (exitCode !== 0) {
              E.fail(new YtDlpDownloadError({ error: 'Download failed' }))
            }
          },
          catch: (error) => new YtDlpDownloadError({ error }),
        })

        return new URL('')
      }
      return new URL(request.url)
    }

    // const media = yield* fs.readFile(request.file.path)
    return new URL('')
  }).pipe(
    E.tapError(E.logError),
    E.orDie,
    E.withSpan('downloadLinkUsecase', {
      attributes: {
        language: request.language,
        source: 'url' in request ? 'url' : 'file',
      },
    }),
  )

export const downloadLinkStep = (request: RestateParsedMediaRequestType) =>
  downloadLinkEffect(request).pipe(E.provide(BunContext.layer))
