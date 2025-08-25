# Code Style and Conventions

## TypeScript Configuration

- **Strict mode enabled** - comprehensive type checking
- **No implicit any** - all types must be explicit
- **Path aliases** - use `@/` for src directory imports
- **Prefer nullish coalescing** (`??`) and optional chaining (`?.`)

## React/Next.js Patterns

- **Functional components** with hooks
- **Pure components** - avoid side effects in render
- **Custom hooks** for reusable logic
- **App Router** - use Next.js 14+ patterns

## State Management

- **Zustand stores** for global state
- **Immer** for immutable updates
- **Separate UI state from domain state**
- **Undo/redo via state snapshots**

## Naming Conventions

- **camelCase** for variables and functions
- **PascalCase** for components and types
- **kebab-case** for file names
- **UPPER_CASE** for constants
- **Descriptive names** - prefer clarity over brevity

## File Organization

- **Types** in src/types/ directory
- **Components** grouped by feature
- **Hooks** in src/hooks/
- **Utilities** in src/lib/
- **Stores** in src/stores/

## Import Order

1. React and Next.js imports
2. Third-party libraries
3. Internal imports (using @ alias)
4. Relative imports

## Code Quality

- **ESLint** with Next.js and TypeScript rules
- **Prettier** for consistent formatting
- **Husky** for git hooks
- **Conventional commits** format
- **Type-first development** - define types before implementation
