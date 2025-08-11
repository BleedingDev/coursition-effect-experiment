# Logging and Observability

## Logging Guidelines

### Use Effect Logging System
- **ALWAYS** use Effect's logging utilities, never `console.log`
- Keep logging concise and structured
- Include only essential context

```typescript
// ✅ CORRECT - Concise structured logging
yield* Effect.logInfo('Operation started', { id, operation: 'create' })
yield* Effect.logError('Operation failed')

// ❌ WRONG - Using console.log
console.log('Operation started')
```

### Error Logging Pattern
**ALWAYS use this simple pattern for error logging:**

```typescript
// ✅ CORRECT - Simple error logging
Effect.tapError(Effect.logError)

// ❌ WRONG - Verbose custom error messages
Effect.tapError((error) => 
  Effect.logError('Custom message', JSON.stringify(error))
)
```

### When to Log
- **Stores**: Log data operations for debugging
- **Usecases**: Minimal logging - errors are already logged via tapError
- **Handlers**: Errors logged automatically via tapError
- **Steps**: Log workflow step transitions

## Observability with Spans

### Span Naming
- Use **kebab-case** for span names: `get-job-by-id`, `create-blog-post`
- Name should describe the operation clearly

### Span Attributes
- Include only **primitive values** in attributes
- Never serialize entire objects

```typescript
// ✅ CORRECT - Primitive attributes
Effect.withSpan('get-job-by-id', {
  attributes: { 
    jobId: id,
    status: 'pending'
  }
})

// ❌ WRONG - Complex objects
Effect.withSpan('get-job', {
  attributes: { 
    job: JSON.stringify(entireJobObject)
  }
})
```

### Span Annotations
Use for adding data to current span at key points:

```typescript
// ✅ CORRECT - Annotate key metrics
yield* Effect.annotateCurrentSpan('itemCount', items.length)
yield* Effect.annotateCurrentSpan('userId', user.id)

// ❌ WRONG - Annotating entire objects
yield* Effect.annotateCurrentSpan('user', JSON.stringify(user))
```

## Standard Patterns by Layer

### Store Layer
```typescript
getById: (id: string) =>
  Effect.gen(function* () {
    // Implementation
    return result
  }).pipe(
    Effect.withSpan('JobsStore.getById', {
      attributes: { id, tableName }
    })
  )
```

### Usecase Layer
```typescript
export const getJobsUsecase = () =>
  Effect.gen(function* () {
    // Business logic
    return result
  }).pipe(
    Effect.tapError(Effect.logError),  // Simple error logging
    Effect.withSpan('getJobsUsecase')
  )
```

### Handler Layer
```typescript
export const _handler = schemaInput(InputSchema).pipe(
  Effect.flatMap(usecase),
  Effect.flatMap(okResponse),
  Effect.tapError(Effect.logError),  // Simple error logging
  Effect.withSpan('handler-name')
)
```

## OpenTelemetry Integration
- Configured in server setup
- Exports to `http://localhost:4318` by default
- DevTools layer provides runtime inspection