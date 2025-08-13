#!/usr/bin/env bun
import { Args, Command, Options } from '@effect/cli'
import { FileSystem } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { spawn } from 'bun'
import { Console, Effect, Option, Schema as S } from 'effect'
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

const getLatestVersion = (packageName: string) =>
  Effect.tryPromise({
    try: async () => {
      const proc = spawn(['npm', 'view', packageName, 'version'], {
        stdout: 'pipe',
      })
      const text = await new Response(proc.stdout).text()
      return text.trim()
    },
    catch: () => new Error(`Failed to get version for ${packageName}`),
  })

const readWorkspaceDocument = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const exists = yield* fs.exists('pnpm-workspace.yaml')

  if (!exists) {
    const doc = new Document({ packages: ['packages/*'] })
    return doc
  }

  const content = yield* fs.readFileString('pnpm-workspace.yaml')
  return parseDocument(content)
})

const readWorkspace = Effect.gen(function* () {
  const doc = yield* readWorkspaceDocument
  return yield* S.decode(WorkspaceSchema)(doc.toJSON())
})

const writeWorkspaceDocument = (doc: Document) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.writeFileString('pnpm-workspace.yaml', doc.toString())
  })

const updateDocumentCatalogue = (
  doc: Document,
  catalogue: string,
  packageName: string,
  version: string,
) => {
  if (catalogue === 'default') {
    if (!doc.has('catalog')) {
      doc.set('catalog', {})
    }
    const catalog = doc.get('catalog', true) as any
    if (catalog[packageName]) {
      doc.setIn(['catalog', packageName], `^${version}`)
    } else {
      doc.setIn(['catalog', packageName], `^${version}`)
    }
  } else {
    if (!doc.has('catalogs')) {
      doc.set('catalogs', {})
    }
    if (!doc.hasIn(['catalogs', catalogue])) {
      doc.setIn(['catalogs', catalogue], {})
    }
    doc.setIn(['catalogs', catalogue, packageName], `^${version}`)
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

const pnpmInstallCatalog = (packageName: string, catalogue: string) =>
  Effect.tryPromise({
    try: async () => {
      const catalogRef =
        catalogue === 'default'
          ? `${packageName}@catalog:`
          : `${packageName}@catalog:${catalogue}`

      const proc = spawn(['pnpm', 'add', catalogRef], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      await proc.exited
      if (proc.exitCode !== 0) {
        throw new Error(`pnpm add failed with exit code: ${proc.exitCode}`)
      }
    },
    catch: (e) => new Error(`Failed to install ${packageName} - ${e}`),
  })

const installPackages = (packages: readonly string[], catalogueName?: string) =>
  Effect.gen(function* () {
    if (packages.length === 0) {
      yield* Console.error('❌ No packages specified')
      return
    }

    const workspace = yield* readWorkspace
    const available = getAvailableCatalogues(workspace)

    let catalogue = catalogueName
    if (catalogue) {
      yield* Console.log(`📚 Using catalogue: ${catalogue}`)
    } else if (available.length === 0) {
      catalogue = 'default'
      yield* Console.log('📚 Creating default catalogue')
    } else if (available.length === 1) {
      catalogue = available[0]!
      yield* Console.log(`📚 Using catalogue: ${catalogue}`)
    } else {
      yield* Console.error(
        `❌ Multiple catalogues found: ${available.join(', ')}`,
      )
      yield* Console.error('   Please specify one with --catalogue')
      return
    }

    let doc = yield* readWorkspaceDocument

    for (const packageName of packages) {
      yield* Console.log(`\n📦 Installing ${packageName}...`)

      const version = yield* getLatestVersion(packageName)
      yield* Console.log(`  Found version: ${version}`)

      doc = updateDocumentCatalogue(doc, catalogue, packageName, version)
      yield* writeWorkspaceDocument(doc)

      yield* pnpmInstallCatalog(packageName, catalogue)

      yield* Console.log('✅ Added to catalogue')
    }

    yield* Console.log(
      `\n✨ Done! Added ${packages.length} package(s) to "${catalogue}" catalogue`,
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

const catalogueOption = Options.text('catalogue').pipe(
  Options.withAlias('c'),
  Options.withDescription('Target catalogue name'),
  Options.optional,
)

const installCommand = Command.make(
  'install',
  { packages, catalogue: catalogueOption },
  ({ packages, catalogue }) =>
    installPackages(packages, Option.getOrUndefined(catalogue)).pipe(
      Effect.catchAll((error) => Console.error(`${error.message}`)),
    ),
).pipe(Command.withDescription('Install packages to PNPM workspace catalogue'))

const listCatalogsCommand = Command.make('list-catalogs', {}, () =>
  listCatalogues.pipe(
    Effect.catchAll((error) => Console.error(`❌ ${error.message}`)),
  ),
).pipe(Command.withDescription('List available catalogues and their packages'))

const mainCommand = Command.make('deps', {}, () =>
  Console.log("Use 'deps install' or 'deps list-catalogs'"),
).pipe(
  Command.withDescription('PNPM workspace catalogue manager'),
  Command.withSubcommands([installCommand, listCatalogsCommand]),
)

const app = Command.run(mainCommand, {
  name: 'PNPM Catalogue Manager',
  version: 'v1.0.0',
})

app(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
