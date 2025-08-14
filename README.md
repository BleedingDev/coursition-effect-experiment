# Coursition Experiment

A media parsing service built with Effect-TS architecture, demonstrating modern functional programming patterns for TypeScript applications.

## 🏗️ Architecture

This project follows Effect-TS service architecture patterns with clear separation of concerns:

```
src/
├── config.ts                 # Configuration management
├── api.ts                    # API definition
├── client.ts                 # API client
├── server.ts                 # Server setup
├── domain/                   # Domain models and schemas
│   ├── jobs/                 # Job-related domain objects
│   ├── media/                # Media parsing domain objects
│   └── common/               # Shared domain objects
├── stores/                   # Data access layer
│   ├── jobs/                 # Job data operations
│   └── media/                # Media parsing operations
├── usecases/                 # Business logic layer
│   ├── jobs/                 # Job-related business logic
│   └── media/                # Media parsing business logic
└── handlers/                 # HTTP request handlers
    ├── jobs/                 # Job API handlers
    └── media/                # Media parsing API handlers
```

## 🚀 Key Features

- **Effect-TS Architecture**: Functional programming with proper error handling
- **Type-Safe APIs**: Full type safety from client to server
- **Layered Architecture**: Clear separation of stores → usecases → handlers
- **Comprehensive Testing**: Unit tests for all layers
- **Configuration Management**: Environment-based configuration with defaults
- **Observability**: Built-in logging and tracing
- **Error Handling**: Proper domain errors and HTTP error mapping

## 📋 API Endpoints

### Media Parsing
- `POST /media/parse` - Parse media from URL or file upload
  - Supports both file uploads and URL-based parsing
  - Returns subtitle data in structured JSON format

### Job Management
- `GET /media/jobs` - Get all parsing jobs
- `GET /media/job/{id}` - Get specific job details
- `GET /media/job/{id}/result` - Get job results (when completed)

## 🛠️ Development

### Prerequisites
- Bun runtime
- Node.js 18+ (for development tools)

### Installation
```bash
pnpm install
```

### Development Server
```bash
bun run dev:server
```
Server runs on http://localhost:3001 (or PORT environment variable)

### Testing
```bash
# Run all tests
bun run test

# Watch mode
bun run test:watch

# UI mode
bun run test:ui
```

### Code Quality
```bash
# Format and lint
bun run check

# Type checking
bun run typecheck

# Format only
bun run format

# Lint only
bun run lint
```

## 🔧 Configuration

Environment variables:
- `PORT` - Server port (default: 3001)
- `JOBS_TABLE` - Database table for job storage
- `LOG_LEVEL` - Logging level (default: info)

## 🧪 Testing Architecture

Each layer includes comprehensive tests:
- **Store Tests**: Data access layer testing with mocked dependencies
- **Usecase Tests**: Business logic testing with service mocks
- **Handler Tests**: Request/response testing with full layer mocking

Tests follow Effect-TS patterns using `@effect/vitest` for proper Effect testing.
