# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

- pnpm dev - Start dev servers
- pnpm --filter crowfoot dev - Start dev server for the CLI/viewer specifically
- pnpm build - Build all packages
- pnpm lint - Run linting and formatting
- pnpm test - Run tests
- pnpm fmt - Run format code

### Package-specific Commands

```bash
# Run the CLI/viewer dev server
pnpm --filter crowfoot dev

# Format code
pnpm --filter @liam-hq/erd-core fmt

# Test
pnpm --filter @liam-hq/erd-core test
```

## Architecture

### Monorepo Structure

#### Public Packages
- **frontend/packages/cli** - Command-line tool (`crowfoot`)
- **frontend/packages/erd-core** - Core ERD visualization (`@liam-hq/erd-core`)
- **frontend/packages/schema** - Database schema parser (`@liam-hq/schema`)
- **frontend/packages/ui** - UI component library (`@liam-hq/ui`)

#### Internal Packages
- **frontend/internal-packages/configs** - Shared biome/tsconfig/eslint presets (`@liam-hq/configs`)
- **frontend/internal-packages/neverthrow** - Result-type helpers (`@liam-hq/neverthrow`)

### Key Technologies

- **Frontend**: React 19, TypeScript
- **Styling**: CSS Modules with typed definitions
- **Visualization**: @xyflow/react (React Flow)
- **Validation**: Valibot for runtime type validation
- **Build**: Turborepo, pnpm workspaces, Vite/Rollup (static SPA — no framework at the fork's work surface)

## Development Guidelines

### Core Principle: **Less is more**

Keep every implementation as small and obvious as possible.

- **Let the code speak** – If you need a multi-paragraph comment, refactor until intent is obvious
- **Delete fearlessly, Git remembers** – Cut dead code, stale logic, and verbose history

### TypeScript Standards

- Use runtime type validation with `valibot` for external data validation
- Use early returns for readability

### Code Editing

- Write simple, direct code without backward compatibility concerns - update all call sites together

```typescript
// ❌ Bad: Optional parameter leads to conditional logic
function saveUser(data: UserData, userId?: string) {
  const id = userId || generateId(); // Unnecessary fallback logic
  if (!userId) console.warn("Using generated ID"); // Extra handling
  return db.save(id, data);
}

// ✅ Good: Required parameter, update all callers
function saveUser(data: UserData, userId: string) {
  return db.save(userId, data); // Simple and clear
}
```

### Component Patterns

- Use named exports only (no default exports)
- Event handlers should be prefixed with "handle" (e.g., `handleClick`)
- Use CSS Modules for all styling
- Import UI components from `@liam-hq/ui` when available
- Import icons from `@liam-hq/ui`

### File Organization

- Don't code directly in `page.tsx` - create separate page components
- Follow existing import patterns and tsconfig paths
- Use consts instead of functions: `const toggle = () => {}`

### Data Fetching

- Server Components for server-side data fetching
- Client-side fetching only when necessary
- Align data fetching responsibilities with component roles
- Use Server Actions for all data mutations (create, update, delete operations)

### CSS

- Use CSS Variables from `@liam-hq/ui` package
- Generate CSS type definitions with `pnpm gen:css`
- Use CSS variables according to their intended purpose. Spacing variables should be used exclusively for margins and padding, while height and width specifications should use appropriate units (rem, px, etc.)

### Testing

- Follow principles in @docs/test-principles.md

## Pull Requests

When creating pull requests, refer to @.github/pull_request_template.md for the required information and format.
