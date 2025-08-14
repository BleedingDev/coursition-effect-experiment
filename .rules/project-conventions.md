# Project Conventions

## Rules for 'Extra' Files
- **NEVER** create .md files for summaries, setup guides, etc., unless the user explicitly requests them
- **NEVER** create README files or documentation files proactively
- Do not make a mess in the directory with temporary or unnecessary files

## Testing
- Write tests following Effect best practices documented in `.rules/effect-testing-patterns.mdc`
- Use `@effect/vitest` for all Effect-based tests
- Follow the existing testing patterns with proper error handling using tagged errors
- Test files should be co-located with implementation (`*.test.ts`)

## Git Conventions
- Only commit when explicitly asked by the user
- Never push to remote unless explicitly requested
- **ALWAYS** use Conventional Commits format:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `chore:` for maintenance tasks
  - `refactor:` for code refactoring
  - `test:` for test changes
  - `docs:` for documentation
- Follow existing commit message patterns in the repository

## Code Maintenance
- **ALWAYS** check for existing methods, utils, or services before creating new ones
- Reuse existing utilities and patterns documented in the codebase
- Prefer editing existing files over creating new ones
- Don't leave commented-out code unless specifically needed
- Maintain consistent formatting with Biome

## File Organization
- Follow existing directory structure patterns
- See `.rules/imports-and-conventions.md` for file naming and suffix patterns
