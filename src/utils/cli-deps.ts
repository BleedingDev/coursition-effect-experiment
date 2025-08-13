#!/usr/bin/env bun
import { Args, Command, Options } from '@effect/cli'
import { FileSystem } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { spawn } from 'bun'
import { Console, Data, Effect, Schema as S } from 'effect'
import { Document, parseDocument } from 'yaml'

const WorkspaceSchema = S.mutable(
  S.Struct({
    packages: S.optional(S.Array(S.String)),
    catalog: S.optional(
      S.mutable(S.Record({ key: S.String, value: S.String })),
    ),
    catalogs: S.optional(
      S.mutable(
        S.Record({
          key: S.String,
          value: S.mutable(S.Record({ key: S.String, value: S.String })),
        }),
      ),
    ),
  }),
)

type Workspace = S.Schema.Type<typeof WorkspaceSchema>

// -----------------------------
// Typed domain errors
// -----------------------------
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

class CatalogueSelectionError extends Data.TaggedError(
  'CatalogueSelectionError',
)<{
  available: string[]
}> {}

type Empty = Record<never, never>
class NoPackagesError extends Data.TaggedError('NoPackagesError')<Empty> {}

const renderError = (e: unknown): string => {
  if (typeof e === 'object' && e !== null && '_tag' in e) {
    const tag = (e as { _tag: string })._tag
    switch (tag) {
      case 'VersionFetchError': {
        const err = e as VersionFetchError
        return `❌ Failed to fetch latest version for ${err.packageName}`
      }
      case 'WorkspaceReadError':
        return '❌ Failed to read pnpm-workspace.yaml'
      case 'WorkspaceWriteError':
        return '❌ Failed to write pnpm-workspace.yaml'
      case 'WorkspaceParseError': {
        const err = e as WorkspaceParseError
        return `❌ Failed to parse workspace: ${err.details}`
      }
      case 'PnpmInstallError': {
        const err = e as PnpmInstallError
        const stderr = err.stderr?.trim()
        return `❌ pnpm add failed for ${err.packageName} (catalog: ${err.catalog}) with exit code ${err.exitCode}${
          stderr ? `\n   stderr: ${stderr}` : ''
        }`
      }
      case 'CatalogueSelectionError': {
        const err = e as CatalogueSelectionError
        return `❌ Multiple catalogues found: ${err.available.join(', ')}\n   Please specify one with --catalog`
      }
      case 'NoPackagesError':
        return '❌ No packages specified'
      default:
        return `❌ ${String(e)}`
    }
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

const writeWorkspaceDocument = (doc: Document) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs
      .writeFileString('pnpm-workspace.yaml', doc.toString())
      .pipe(Effect.mapError((cause) => new WorkspaceWriteError({ cause })))
  })

const updateDocumentCatalogue = (
  doc: Document,
  catalog: string,
  packageName: string,
  version: string,
) => {
  if (catalog === 'default') {
    if (!doc.has('catalog')) {
      doc.set('catalog', {})
    }
    doc.setIn(['catalog', packageName], `^${version}`)
  } else {
    if (!doc.has('catalogs')) {
      doc.set('catalogs', {})
    }
    if (!doc.hasIn(['catalogs', catalog])) {
      doc.setIn(['catalogs', catalog], {})
    }
    doc.setIn(['catalogs', catalog, packageName], `^${version}`)
  }
  return doc
}

const getAvailableCatalogues = (workspace: Workspace): string[] => {
  const catalogues: string[] = []

  if (workspace.catalog && Object.keys(workspace.catalog).length > 0) {
    catalogues.push('default')
  }

  if (workspace.catalogs) {
    catalogues.push(...Object.keys(workspace.catalogs))
  }

  return catalogues
}

const pnpmInstallCatalog = (packageName: string, catalog: string) =>
  Effect.tryPromise({
    try: async () => {
      const catalogRef =
        catalog === 'default'
          ? `${packageName}@catalog:`
          : `${packageName}@catalog:${catalog}`

      const proc = spawn(['pnpm', 'add', catalogRef], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      await proc.exited
      const exitCode = proc.exitCode ?? -1
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
        throw new PnpmInstallError({
          packageName,
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
            packageName,
            catalog,
            exitCode: -1,
            stderr: typeof cause === 'string' ? cause : undefined,
          }),
  })

const installPackages = (pkgNames: readonly string[], catalogueName?: string) =>
  Effect.gen(function* () {
    if (pkgNames.length === 0) {
      return yield* Effect.fail(new NoPackagesError())
    }

    const workspace = yield* readWorkspace
    const available = getAvailableCatalogues(workspace)

    let catalog = catalogueName
    if (catalog) {
      yield* Console.log(`📚 Using catalog: ${catalog}`)
    } else if (available.length === 0) {
      catalog = 'default'
      yield* Console.log('📚 Creating default catalog')
    } else if (available.length === 1) {
      const only = available[0]
      if (!only) {
        return yield* Effect.fail(new CatalogueSelectionError({ available }))
      }
      catalog = only
      yield* Console.log(`📚 Using catalog: ${catalog}`)
    } else {
      return yield* Effect.fail(new CatalogueSelectionError({ available }))
    }

    let doc = yield* readWorkspaceDocument

    for (const packageName of pkgNames) {
      yield* Console.log(`\n📦 Installing ${packageName}...`)

      const version = yield* getLatestVersion(packageName)
      yield* Console.log(`  Found version: ${version}`)

      doc = updateDocumentCatalogue(doc, catalog, packageName, version)
      yield* writeWorkspaceDocument(doc)

      yield* pnpmInstallCatalog(packageName, catalog)

      yield* Console.log('✅ Added to catalog')
    }

    yield* Console.log(
      `\n✨ Done! Added ${pkgNames.length} package(s) to "${catalog}" catalog`,
    )
  })

const listCatalogues = Effect.gen(function* () {
  const workspace = yield* readWorkspace
  const catalogues = getAvailableCatalogues(workspace)

  if (catalogues.length === 0) {
    yield* Console.log('📭 No catalogues found')
    return
  }

  yield* Console.log('📚 Available catalogues:\n')

  for (const name of catalogues) {
    const packages =
      name === 'default' ? workspace.catalog : workspace.catalogs?.[name]

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

const catalogueOption = Options.text('catalog').pipe(
  Options.withAlias('c'),
  Options.withDescription('Target catalog name'),
)

const installCommand = Command.make(
  'install',
  { packages, catalog: catalogueOption },
  ({ packages: pkgArgs, catalog }) =>
    installPackages(pkgArgs, catalog).pipe(
      Effect.catchAll((error) =>
        Console.error(renderError(error)).pipe(
          Effect.flatMap(() => Effect.fail(error)),
        ),
      ),
    ),
).pipe(Command.withDescription('Install packages to PNPM workspace catalog'))

const listCatalogsCommand = Command.make('list-catalogs', {}, () =>
  listCatalogues.pipe(
    Effect.catchAll((error) =>
      Console.error(renderError(error)).pipe(
        Effect.flatMap(() => Effect.fail(error)),
      ),
    ),
  ),
).pipe(Command.withDescription('List available catalogues and their packages'))

const mainCommand = Command.make('deps', {}, () =>
  Console.log("Use 'deps install' or 'deps list-catalogs'"),
).pipe(
  Command.withDescription('PNPM workspace catalog manager'),
  Command.withSubcommands([installCommand, listCatalogsCommand]),
)

const app = Command.run(mainCommand, {
  name: 'PNPM Catalogue Manager',
  version: 'v1.0.0',
})

app(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
