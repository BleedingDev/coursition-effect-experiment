#!/usr/bin/env bun
import process from 'node:process'
import { Args, Command, Options } from '@effect/cli'
import { FileSystem } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { spawn } from 'bun'
import { Console, Data, Effect, Match, Schema as S } from 'effect'
import { Document, parseDocument } from 'yaml'

const WorkspaceSchema = S.Struct({
  packages: S.optional(S.Array(S.String)),
  catalog: S.optional(S.Record({ key: S.String, value: S.String })),
  catalogs: S.optional(
    S.Record({
      key: S.String,
      value: S.Record({ key: S.String, value: S.String }),
    }),
  ),
})

class VersionFetchError extends Data.TaggedError('VersionFetchError')<{
  packageName: string
  cause?: unknown
}> {}

class WorkspaceReadError extends Data.TaggedError('WorkspaceReadError')<{
  cause?: unknown
}> {}

class WorkspaceWriteError extends Data.TaggedError('WorkspaceWriteError')<{
  cause?: unknown
}> {}

class WorkspaceParseError extends Data.TaggedError('WorkspaceParseError')<{
  details: string
}> {}

class PnpmInstallError extends Data.TaggedError('PnpmInstallError')<{
  packageName: string
  catalog: string
  exitCode: number
  stderr?: string
}> {}

class CatalogSelectionError extends Data.TaggedError('CatalogSelectionError')<{
  available: string[]
}> {}

type Empty = Record<never, never>
class NoPackagesError extends Data.TaggedError('NoPackagesError')<Empty> {}
class MissingCatalogOptionError extends Data.TaggedError(
  'MissingCatalogOptionError',
)<Empty> {}

type KnownTaggedErrors =
  | VersionFetchError
  | WorkspaceReadError
  | WorkspaceWriteError
  | WorkspaceParseError
  | PnpmInstallError
  | CatalogSelectionError
  | NoPackagesError
  | MissingCatalogOptionError

const isKnownTaggedError = (u: unknown): u is KnownTaggedErrors =>
  typeof u === 'object' &&
  u !== null &&
  '_tag' in u &&
  [
    'VersionFetchError',
    'WorkspaceReadError',
    'WorkspaceWriteError',
    'WorkspaceParseError',
    'PnpmInstallError',
    'CatalogSelectionError',
    'NoPackagesError',
    'MissingCatalogOptionError',
  ].includes((u as { _tag: string })._tag)

const renderTaggedError = Match.type<KnownTaggedErrors>().pipe(
  Match.tagsExhaustive({
    VersionFetchError: (err) =>
      `❌ Failed to fetch latest version for ${err.packageName}`,
    WorkspaceReadError: () => '❌ Failed to read pnpm-workspace.yaml',
    WorkspaceWriteError: () => '❌ Failed to write pnpm-workspace.yaml',
    WorkspaceParseError: (err) =>
      `❌ Failed to parse workspace: ${err.details}`,
    PnpmInstallError: (err) => {
      const stderr = err.stderr?.trim()
      return (
        `❌ pnpm add failed for ${err.packageName} (catalog: ${err.catalog}) with exit code ${err.exitCode}` +
        (stderr ? `\n   stderr: ${stderr}` : '')
      )
    },
    CatalogSelectionError: (err) =>
      `❌ Multiple catalogs found: ${err.available.join(', ')}\n   Please specify one with --catalog`,
    NoPackagesError: () => '❌ No packages specified',
    MissingCatalogOptionError: () =>
      '❌ Missing required option: --catalog <name>\n' +
      '   Usage: deps install --catalog <name> <packages...>  (alias: -c)',
  }),
)

