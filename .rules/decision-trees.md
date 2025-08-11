# Decision Trees for Effect Patterns

Quick decision guides for common Effect-TS pattern choices.

## 1. Effect.orDie vs Letting Errors Bubble Up

```
Is this error expected and meaningful to the caller?
│
├─ YES: Client needs to handle this error
│   │
│   ├─ Is it a "not found" error? → Let it bubble up (no Effect.orDie)
│   ├─ Is it a "conflict/already exists" error? → Let it bubble up
│   ├─ Is it a validation error? → Let it bubble up
│   └─ Is it a business logic error? → Let it bubble up
│
└─ NO: Error is unexpected/system failure
    │
    ├─ Is it a programming error? → Use Effect.orDie
    ├─ Is it an impossible state? → Use Effect.orDie
    └─ Would recovery be meaningless? → Use Effect.orDie
```

### Examples by Usecase Type

| Operation | Error Type | Action | Example |
|-----------|-----------|--------|---------|
| **GET by ID** | NotFoundError | Let bubble up | `getJobById(id)` - caller handles 404 |
| **LIST/SEARCH** | Any error | Effect.orDie | `getAllJobs()` - should never fail |
| **CREATE** | ConflictError | Let bubble up | `createJob(data)` - caller handles 409 |
| **UPDATE** | NotFoundError | Let bubble up | `updateJob(id)` - caller handles 404 |
| **DELETE** | NotFoundError | Let bubble up | `deleteJob(id)` - caller handles 404 |
| **BUSINESS LOGIC** | Domain errors | Let bubble up | `approveJob(id)` - caller handles business rules |

### Code Pattern
```typescript
// ✅ Let error bubble up - caller needs to handle
export const getJobByIdUsecase = (id: string) =>
  Effect.gen(function* () {
    const store = yield* JobsStore
    return yield* store.getById(id) // May throw NotFoundError
  }).pipe(
    Effect.tapError(Effect.logError),
    // NO Effect.orDie - let NotFoundError bubble up
    Effect.withSpan('getJobByIdUsecase')
  )

// ✅ Use Effect.orDie - no meaningful errors expected
export const listJobsUsecase = () =>
  Effect.gen(function* () {
    const store = yield* JobsStore
    return yield* store.getAll()
  }).pipe(
    Effect.tapError(Effect.logError),
    Effect.orDie, // List operations should always succeed
    Effect.withSpan('listJobsUsecase')
  )
```

## 2. Schema.TaggedError vs Data.TaggedError

```
Where is this error used?
│
├─ At HTTP/API boundaries (handlers)?
│   └─ Use Schema.TaggedError → Can be serialized/validated
│
└─ Internal domain logic only?
    └─ Use Data.TaggedError → Simpler, no schema overhead
```

### Usage Guide

| Layer | Error Type | Why | Example |
|-------|----------|-----|---------|
| **Handlers** | Schema.TaggedError | HTTP response serialization | `class JobNotFound extends Schema.TaggedError<JobNotFound>()` |
| **Domain** | Data.TaggedError | Internal error handling | `class JobNotFoundError extends Data.TaggedError('JobNotFoundError')` |
| **Stores** | Data.TaggedError | Internal data errors | `class DatabaseError extends Data.TaggedError('DatabaseError')` |
| **External APIs** | Schema.TaggedError | API response parsing | `class ApiError extends Schema.TaggedError<ApiError>()` |

### Code Pattern
```typescript
// ✅ API boundary - use Schema.TaggedError
export class JobNotFound extends Schema.TaggedError<JobNotFound>()('JobNotFound', {
  jobId: Schema.String,
  message: Schema.String,
}) {}

// ✅ Internal domain - use Data.TaggedError  
export class JobNotFoundError extends Data.TaggedError('JobNotFoundError')<{
  readonly jobId: string
  readonly attemptedAt: Date
}> {}
```

## 3. When to Create a Layer vs Direct Dependency

