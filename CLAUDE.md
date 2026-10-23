# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- Import UI components from `@crowfoot/ui` when available
- Import icons from `@crowfoot/ui`

### File Organization

- Follow existing import patterns and tsconfig paths
- Use consts instead of functions: `const toggle = () => {}`

### CSS

- Use CSS Variables from `@crowfoot/ui` package
- Generate CSS type definitions with `pnpm gen:css` (per package — `tcm src`, not a root script)
- Use CSS variables according to their intended purpose. Spacing variables should be used exclusively for margins and padding, while height and width specifications should use appropriate units (rem, px, etc.)

### Testing

- Follow principles in @docs/test-principles.md

## Pull Requests

When creating pull requests, refer to @.github/pull_request_template.md for the required information and format.