const renderError = (e: unknown): string => {
  if (isKnownTaggedError(e)) {
    return renderTaggedError(e)
  }

  if (typeof e === 'object' && e !== null && '_tag' in e) {
    const MISSING_REQUIRED_OPTION =
      '❌ Missing required option or argument.\n   Usage: deps install --catalog <name> <packages...>  (alias: -c)'
    return Match.value(e).pipe(
      Match.tag('MissingValue', () => MISSING_REQUIRED_OPTION),
      Match.tag('MissingOption', () => MISSING_REQUIRED_OPTION),
      Match.tag('MissingArgument', () => MISSING_REQUIRED_OPTION),
      Match.tag(
        'UnknownOption',
        () => '❌ Unknown option provided. Try --help for usage.',
      ),
      Match.tag(
        'InvalidValue',
        () => '❌ Invalid value for option or argument.',
      ),
      Match.orElse(() => `❌ ${String(e)}`),
    )
  }

  if (e instanceof Error) {
    return `❌ ${e.message}`
  }
  return `❌ ${String(e)}`
}

const getLatestVersion = (packageName: string) =>
  Effect.tryPromise({
    try: async () => {
      const proc = spawn(['npm', 'view', packageName, 'version'], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      await proc.exited
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      if (proc.exitCode !== 0) {
        throw new VersionFetchError({ packageName, cause: stderr })
      }
      const version = stdout.trim()
      if (!version) {
        throw new VersionFetchError({ packageName, cause: 'empty version' })
      }
      return version
    },
    catch: (cause) => new VersionFetchError({ packageName, cause }),
  })

const readWorkspaceDocument = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const exists = yield* fs
    .exists('pnpm-workspace.yaml')
    .pipe(Effect.mapError((cause) => new WorkspaceReadError({ cause })))

  if (!exists) {
    const doc = new Document({ packages: ['packages/*'] })
    return doc
  }

  const content = yield* fs
    .readFileString('pnpm-workspace.yaml')
    .pipe(Effect.mapError((cause) => new WorkspaceReadError({ cause })))
  return parseDocument(content)
})

const readWorkspace = Effect.gen(function* () {
  const doc = yield* readWorkspaceDocument
  return yield* S.decode(WorkspaceSchema)(doc.toJSON()).pipe(
    Effect.mapError(
      (err) =>
        new WorkspaceParseError({
          details: typeof err === 'string' ? err : String(err),
        }),
    ),
  )
})

const writeWorkspaceDocument = Effect.fn('writeWorkspaceDocument')(function* (
  doc: Document,
) {
  const fs = yield* FileSystem.FileSystem
  yield* fs
    .writeFileString('pnpm-workspace.yaml', doc.toString())
    .pipe(Effect.mapError((cause) => new WorkspaceWriteError({ cause })))
})

const updateDocumentCatalog = (
  doc: Document,
  catalog: string,
  packageName: string,
  version: string,
) => {
  if (!doc.has('catalogs')) {
    doc.set('catalogs', {})
  }
  if (!doc.hasIn(['catalogs', catalog])) {
    doc.setIn(['catalogs', catalog], {})
  }
  doc.setIn(['catalogs', catalog, packageName], `^${version}`)
  return doc
}

const pnpmInstallCatalogs = (
  packageNames: readonly string[],
  catalog: string,
  dev = false,
) =>
  Effect.tryPromise({
    try: async () => {
      const catalogRefs = packageNames.map(
        (packageName) => `${packageName}@catalog:${catalog}`,
      )

      const proc = spawn(
        ['pnpm', 'add', ...(dev ? ['-D'] : []), ...catalogRefs],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        },
      )
      await proc.exited
      const exitCode = proc.exitCode ?? -1
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
        throw new PnpmInstallError({
          packageName: packageNames.join(', '),
          catalog,
          exitCode,
          stderr,
        })
      }
    },
    catch: (cause) =>
      cause instanceof PnpmInstallError
        ? cause
        : new PnpmInstallError({
            packageName: packageNames.join(', '),
            catalog,
            exitCode: -1,
            stderr: typeof cause === 'string' ? cause : undefined,
          }),
  })

