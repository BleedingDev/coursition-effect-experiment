# Development Workflow

## Tool Management
- Tool versions are managed via `proto` (see `.prototools`).
- Bun: 1.2.17 (runtime for executing the project)
- Node: ~24 (for compatibility)
- pnpm: ~10 (workspace package manager)

## Package Management
- Runtime: Use `bun` to run scripts.
- Workspace: pnpm workspace with catalog-based dependency management.
- Dependencies: Manage exclusively via our deps CLI. Do not run `pnpm add` or `pnpm install` directly.

## Essential Commands

### Installation
```bash
pnpm install          # Install all dependencies
```

### Development
```bash
bun run dev:server    # Start development server with watch mode
bun run start:server  # Start production server
```

### Testing
```bash
bun run test          # Run all tests
bun run test:watch    # Run tests in watch mode
bun run test:ui       # Open Vitest UI for interactive testing
```

### Code Quality
```bash
bun run check         # Run Biome format and lint checks
bun run typecheck     # Run TypeScript type checking
bun run build         # Compile TypeScript
```

## Development Process
1. Ensure correct tool versions via proto (see `.prototools`).
2. Manage dependencies via the deps CLI (see below). Never use `pnpm add` or `pnpm install`.
3. Start the dev server with `bun run dev:server`.
4. Validate changes with `bun run test`.
5. Keep quality high with `bun run check` and `bun run typecheck`.
6. Build for production with `bun run build`.

## Installing and Updating Libraries (deps CLI)

This project uses a strict, catalog-based dependency workflow powered by a custom CLI located at `src/utils/cli-deps.ts` and exposed as `pnpm run deps`.

Important rules:
- Never run `pnpm add` or `pnpm install ...` directly.
- Never hand-edit dependency versions in `package.json` or `pnpm-workspace.yaml`.
- Always use the deps CLI to add or update libraries.

### CLI overview
- List catalogs and their packages:
```bash
pnpm run deps list-catalogs
```

- Install libraries into a specific catalog (required):
```bash
pnpm run deps install --catalog <name> <packages...>
# alias: -c
```

What the CLI does:
- Fetches the latest version for each package from npm.
- Updates `pnpm-workspace.yaml` under `catalogs.<name>` with version ranges.
- Runs a single batch install wired to the selected catalog.
- Provides clear, actionable errors on invalid input or failures.

### Catalogs
Dependencies are organized into catalogs inside `pnpm-workspace.yaml`:
- effect: Effect-TS ecosystem (`effect`, `@effect/*`, `@typed/*`)
- ai: AI SDKs (`@ai-sdk/*`, `ai`)
- core: Core platform (`@restatedev/*`)
- test: Testing (`vitest`, `@effect/vitest`, `@vitest/ui`)
- lint: Linting/formatting (`@biomejs/biome`, `ultracite`)
- types: TypeScript and types (`typescript`, `@types/*`, `ts-patch`)
- other: Misc tooling (`yaml`, ...)

### Examples
```bash
# Install vitest to test catalog as dev dependency
pnpm run deps install -c test vitest

# Add OpenAI SDKs to the ai catalog
pnpm run deps install -c ai @ai-sdk/openai ai

# Add core Restate SDKs to the core catalog
pnpm run deps install -c core @restatedev/restate-sdk @restatedev/restate-sdk-clients

# Add Effect-TS libs to the effect catalog
pnpm run deps install -c effect effect @effect/cli @effect/platform @effect/platform-bun
```

### Version strategy
- Versions are recorded as caret ranges by the tool (e.g., `^1.2.3`) in `pnpm-workspace.yaml` catalogs.
- The CLI always resolves the latest available version from the registry at install time.
- Do not manually edit versions; re-run the CLI to update.

### Updating dependencies
To upgrade packages to their latest versions, re-run the same install command targeting the appropriate catalog:
```bash
pnpm run deps install -c test vitest @effect/vitest @vitest/ui
```
The CLI will fetch the latest versions, update the catalog, and perform a single batch install.

### Troubleshooting
- Missing catalog option: The CLI requires `--catalog <name>` (alias `-c`).
- No packages passed: You must specify one or more package names.
- Inspect available catalogs and contents: `pnpm run deps list-catalogs`.

## Notes
- Commit changes to `pnpm-workspace.yaml` when catalogs are updated.
- `package.json` entries should reference `catalog:<name>` for each dependency; the CLI keeps these aligned.
- If you encounter issues, rerun the command with the same flags; errors include guidance (exit codes, stderr) for quick diagnosis.
