# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a simplified Excalidraw MVP - a minimal diagramming application for creating, editing, saving, and loading diagrams composed of sticky notes connected by lines. The architecture emphasizes simplicity and extensibility through an abstract storage layer.

## Technology Stack

- **Next.js 14+** with App Router
- **TypeScript** with strict mode
- **shadcn/ui** for UI components
- **Tailwind CSS** for styling
- **Zustand** with Immer for state management
- **Canvas API** for diagram rendering
- **pnpm** for package management

## Project Setup Commands

```bash
# Initial setup (if not already done)
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Install dependencies
pnpm install

# Install shadcn/ui
pnpm dlx shadcn-ui@latest init

# Add required shadcn/ui components
pnpm dlx shadcn-ui@latest add button dialog input label select separator

# Install core dependencies
pnpm add zustand immer uuid lodash-es clsx tailwind-merge

# Install dev dependencies
pnpm add -D @commitlint/cli @commitlint/config-conventional @types/lodash-es @types/uuid @typescript-eslint/eslint-plugin @typescript-eslint/parser husky lint-staged npm-check-updates

# Setup Git hooks
pnpm prepare
```

## Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Run production build
pnpm start

# Type checking
pnpm type-check

# Linting
pnpm lint
pnpm lint:fix

# Code formatting
pnpm format
pnpm format:check

# Check for outdated packages
pnpm deps:check

# Update dependencies
pnpm deps:update
```

## Architecture & Core Components

### 1. Canvas Engine (`src/components/canvas/canvas-engine.tsx`)

- Manages rendering, pan/zoom, and coordinate transformations
- Handles mouse/touch interactions for element manipulation
- Implements viewport management for infinite canvas

### 2. Element System

- **StickyNote**: Draggable text notes with resizable dimensions and color customization
- **Connector**: Lines connecting sticky notes with arrow heads and connection points

### 3. State Management (`src/stores/`)

- **diagram-store.ts**: Main diagram state (elements, viewport)
- **ui-store.ts**: UI state (selections, tool modes)
- Uses Zustand with Immer for immutable updates

### 4. Storage Layer (`src/lib/storage/`)

- **Abstract StorageAdapter interface** for extensibility
- **FileStorageAdapter** for JSON file save/load via browser

### 5. UI Components

- Built with shadcn/ui components
- Toolbar for tools and operations
- Dialogs for file operations

## Key Implementation Details

### Canvas Interactions

- **Click empty canvas**: Deselect all elements
- **Click element**: Select single element
- **Ctrl+click**: Multi-select
- **Drag element**: Move selected elements
- **Double-click sticky note**: Enter text editing mode
- **Drag from connection point**: Create connector

### Data Format

Diagrams are saved as JSON with the following structure:

- Elements array (sticky notes and connectors)
- Viewport state (x, y, zoom)
- Metadata (id, name, timestamps)

### Type Safety

- TypeScript strict mode enabled
- Comprehensive type definitions in `src/types/`
- No implicit any, unchecked indexed access disabled

## Code Quality Standards

### Before Committing

1. Run type checking: `pnpm type-check`
2. Run linting: `pnpm lint:fix`
3. Run formatting: `pnpm format`
4. Ensure all tests pass (when implemented)

## Git Workflow for Agents

### Task Completion Requirements

When completing any task from the backlog, agents MUST:

1. **Create a feature branch** for the task:

   ```bash
   git checkout -b task-{number}-{brief-description}
   # Example: git checkout -b task-1-setup-nextjs
   ```

2. **Use Conventional Commits** notation for ALL commits:

   ```bash
   # Format: <type>(<scope>): <subject>

   # Types:
   # - feat: New feature
   # - fix: Bug fix
   # - docs: Documentation changes
   # - style: Code style changes (formatting, etc)
   # - refactor: Code refactoring
   # - test: Adding or updating tests
   # - chore: Maintenance tasks
   # - perf: Performance improvements

   # Examples:
   git commit -m "feat(canvas): task-{number} implement sticky note element"
   git commit -m "fix(storage): task-{number} handle corrupted file gracefully"
   git commit -m "test(ui): task-{number} add toolbar component tests"
   git commit -m "chore(deps): task-{number} update zustand to latest version"
   ```

3. **Push changes to remote** after task completion:

   ```bash
   # Push the feature branch to remote
   git push -u origin main
   ```

4. **Create a Pull Request** with:
   - Clear title following the task name
   - Description linking to the backlog task
   - List of changes made
   - Testing notes for QA validation

### Commit Guidelines

- Make atomic commits (one logical change per commit)
- Write clear, descriptive commit messages
- Reference task numbers in commit messages when applicable
- Never commit directly to main branch
- Always ensure code passes quality checks before committing

### Code Conventions

- Use TypeScript strict mode features
- Prefer nullish coalescing (`??`) and optional chaining (`?.`)
- Follow React hooks best practices
- Use path aliases (`@/components/*`, `@/lib/*`, etc.)
- Keep components pure and side-effect free

### State Management Patterns

- Use Zustand stores for global state
- Use Immer for immutable updates
- Keep UI state separate from domain state
- Implement undo/redo via state snapshots

## Performance Considerations

- Only render elements in viewport (virtualization for large diagrams)
- Use canvas-level event delegation instead of per-element listeners
- Debounce rapid position updates during dragging
- Minimize re-renders by updating only changed elements

## Accessibility Requirements

- Support keyboard navigation (Tab, Arrow keys)
- Provide ARIA labels for canvas elements
- Respect system accessibility preferences
- Include clear focus indicators for all interactive elements

## Common Tasks

### Adding a New Element Type

1. Define TypeScript interface in `src/types/elements.ts`
2. Create component in `src/components/canvas/`
3. Update diagram store to handle new element
4. Add toolbar button for creation
5. Update storage adapter for serialization

### Implementing a New Storage Adapter

1. Implement the `StorageAdapter` interface
2. Add adapter in `src/lib/storage/`
3. Update storage configuration to use new adapter
4. Test save/load operations thoroughly

### Adding Keyboard Shortcuts

1. Use the `use-keyboard.ts` hook
2. Define shortcuts in a central configuration
3. Ensure shortcuts don't conflict with browser defaults
4. Document shortcuts in UI (help dialog)

## Testing Strategy

When implementing tests:

- Unit test state management logic
- Integration test canvas interactions
- E2E test critical user workflows
- Test file save/load operations
- Verify accessibility compliance

## Future Extensibility Points

The abstract storage interface enables:

- Database storage for cloud persistence
- Local Storage for browser persistence
- API storage for server-based features
- Real-time collaboration capabilities