const installPackages = Effect.fn('installPackages')(function* (
  pkgNames: readonly string[],
  catalogName?: string,
  dev = false,
) {
  if (pkgNames.length === 0) {
    return yield* Effect.fail(new NoPackagesError())
  }

  if (!catalogName) {
    return yield* Effect.fail(new MissingCatalogOptionError())
  }

  const catalog = catalogName
  yield* Console.log(`📚 Using catalog: ${catalog}`)

  const resolved = yield* Effect.all(
    pkgNames.map((packageName) =>
      getLatestVersion(packageName).pipe(
        Effect.map((version) => ({ packageName, version })),
      ),
    ),
    { concurrency: Math.min(8, pkgNames.length) },
  )

  const versions = new Map(
    resolved.map(({ packageName, version }) => [packageName, version] as const),
  )

  let doc = yield* readWorkspaceDocument

  for (const packageName of pkgNames) {
    const version = versions.get(packageName)
    if (version) {
      yield* Console.log(
        `📦 Queuing ${packageName}@^${version} for catalog "${catalog}"`,
      )
      doc = updateDocumentCatalog(doc, catalog, packageName, version)
    } else {
      yield* Effect.fail(
        new VersionFetchError({
          packageName,
          cause: 'missing resolved version',
        }),
      )
    }
  }

  yield* writeWorkspaceDocument(doc)
  yield* Console.log('📝 Updated pnpm-workspace.yaml with catalog entries')

  yield* Console.log('📦 Installing packages via pnpm in one batch...')
  yield* pnpmInstallCatalogs(pkgNames, catalog, dev)
  yield* Console.log(
    `✅ Installed ${pkgNames.length} package(s) from catalog "${catalog}"`,
  )

  yield* Console.log(
    `\n✨ Done! Added ${pkgNames.length} package(s) to "${catalog}" catalog`,
  )
})

const listCatalogs = Effect.gen(function* () {
  const workspace = yield* readWorkspace
  const catalogs = Object.keys(workspace.catalogs || {})

  if (catalogs.length === 0) {
    yield* Console.log('📭 No catalogs found')
    return
  }

  yield* Console.log('📚 Available catalogs:\n')

  for (const name of catalogs) {
    const packages = workspace.catalogs?.[name]

    const count = packages ? Object.keys(packages).length : 0
    yield* Console.log(`${name} (${count} packages)`)

    if (packages && count > 0) {
      for (const [pkg, version] of Object.entries(packages)) {
        yield* Console.log(`  - ${pkg}: ${version}`)
      }
    }
    yield* Console.log('')
  }
})

const packages = Args.text({ name: 'packages' }).pipe(Args.repeated)

const catalogOption = Options.text('catalog').pipe(
  Options.withAlias('c'),
  Options.withDescription('Target catalog name'),
)

const devOption = Options.boolean('dev').pipe(
  Options.withAlias('D'),
  Options.withDescription('Install as devDependency (pnpm add -D)'),
)

const installCommand = Command.make(
  'install',
  { packages, catalog: catalogOption, dev: devOption },
  ({ packages: pkgArgs, catalog, dev }) =>
    installPackages(pkgArgs, catalog, dev).pipe(
      Effect.catchAll((error) =>
        Console.error(renderError(error)).pipe(
          Effect.zipRight(Effect.sync(() => process.exit(1))),
        ),
      ),
    ),
).pipe(Command.withDescription('Install packages to PNPM workspace catalog'))

const listCatalogsCommand = Command.make('list-catalogs', {}, () =>
  listCatalogs.pipe(
    Effect.catchAll((error) =>
      Console.error(renderError(error)).pipe(
        Effect.zipRight(Effect.sync(() => process.exit(1))),
      ),
    ),
  ),
).pipe(Command.withDescription('List available catalogs and their packages'))

const mainCommand = Command.make('deps', {}, () =>
  Console.log("Use 'deps install' or 'deps list-catalogs'"),
).pipe(
  Command.withDescription('PNPM workspace catalog manager'),
  Command.withSubcommands([installCommand, listCatalogsCommand]),
)

const app = Command.run(mainCommand, {
  name: 'PNPM Catalog Manager',
  version: 'v1.0.0',
})

app(process.argv).pipe(
  Effect.catchAll((error) =>
    Console.error(
      [
        renderError(error),
        '',
        'Tip:',
        '  - deps install --catalog <name> <packages...>',
        '  - deps list-catalogs',
      ].join('\n'),
    ).pipe(Effect.zipRight(Effect.sync(() => process.exit(1)))),
  ),
  Effect.provide(BunContext.layer),
  BunRuntime.runMain,
)
