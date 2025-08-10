import { FileSystem, Path } from '@effect/platform'
import { BunContext } from '@effect/platform-bun'
import { spawn } from 'bun'
import { Console, Effect as E } from 'effect'
import { YtDlpDownloadError } from 'src/domain/media/media.errors'
import { S3Config, S3FileSystem, S3FileSystemLive } from 'src/platform/s3-fs'
import { slugify } from 'src/utils/string'
import type { RestateParsedMediaRequestType } from '../../domain/media/media.schema'

const downloadLinkEffect = (request: RestateParsedMediaRequestType) =>
  E.gen(function* () {
    const localFs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const config = yield* S3Config
    const s3Fs = yield* S3FileSystem

    if ('url' in request) {
      yield* Console.log('Starting download for URL:', request.url)

      const metadata = yield* E.tryPromise({
        try: async () => {
          const proc = spawn(
            ['yt-dlp', '--dump-json', '--simulate', '--', request.url],
            { stdout: 'pipe', stderr: 'pipe' },
          )
          const exitCode = await proc.exited
          if (exitCode !== 0) {
            return null
          }
          const stdoutStream = proc.stdout
          if (!stdoutStream) {
            return null
          }
          const stdout = await new Response(stdoutStream).text()
          try {
            return JSON.parse(stdout) as { title?: string; fulltitle?: string }
          } catch {
            return null
          }
        },
        catch: () => null,
      })

      if (metadata) {
        const baseTitle = metadata.fulltitle || metadata.title || 'audio'
        const slug = slugify(baseTitle) || 'audio'

        const tmpDir = path.join(process.cwd(), 'tmp')
        const filename = `${slug}.mp3`
        const localPath = path.join(tmpDir, filename)

        yield* localFs.makeDirectory(tmpDir, { recursive: true })

        yield* E.tryPromise({
          try: async () => {
            const proc = spawn(
              [
                'yt-dlp',
                '-x',
                '--audio-format',
                'mp3',
                '-o',
                localPath,
                '--',
                request.url,
              ],
              { stdout: 'inherit', stderr: 'inherit' },
            )
            const exitCode = await proc.exited
            if (exitCode !== 0) {
              throw new Error('Download failed')
            }
          },
          catch: (error) => new YtDlpDownloadError({ error }),
        })

        const audioData = yield* localFs.readFile(localPath)
        const s3Path = `downloads/${request.language}/${filename}`
        yield* s3Fs.writeFile(s3Path, audioData)
        yield* localFs.remove(localPath)

        return new URL(`${config.publicBaseUrl}/${s3Path}`)
      }

      return new URL(request.url)
    }

    if ('file' in request) {
      const fileData = yield* localFs.readFile(request.file.path)
      const timestamp = Date.now()
      const extension = path.extname(request.file.name)
      const s3Path = `uploads/${request.language}/${timestamp}${extension}`

      yield* s3Fs.writeFile(s3Path, fileData)
      yield* localFs.remove(request.file.path).pipe(E.catchAll(() => E.void))

      return new URL(`${config.publicBaseUrl}/${s3Path}`)
    }

    return yield* E.fail(new Error('No valid input provided'))
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
  downloadLinkEffect(request).pipe(
    E.provide(BunContext.layer),
    E.provide(S3FileSystemLive),
  )
