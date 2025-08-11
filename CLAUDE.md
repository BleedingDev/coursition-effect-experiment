# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a media parsing service built with Effect-TS functional programming framework. The codebase follows clean architecture with Effect-TS patterns for dependency injection, error handling, and observability.

## Development Rules

All development rules and patterns are documented in the `.rules/` folder. Follow these rules strictly:

### Core Effect-TS Patterns
- **Code Style**: See `.rules/code-style.mdc` for import patterns, naming conventions, and Effect basics
- **Service Architecture**: See `.rules/effect-service-architecture.mdc` for layered architecture patterns
- **Store Patterns**: See `.rules/effect-store-patterns.mdc` for data access layer implementation
- **Usecase Patterns**: See `.rules/effect-usecase-patterns.mdc` for business logic patterns
- **Handler Patterns**: See `.rules/effect-handler-patterns.mdc` for HTTP handler implementation
- **Testing Patterns**: See `.rules/effect-testing-patterns.mdc` for testing with @effect/vitest
- **Schema Validation**: See `.rules/schema-validation.mdc` for schema and error definitions
- **API Client Patterns**: See `.rules/api-client-patterns.mdc` for HTTP client implementation

### Project-Specific Rules
- **Development Workflow**: See `.rules/development-workflow.md` for commands and tool management
- **Project Conventions**: See `.rules/project-conventions.md` for file organization and git conventions
- **Configuration Management**: See `.rules/configuration-management.md` for environment variables and config patterns
- **Restate Patterns**: See `.rules/restate-patterns.md` for workflow engine integration

## Essential Commands

```bash
# Installation (requires pnpm via proto)
pnpm install

# Development
bun run dev:server      # Start development server with watch mode
bun run start:server    # Start production server

# Testing
bun run test           # Run all tests
bun run test:watch     # Run tests in watch mode
bun run test:ui        # Open Vitest UI

# Code Quality (run these before committing)
bun run check          # Run Biome format and lint
bun run typecheck      # Run TypeScript type checking
```

## Important Guidelines

### Rules for 'Extra' Files
- Never create .md files for summaries, setup guides, etc., unless the user explicitly requests them
- If you need to create any test files, follow the patterns in `.rules/effect-testing-patterns.mdc`

### When Making Changes
1. Always check for existing methods, utils, or services before creating new ones
2. Follow the Effect-TS patterns documented in `.rules/`
3. Use relative imports, never `src/` aliases
4. Run `bun run check` and `bun run typecheck` before suggesting commits
5. Only commit when explicitly asked, using Conventional Commits format

### Architecture Reminders
- This project uses Effect-TS everywhere - no plain async/await or Promises
- All errors must be tagged errors (Data.TaggedError or Schema.TaggedError)
- Services use dependency injection via Effect.Service pattern
- Configuration comes from Effect Config, never process.env directly
- Observability is built-in - always add spans and use Effect logging