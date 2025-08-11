import type { FileSystem } from '@effect/platform'
import { SystemError } from '@effect/platform/Error'
import { Size } from '@effect/platform/FileSystem'
import { file, S3Client, write } from 'bun'
import { Config, Context, Effect, Layer, Option, Stream } from 'effect'

const LEADING_SLASH = /^\//

export class S3FileSystem extends Context.Tag('S3FileSystem')<
  S3FileSystem,
  FileSystem.FileSystem
>() {}

export const S3Config = Config.all({
  bucket: Config.string('S3_BUCKET'),
  accessKeyId: Config.string('S3_ACCESS_KEY_ID'),
  secretAccessKey: Config.string('S3_SECRET_ACCESS_KEY'),
  endpoint: Config.string('S3_ENDPOINT'),
  publicBaseUrl: Config.string('S3_PUBLIC_BASE_URL'),
})

export const makeS3FileSystem = (
  bucket: string,
  client?: S3Client,
): FileSystem.FileSystem => {
  const toS3Url = (path: string) =>
    `s3://${bucket}/${path.replace(LEADING_SLASH, '')}`

  return {
    access: (path: string) => {
      return Effect.tryPromise({
        try: async () => {
          const exists = await file(toS3Url(path)).exists()
          if (!exists) {
            throw new Error('File not found')
          }
        },
        catch: (error) =>
          new SystemError({
            reason: 'NotFound',
            module: 'FileSystem',
            method: 'access',
            pathOrDescriptor: path,
            cause: error,
          }),
      })
    },

    exists: (path: string) => {
      return Effect.tryPromise({
        try: () => file(toS3Url(path)).exists(),
        catch: (error) =>
          new SystemError({
            reason: 'Unknown',
            module: 'FileSystem',
            method: 'exists',
            pathOrDescriptor: path,
            cause: error,
          }),
      }).pipe(Effect.catchAll(() => Effect.succeed(false)))
    },

    readFile: (path: string) => {
      return Effect.tryPromise({
        try: () => file(toS3Url(path)).bytes(),
        catch: (error) =>
          new SystemError({
            reason: 'Unknown',
            module: 'FileSystem',
            method: 'readFile',
            pathOrDescriptor: path,
            cause: error,
          }),
      })
    },

    readFileString: (path: string, _encoding?: string) => {
      return Effect.tryPromise({
        try: () => file(toS3Url(path)).text(),
        catch: (error) =>
          new SystemError({
            reason: 'Unknown',
            module: 'FileSystem',
            method: 'readFileString',
            pathOrDescriptor: path,
            cause: error,
          }),
      })
    },

    writeFile: (
      path: string,
      data: Uint8Array,
      _options?: FileSystem.WriteFileOptions,
    ) => {
      return Effect.tryPromise({
        try: () => write(toS3Url(path), data),
        catch: (error) =>
          new SystemError({
            reason: 'Unknown',
            module: 'FileSystem',
            method: 'writeFile',
            pathOrDescriptor: path,
            cause: error,
          }),
      }).pipe(Effect.asVoid)
    },

    writeFileString: (
      path: string,
      data: string,
      _options?: FileSystem.WriteFileOptions,
    ) => {
      return Effect.tryPromise({
        try: () => write(toS3Url(path), data),
        catch: (error) =>
          new SystemError({
            reason: 'Unknown',
            module: 'FileSystem',
            method: 'writeFileString',
            pathOrDescriptor: path,
            cause: error,
          }),
      }).pipe(Effect.asVoid)
    },

    remove: (path: string, options?: { recursive?: boolean }) => {
      return Effect.tryPromise({
        try: async () => {
          if (options?.recursive && path.endsWith('/')) {
            if (!client) {
              throw new Error('S3Client required for recursive delete')
            }
            const objects = await client.list({ prefix: path })
            if (objects.contents) {
              await Promise.all(
                objects.contents.map((obj) => file(toS3Url(obj.key)).delete()),
              )
            }
          } else {
            await file(toS3Url(path)).delete()
          }
        },
        catch: (error) =>
          new SystemError({
            reason: 'Unknown',
            module: 'FileSystem',
            method: 'remove',
            pathOrDescriptor: path,
            cause: error,
          }),
      })
    },

    copyFile: (from: string, to: string) => {
      return Effect.tryPromise({
        try: () => write(toS3Url(to), file(toS3Url(from))),
        catch: (error) =>
          new SystemError({
            reason: 'Unknown',
            module: 'FileSystem',
            method: 'copyFile',
            pathOrDescriptor: from,
            cause: error,
          }),
      }).pipe(Effect.asVoid)
    },

    rename: (from: string, to: string) => {
      return Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: async () => {
            await write(toS3Url(to), file(toS3Url(from)))
            await file(toS3Url(from)).delete()
          },
          catch: (error) =>
            new SystemError({
              reason: 'Unknown',
              module: 'FileSystem',
              method: 'rename',
              pathOrDescriptor: from,
              cause: error,
            }),
        })
      })
    },

    stat: (path: string) => {
      return Effect.tryPromise({
        try: async () => {
          const f = file(toS3Url(path))
          const exists = await f.exists()
          if (!exists) {
            throw new Error('File not found')
          }

          return {
            type: 'File' as const,
            size: Size(f.size),
            mtime: Option.none(),
            atime: Option.none(),
            birthtime: Option.none(),
            dev: 0,
            ino: Option.some(0),
            mode: 0,
            nlink: Option.some(1),
            uid: Option.some(0),
            gid: Option.some(0),
            rdev: Option.some(0),
            blksize: Option.some(Size(0)),
            blocks: Option.some(0),
          }
        },
        catch: (error) =>
          new SystemError({
            reason: 'Unknown',
            module: 'FileSystem',
            method: 'stat',
            pathOrDescriptor: path,
            cause: error,
          }),
      })
    },

    readDirectory: (path: string, _options?: { recursive?: boolean }) => {
      return Effect.tryPromise({
        try: async () => {
          if (!client) {
            throw new Error('S3Client required for listing')
          }
          const prefix = path.endsWith('/') ? path : `${path}/`
          const result = await client.list({ prefix })
          return (
            result.contents?.map((item) => item.key.slice(prefix.length)) ?? []
          )
        },
        catch: (error) =>
          new SystemError({
            reason: 'Unknown',
            module: 'FileSystem',
            method: 'readDirectory',
            pathOrDescriptor: path,
            cause: error,
          }),
      })
    },

    makeDirectory: (
      _path: string,
      _options?: { recursive?: boolean; mode?: number },
    ) => {
      return Effect.void
    },

    stream: (path: string, _options?: FileSystem.StreamOptions) => {
      const s = file(toS3Url(path)).stream()
      const reader = s.getReader()

      return Stream.fromAsyncIterable(
        {
          async *[Symbol.asyncIterator]() {
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) {
                  break
                }
                yield value
              }
            } finally {
              reader.releaseLock()
            }
          },
        },
        (error) =>
          new SystemError({
            reason: 'Unknown',
            module: 'FileSystem',
            method: 'stream',
            pathOrDescriptor: path,
            cause: error,
          }),
      )
    },

    copy: (_from: string, _to: string) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'copy',
          pathOrDescriptor: '',
        }),
      )
    },
    chmod: (_path: string, _mode: number) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'chmod',
          pathOrDescriptor: '',
        }),
      )
    },
    chown: (_path: string, _uid: number, _gid: number) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'chown',
          pathOrDescriptor: '',
        }),
      )
    },
    link: (_from: string, _to: string) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'link',
          pathOrDescriptor: '',
        }),
      )
    },
    symlink: (_from: string, _to: string) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'symlink',
          pathOrDescriptor: '',
        }),
      )
    },
    readLink: (_path: string) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'readLink',
          pathOrDescriptor: '',
        }),
      )
    },
    realPath: (path: string) => {
      return Effect.succeed(path)
    },
    truncate: (_path: string, _length?: FileSystem.SizeInput) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'truncate',
          pathOrDescriptor: '',
        }),
      )
    },
    utimes: (_path: string, _atime: Date | number, _mtime: Date | number) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'utimes',
          pathOrDescriptor: '',
        }),
      )
    },
    watch: (_path: string) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'watch',
          pathOrDescriptor: '',
        }),
      )
    },
    makeTempDirectory: (_options?: FileSystem.MakeTempDirectoryOptions) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'makeTempDirectory',
          pathOrDescriptor: '',
        }),
      )
    },
    makeTempDirectoryScoped: (
      _options?: FileSystem.MakeTempDirectoryOptions,
    ) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'makeTempDirectoryScoped',
          pathOrDescriptor: '',
        }),
      )
    },
    makeTempFile: (_options?: FileSystem.MakeTempFileOptions) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'makeTempFile',
          pathOrDescriptor: '',
        }),
      )
    },
    makeTempFileScoped: (_options?: FileSystem.MakeTempFileOptions) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'makeTempFileScoped',
          pathOrDescriptor: '',
        }),
      )
    },
    open: (_path: string, _options?: FileSystem.OpenFileOptions) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'open',
          pathOrDescriptor: '',
        }),
      )
    },
    sink: (_path: string, _options?: FileSystem.SinkOptions) => {
      return Effect.fail(
        new SystemError({
          reason: 'Unknown',
          module: 'FileSystem',
          method: 'sink',
          pathOrDescriptor: '',
        }),
      )
    },
  }
}

