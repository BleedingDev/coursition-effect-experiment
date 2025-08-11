# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a media parsing service built with Effect-TS functional programming framework. The codebase follows clean architecture with Effect-TS patterns for dependency injection, error handling, and observability.

## Quick Navigation - Common Tasks

### 🏗️ Creating New Features
- **Need to create a new data store?** → See [Store implementation](.rules/effect-store-patterns.mdc) and [Service definition](.rules/effect-service-architecture.mdc#service-definition)
- **Adding a new HTTP handler?** → See [Handler structure](.rules/effect-handler-patterns.mdc#standard-rest-api-handler) and [Co-location pattern](.rules/effect-handler-patterns.mdc#usecase-co-location-pattern)
- **Writing business logic (usecase)?** → See [Usecase patterns](.rules/effect-usecase-patterns.mdc#mandatory-usecase-structure) and [Error handling strategy](.rules/effect-usecase-patterns.mdc#error-handling-strategy-by-usecase-type)
- **Creating a workflow step?** → See [Restate patterns](.rules/restate-patterns.md#step-functions)
- **Adding a new schema?** → See [Schema validation](.rules/schema-validation.mdc#branded-types) and [Error types](.rules/schema-validation.mdc#error-types)

### 🧪 Testing
- **Writing a store test?** → See [Store testing](.rules/effect-testing-patterns.mdc#store-testing-with-mock-layers)
- **Testing a usecase?** → See [Usecase testing](.rules/effect-testing-patterns.mdc#usecase-testing-pattern)
- **Testing an API client?** → See [API client testing](.rules/api-client-testing.mdc)
- **Need to test errors?** → See [Error testing patterns](.rules/effect-testing-patterns.mdc#error-testing-patterns)
- **Testing with mocks?** → See [Mock service patterns](.rules/effect-testing-patterns.mdc#service-testing-patterns)

### 🔧 Common Patterns
- **How to handle configuration?** → See [Configuration management](.rules/configuration-management.md) and [Mock config for tests](.rules/configuration-management.md#mock-configuration-for-testing)
- **Import patterns?** → See [Imports and conventions](.rules/imports-and-conventions.md)
- **Logging and tracing?** → See [Logging patterns](.rules/logging-and-observability.md)
- **Performance optimization?** → See [Layer reuse](.rules/performance-patterns.md#layer-reuse-for-expensive-resources) and [Optimization patterns](.rules/performance-patterns.md#effect-optimization-patterns)

### ❓ Decision Points
- **When to use Effect.orDie vs letting errors bubble?** → See [Decision tree](.rules/decision-trees.md#1-effectordie-vs-letting-errors-bubble-up) and [Error matrix](.rules/effect-usecase-patterns.mdc#error-handling-decision-matrix)
- **Schema.TaggedError vs Data.TaggedError?** → See [Decision tree](.rules/decision-trees.md#2-schemataggederror-vs-datataggederror)
- **When to create a Layer vs direct import?** → See [Decision tree](.rules/decision-trees.md#3-when-to-create-a-layer-vs-direct-dependency)
- **Effect.all parallel vs sequential?** → See [Decision tree](.rules/decision-trees.md#4-effectall-concurrency-vs-sequential)
- **How to organize files?** → See [File organization](.rules/imports-and-conventions.md#file-organization-patterns)
- **Naming conventions?** → See [Naming conventions](.rules/imports-and-conventions.md#naming-conventions)

### 🐛 Troubleshooting
- **"Cannot find module 'src/...'"** → You're using src/ aliases. See [Import patterns](.rules/imports-and-conventions.md#critical-always-use-relative-paths)
- **Effect errors not being caught** → Check [Tagged errors](.rules/effect-testing-patterns.mdc#critical-never-throw-errors-use-tagged-errors)
- **Tests failing with mocks** → See [Variable scoping](.rules/effect-testing-patterns.mdc#critical-variable-scoping-for-fetchhttpclienttest)
- **Logging too verbose/not working** → See [Error logging pattern](.rules/logging-and-observability.md#error-logging-pattern)

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

## Complete Rule Reference

### Core Effect-TS Patterns
- [`code-style.mdc`](.rules/code-style.mdc) - Effect basics, service architecture, configuration
- [`effect-service-architecture.mdc`](.rules/effect-service-architecture.mdc) - Layered architecture (Store → Usecase → Handler)
- [`effect-store-patterns.mdc`](.rules/effect-store-patterns.mdc) - Data access layer, CRUD operations
- [`effect-usecase-patterns.mdc`](.rules/effect-usecase-patterns.mdc) - Business logic, error handling strategies
- [`effect-handler-patterns.mdc`](.rules/effect-handler-patterns.mdc) - HTTP handlers, request/response patterns
- [`effect-testing-patterns.mdc`](.rules/effect-testing-patterns.mdc) - Testing with @effect/vitest, mocking
- [`schema-validation.mdc`](.rules/schema-validation.mdc) - Schema definitions, branded types
- [`api-client-patterns.mdc`](.rules/api-client-patterns.mdc) - HTTP client implementation
- [`api-client-testing.mdc`](.rules/api-client-testing.mdc) - Testing API clients

### Project Organization
- [`imports-and-conventions.md`](.rules/imports-and-conventions.md) - Import patterns, naming conventions
- [`logging-and-observability.md`](.rules/logging-and-observability.md) - Logging, spans, OpenTelemetry
- [`performance-patterns.md`](.rules/performance-patterns.md) - Layer reuse, caching, optimization
- [`decision-trees.md`](.rules/decision-trees.md) - Quick decision guides for Effect patterns
- [`development-workflow.md`](.rules/development-workflow.md) - Commands, tool management via proto
- [`project-conventions.md`](.rules/project-conventions.md) - Git conventions, file organization
- [`configuration-management.md`](.rules/configuration-management.md) - Environment variables, Effect Config
- [`restate-patterns.md`](.rules/restate-patterns.md) - Workflow engine integration

## Important Guidelines

### Rules for 'Extra' Files
- Never create .md files for summaries, setup guides, etc., unless the user explicitly requests them
- Write tests following patterns in [effect-testing-patterns.mdc](.rules/effect-testing-patterns.mdc)

### When Making Changes
1. Always check for existing methods, utils, or services before creating new ones
2. Follow the Effect-TS patterns documented in `.rules/`
3. Use relative imports, never `src/` aliases - See [imports](.rules/imports-and-conventions.md)
4. Run `bun run check` and `bun run typecheck` before suggesting commits
5. Only commit when explicitly asked, using [Conventional Commits](.rules/project-conventions.md#git-conventions)

### Architecture Reminders
- This project uses Effect-TS everywhere - no plain async/await or Promises
- All errors must be tagged errors - See [error patterns](.rules/effect-testing-patterns.mdc#critical-never-throw-errors-use-tagged-errors)
- Services use dependency injection via Effect.Service pattern
- Configuration comes from [Effect Config](.rules/configuration-management.md), never process.env directly
- Observability is built-in - always add [spans and logging](.rules/logging-and-observability.md)