```
Is this a service/resource that needs initialization?
│
├─ YES: Has setup/teardown or state
│   │
│   ├─ Is it expensive to create? → Create a Layer
│   ├─ Is it shared across handlers? → Create a Layer
│   ├─ Does it need configuration? → Create a Layer
│   └─ Does it manage connections? → Create a Layer
│
└─ NO: Pure functions or simple operations
    │
    ├─ Is it just utility functions? → Direct import
    ├─ Is it a pure transformation? → Direct import
    └─ Is it stateless computation? → Direct import
```

### Examples

| Pattern | When to Use | Example |
|---------|------------|---------|
| **Layer** | Database connections | `RestateClientLive`, `DatabasePoolLive` |
| **Layer** | Configured services | `JobsStore.Default`, `MediaStore.Default` |
| **Layer** | External API clients | `HttpClient` with auth headers |
| **Direct** | Pure utilities | `formatDate()`, `validateEmail()` |
| **Direct** | Simple transforms | `mapJobToResponse()` |

### Code Pattern
```typescript
// ✅ Layer - expensive resource with configuration
export const RestateClientLive = Layer.effect(
  RestateClient,
  Effect.gen(function* () {
    const url = yield* Config.url('RESTATE_URL')
    const client = yield* connectWithRetry(url) // Expensive
    return client
  })
)

// ✅ Direct import - pure utility
export const formatJobName = (job: Job): string => 
  `${job.type} - ${job.id}`

// ✅ Layer - configured service
export class JobsStore extends Effect.Service<JobsStore>()('JobsStore', {
  effect: Effect.gen(function* () {
    const tableName = yield* Config.string('JOBS_TABLE')
    // Service implementation
  })
}) {}
```

## 4. Effect.all Concurrency vs Sequential

```
Do these operations depend on each other?
│
├─ NO: Independent operations
│   │
│   ├─ Are there many operations (>10)? → Use concurrency limit
│   ├─ Are they I/O operations? → Use parallel (default)
│   └─ Are they CPU-intensive? → Use concurrency: 1 or small number
│
└─ YES: Operations need order
    │
    ├─ Does B need result from A? → Sequential (separate yields)
    └─ Must maintain order? → Use { concurrency: 1 }
```

### Patterns

| Scenario | Pattern | Example |
|----------|---------|---------|
| **Independent I/O** | `Effect.all([...])` | Fetch multiple APIs |
| **Many operations** | `Effect.all([...], { concurrency: 10 })` | Process 100 files |
| **Sequential needed** | Separate `yield*` statements | Step-by-step workflow |
| **Order matters** | `Effect.all([...], { concurrency: 1 })` | Ordered updates |
| **CPU intensive** | `Effect.all([...], { concurrency: 2 })` | Heavy computations |

### Code Pattern
```typescript
// ✅ Parallel - independent operations
const [users, posts, comments] = yield* Effect.all([
  fetchUsers(),
  fetchPosts(),
  fetchComments(),
])

// ✅ Concurrency limit - many operations
const results = yield* Effect.all(
  hundredsOfIds.map(id => fetchData(id)),
  { concurrency: 10 } // Process 10 at a time
)

// ✅ Sequential - dependent operations
const user = yield* fetchUser(userId)
const profile = yield* fetchProfile(user.profileId) // Needs user first
const settings = yield* fetchSettings(profile.settingsId) // Needs profile

// ✅ Batching for performance
const results = yield* Effect.all(
  items.map(item => processItem(item)),
  { batching: true } // Enable batching optimizations
)
```

## Quick Reference

### Error Handling
- **Client needs to handle?** → Let bubble up
- **System/impossible error?** → Effect.orDie

### Error Types  
- **API/HTTP boundary?** → Schema.TaggedError
- **Internal only?** → Data.TaggedError

### Dependencies
- **Needs init/config/state?** → Layer
- **Pure functions?** → Direct import

### Concurrency
- **Independent ops?** → Effect.all (parallel)
- **Dependent ops?** → Sequential yields
- **Many ops?** → Add concurrency limit