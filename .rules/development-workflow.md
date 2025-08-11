# Development Workflow

## Tool Management
- **Tool Versions**: Managed via `proto` with configuration in `.prototools`
- **Bun**: Version 1.2.17 (runtime for executing the project)
- **Node**: Version ~24 (for compatibility)
- **pnpm**: Version ~10 (for managing dependencies)

## Package Management
- **Dependencies**: Use `pnpm` for managing dependencies
- **Runtime**: Use `bun` for executing the project
- **Workspace**: Project uses pnpm workspace with catalog-based dependency management

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
1. Ensure correct tool versions via proto (check `.prototools`)
2. Install dependencies with `pnpm install`
3. Start development server with `bun run dev:server`
4. Make changes and verify with tests using `bun run test`
5. Ensure code quality with `bun run check` and `bun run typecheck`
6. Build for production with `bun run build`

## Dependency Management
- Effect ecosystem packages managed via pnpm catalogs
- Separate catalogs for effect, test, lint, and types packages
- Always use exact versions for critical dependencies
- Update dependencies through pnpm catalog system