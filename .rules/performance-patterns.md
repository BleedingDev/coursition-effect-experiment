# Performance Patterns

## Layer Reuse for Expensive Resources

### When to Create Reusable Layers
Create a reusable Layer when:
- The resource has expensive initialization (e.g., database connections, API clients)
- The resource is used across multiple handlers or services
- The resource can be safely shared between operations

### Example: Restate Client Layer
```typescript
// Define the reusable layer
export const RestateClientLive = Layer.effect(
  RestateClient,
  Effect.gen(function* () {
    const restateUrl = yield* Config.url('RESTATE_URL')
    
    // Expensive connection with retry logic
    const client = yield* Effect.try({
      try: () => clients.connect({ url: restateUrl.toString() }),
      catch: (error) => new Error(`Failed to connect to Restate: ${error}`),
    }).pipe(
      Effect.retry(
        Schedule.union(Schedule.exponential('1 second', 2), Schedule.recurs(5)),
      ),
      Effect.tap(() => Effect.log('Successfully connected to Restate')),
    )
    
    return client
  }),
)

// Reuse in server setup
const MainLive = Layer.mergeAll(
  JobsStore.Default,
  MediaStore.Default,
  WorkflowStore.Default.pipe(
    Layer.provide(RestateClientLive), // Reuse the connection
  ),
)
```

### Layer Caching Pattern
```typescript
// Cache expensive computations
export const ExpensiveServiceLive = Layer.effect(
  ExpensiveService,
  Effect.gen(function* () {
    // This initialization only happens once
    const data = yield* loadExpensiveData()
    const cache = new Map()
    
    return {
      compute: (input: string) =>
        Effect.sync(() => {
          if (cache.has(input)) {
            return cache.get(input)!
          }
          const result = expensiveComputation(input)
          cache.set(input, result)
          return result
        }),
    }
  }),
).pipe(Layer.memoize) // Ensure single instance
```

## Effect Optimization Patterns

### Batch Operations
```typescript
// Instead of multiple individual calls
const results = yield* Effect.all(
  ids.map(id => store.getById(id)),
  { concurrency: 10 } // Limit concurrency
)

// Use batch operation when available
const results = yield* store.getBatch(ids)
```

### Parallel Execution
```typescript
// ✅ CORRECT - Parallel execution
const [users, posts, comments] = yield* Effect.all([
  getUsersEffect,
  getPostsEffect,
  getCommentsEffect,
])

// ❌ WRONG - Sequential execution
const users = yield* getUsersEffect
const posts = yield* getPostsEffect
const comments = yield* getCommentsEffect
```

### Resource Pooling
```typescript
// Use Effect's built-in pooling
export const ConnectionPoolLive = Layer.scoped(
  ConnectionPool,
  Effect.gen(function* () {
    const pool = yield* Pool.make({
      acquire: createConnection,
      min: 2,
      max: 10,
    })
    return pool
  }),
)
```

## Caching Strategies

### Request-Level Caching
```typescript
// Cache within request scope
export const withRequestCache = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const cache = yield* FiberRef.make(new Map<string, A>())
    return yield* effect.pipe(
      Effect.provideSomeLayer(Layer.succeed(RequestCache, cache)),
    )
  })
```

### TTL Caching
```typescript
export const cachedOperation = (key: string) =>
  Effect.gen(function* () {
    const cache = yield* Cache
    
    return yield* cache.get(key).pipe(
      Effect.catchTag('CacheMiss', () =>
        fetchData(key).pipe(
          Effect.tap(data => cache.set(key, data, '5 minutes')),
        ),
      ),
    )
  })
```

## Memory Management

### Stream Processing for Large Data
```typescript
// ✅ CORRECT - Stream processing
import { Stream } from 'effect'

const processLargeFile = (path: string) =>
  Stream.fromReadable(() => fs.createReadStream(path)).pipe(
    Stream.map(processChunk),
    Stream.runCollect,
  )

// ❌ WRONG - Loading everything into memory
const content = yield* readFile(path)
const result = processContent(content)
```

### Cleanup Resources
```typescript
// Use Effect.acquireRelease for resource management
const withTempFile = <R, E, A>(
  use: (path: string) => Effect.Effect<A, E, R>,
) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const path = generateTempPath()
      fs.writeFileSync(path, '')
      return path
    }),
    (path) =>
      Effect.sync(() => {
        if (fs.existsSync(path)) {
          fs.unlinkSync(path)
        }
      }).pipe(Effect.orDie),
  ).pipe(Effect.flatMap(use))