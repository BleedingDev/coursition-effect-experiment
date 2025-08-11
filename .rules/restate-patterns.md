# Restate Patterns

## Workflow Engine Setup
- **Port**: Restate service runs on port 9997
- **Data Directory**: `restate-data/` for persistent state
- **Integration**: Durable workflow execution with automatic retries

## Workflow Implementation

### Step Functions
Located in `/src/steps/`, each step should:
- Be a pure function that returns an Effect
- Handle errors with proper Effect error types
- Include observability with spans
- Be testable in isolation

Example pattern:
```typescript
export const downloadLinkStep = (url: string) =>
  Effect.gen(function* () {
    // Implementation
  }).pipe(
    Effect.withSpan('downloadLinkStep'),
    Effect.tapError(Effect.logError)
  )
```

### Workflow Composition
Located in `/src/workflows/`, workflows should:
- Compose multiple steps into a coherent process
- Handle state transitions properly
- Include proper error recovery strategies
- Maintain idempotency

### State Management
- Use Restate's built-in state management
- Ensure state transitions are atomic
- Handle partial failures gracefully
- Implement proper cleanup on failure

## Testing Workflows
- Test individual steps in isolation
- Mock external dependencies
- Verify state transitions
- Test error recovery paths

## Best Practices
- Keep steps small and focused
- Use Effect's error handling for all failures
- Include comprehensive logging
- Ensure idempotency for all operations
- Handle timeouts appropriately