export const makePublicS3FileSystem = (
  bucket: string,
  client: S3Client,
): FileSystem.FileSystem => {
  const baseFs = makeS3FileSystem(bucket, client)

  return {
    ...baseFs,
    writeFile: (
      path: string,
      data: Uint8Array,
      _options?: FileSystem.WriteFileOptions,
    ) => {
      return Effect.tryPromise({
        try: () =>
          client.write(path.replace(LEADING_SLASH, ''), data, {
            acl: 'public-read',
          }),
        catch: (error) =>
          new SystemError({
            reason: 'Unknown',
            module: 'FileSystem',
            method: 'writeFile',
            pathOrDescriptor: path,
            cause: error,
          }),
      }).pipe(Effect.asVoid)
    },
    writeFileString: (
      path: string,
      data: string,
      _options?: FileSystem.WriteFileOptions,
    ) => {
      return Effect.tryPromise({
        try: () =>
          client.write(path.replace(LEADING_SLASH, ''), data, {
            acl: 'public-read',
          }),
        catch: (error) =>
          new SystemError({
            reason: 'Unknown',
            module: 'FileSystem',
            method: 'writeFileString',
            pathOrDescriptor: path,
            cause: error,
          }),
      }).pipe(Effect.asVoid)
    },
  }
}

export const S3FileSystemLive = Layer.effect(
  S3FileSystem,
  Effect.gen(function* () {
    const config = yield* S3Config
    const client = new S3Client({
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      endpoint: config.endpoint,
    })

    return makePublicS3FileSystem(config.bucket, client)
  }),
)
