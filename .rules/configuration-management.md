# Configuration Management

## Environment Variables
- **ALWAYS** define environment variables in `/src/config.ts` using Effect's Config system
- Use `Config.string()` for regular values
- Use `Config.redacted()` for sensitive data (API keys, secrets)
- Use `Config.withDefault()` for optional configuration with defaults

## Configuration Pattern
```typescript
// src/config.ts
export const envVars = {
  PORT: Config.integer('PORT').pipe(Config.withDefault(3001)),
  JOBS_TABLE: Config.string('JOBS_TABLE').pipe(Config.withDefault('jobs-table')),
  API_KEY: Config.redacted('API_KEY'),
} as const
```

## Mock Configuration for Testing
- Always provide a `MockConfigLayer` for testing
- Use `ConfigProvider.fromMap` with test values
- Keep test configuration separate from production

```typescript
const mockConfigProvider = ConfigProvider.fromMap(new Map([
  ['PORT', '3000'],
  ['JOBS_TABLE', 'test-jobs-table'],
]))

export const MockConfigLayer = Layer.setConfigProvider(mockConfigProvider)
```

## Accessing Configuration
- **NEVER** use `process.env` directly
- Access config through Effect system in services
- Configuration is injected through dependency system

```typescript
// ✅ CORRECT
const tableName = yield* envVars.JOBS_TABLE

// ❌ WRONG
const tableName = process.env.JOBS_TABLE
```

## Secret Management
- Never hardcode secrets or API keys
- Use Config.redacted() for sensitive values
- Never log or expose redacted values
- Keep production secrets in secure environment variables