# Imports and Naming Conventions

## Import Patterns

### CRITICAL: Always Use Relative Paths
- **ALWAYS** use relative paths for internal imports
- **NEVER** use `src/` aliases - this will break the build
- Use package imports for external dependencies

```typescript
// ✅ CORRECT - Relative paths for internal imports
import { JobsStore } from '../../stores/jobs/jobs.store'
import { getJobsUsecase } from './get-jobs.usecase'

// ✅ CORRECT - Package imports for external dependencies
import { Effect, Schema, Data } from 'effect'

// ❌ WRONG - Never use src/ aliases
import { JobsStore } from 'src/stores/jobs/jobs.store'
```

## Naming Conventions

### Files and Directories
- **kebab-case** for file names: `jobs.store.ts`, `get-job-by-id.handler.ts`
- **Pattern suffixes**: `.store.ts`, `.usecase.ts`, `.handler.ts`, `.step.ts`, `.test.ts`
- Test files co-located with implementation

### Classes and Functions
- **PascalCase** for classes: `JobsStore`, `JobNotFoundError`
- **camelCase** for functions: `getJobsUsecase`, `getAllJobs`
- Service suffix for Effect services: `JobsStore`, `MediaStore`

### Variables and Constants
- **camelCase** for variables: `jobsStore`, `tableName`
- **UPPERCASE** for constants (rarely used, prefer Effect Config)

### Schema and Error Naming
- **PascalCase** for schemas: `JobResponse`, `JobsResponse`
- **PascalCase + Error suffix** for errors: `JobNotFoundError`, `WorkflowCreationError`

## File Organization Patterns

```
src/
├── domain/          # Schemas and domain errors
│   ├── jobs/       # Feature-based organization
│   │   ├── jobs.schema.ts
│   │   └── jobs.errors.ts
├── stores/         # Data access layer
├── usecases/       # Business logic
├── handlers/       # HTTP handlers
├── steps/          # Workflow steps
└── platform/       # External integrations
```