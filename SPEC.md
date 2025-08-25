# Simplified Excalidraw MVP - Technical Specification

## Overview

A minimal diagramming application that allows users to create, edit, save, and load diagrams composed of sticky notes connected by lines. The system emphasizes simplicity and extensibility through an abstract storage layer.

## Core Features

### 1. Canvas System
- **Infinite canvas** with pan and zoom capabilities
- **Grid or dot background** for visual guidance
- **Viewport management** to handle coordinate transformations
- **Mouse/touch interaction** for element manipulation

### 2. Sticky Notes
- **Basic text notes** with editable content
- **Draggable positioning** on the canvas
- **Resizable dimensions** (width/height)
- **Color customization** (background color selection)
- **Text formatting** (basic font size, alignment)
- **Selection states** (selected, hover, normal)

### 3. Connectors
- **Line connections** between sticky notes
- **Connection points** on note edges (top, right, bottom, left)
- **Visual indicators** for connection points when dragging
- **Arrow heads** to show direction
- **Automatic routing** around obstacles (simple straight lines for MVP)

### 4. Canvas Operations
- **Create elements** (sticky notes)
- **Select/multi-select** elements
- **Move elements** via drag and drop
- **Delete selected** elements
- **Connect elements** via drag from connection points
- **Undo/redo** basic operations

### 5. File Operations
- **Save diagram** to file (JSON format)
- **Load diagram** from file
- **New diagram** (clear canvas)

## Technical Architecture

### Core Components

#### 1. Canvas Engine
```typescript
interface CanvasEngine {
  render(): void;
  pan(deltaX: number, deltaY: number): void;
  zoom(factor: number, centerX: number, centerY: number): void;
  screenToCanvas(screenX: number, screenY: number): Point;
  canvasToScreen(canvasX: number, canvasY: number): Point;
}
```

#### 2. Element System
```typescript
interface Element {
  id: string;
  type: 'sticky-note' | 'connector';
  position: Point;
  selected: boolean;
}

interface StickyNote extends Element {
  type: 'sticky-note';
  width: number;
  height: number;
  text: string;
  backgroundColor: string;
  fontSize: number;
}

interface Connector extends Element {
  type: 'connector';
  startElementId: string;
  endElementId: string;
  startPoint: ConnectionPoint;
  endPoint: ConnectionPoint;
}

type ConnectionPoint = 'top' | 'right' | 'bottom' | 'left';
```

#### 3. Diagram Model
```typescript
interface Diagram {
  id: string;
  name: string;
  elements: Element[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

#### 4. Abstract Storage Interface
```typescript
interface StorageAdapter {
  save(diagram: Diagram): Promise<void>;
  load(id: string): Promise<Diagram>;
  list(): Promise<DiagramMetadata[]>;
  delete(id: string): Promise<void>;
}

interface DiagramMetadata {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 5. File Storage Implementation
```typescript
class FileStorageAdapter implements StorageAdapter {
  async save(diagram: Diagram): Promise<void> {
    // Save to JSON file via browser download
  }
  
  async load(id: string): Promise<Diagram> {
    // Load from JSON file via file input
  }
  
  // For MVP, list/delete may use localStorage for metadata
}
```

## User Interface Requirements

### Canvas Area
- **Full-screen canvas** taking up majority of viewport
- **Toolbar** with essential tools (select, create note, delete)
- **Color picker** for sticky note background colors
- **Zoom controls** (zoom in, zoom out, fit to screen)

### File Operations UI
- **Save button** - triggers file download
- **Load button** - opens file picker
- **New button** - clears canvas with confirmation

### Interactive Behaviors
- **Click empty canvas** - deselect all
- **Click element** - select single element
- **Ctrl+click element** - multi-select
- **Drag element** - move selected elements
- **Double-click sticky note** - enter text editing mode
- **Drag from connection point** - create connector

## Data Persistence

### File Format (JSON)
```json
{
  "id": "diagram-uuid",
  "name": "My Diagram",
  "version": "1.0",
  "elements": [
    {
      "id": "note-1",
      "type": "sticky-note",
      "position": { "x": 100, "y": 100 },
      "width": 200,
      "height": 150,
      "text": "Sample note",
      "backgroundColor": "#ffeb3b",
      "fontSize": 14,
      "selected": false
    },
    {
      "id": "connector-1",
      "type": "connector",
      "position": { "x": 0, "y": 0 },
      "startElementId": "note-1",
      "endElementId": "note-2",
      "startPoint": "right",
      "endPoint": "left",
      "selected": false
    }
  ],
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1.0
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

## Technology Stack

### Framework & Core
- **Next.js 14+** with App Router for React framework
- **TypeScript** for type safety and better developer experience
- **shadcn/ui** for consistent UI components and design system
- **Tailwind CSS** for utility-first styling (comes with shadcn/ui)
- **Canvas API** for high-performance diagram rendering

### Package Management & Build Tools
- **pnpm** for fast, efficient package management
- **Turbo** (optional) for build optimization and caching

### State Management
- **Zustand** with TypeScript for lightweight state management
- **Immer** for immutable state updates

### Development Tooling
- **ESLint** with Next.js and TypeScript configurations
- **Prettier** for code formatting
- **TypeScript strict mode** with comprehensive type checking
- **Husky** for Git hooks management
- **lint-staged** for running linters on staged files
- **commitlint** for conventional commit messages

### Code Quality & Testing
- **@typescript-eslint/parser** and rules
- **eslint-plugin-react-hooks** for React best practices
- **@next/eslint-config-next** for Next.js specific rules
- **npm-check-updates** for dependency management

### Utilities
- **uuid** for generating unique element IDs
- **lodash-es** for utility functions (tree-shakeable)
- **clsx** and **tailwind-merge** for conditional classes (comes with shadcn/ui)

## Project Setup & Configuration

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "deps:check": "ncu",
    "deps:update": "ncu -u",
    "prepare": "husky install"
  }
}
```

### ESLint Configuration (.eslintrc.json)
```json
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    "react-hooks/exhaustive-deps": "error"
  }
}
```

### TypeScript Configuration (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"],
      "@/stores/*": ["./src/stores/*"]
    },
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Prettier Configuration (.prettierrc)
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "tabWidth": 2,
  "useTabs": false,
  "printWidth": 80,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

### Husky Pre-commit Hooks (.husky/pre-commit)
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint-staged
pnpm type-check
```

### Lint-staged Configuration (.lintstagedrc.json)
```json
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md,css}": [
    "prettier --write"
  ]
}
```

### Commitlint Configuration (.commitlintrc.json)
```json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "type-enum": [2, "always", [
      "feat", "fix", "docs", "style", "refactor", 
      "perf", "test", "chore", "ci", "build"
    ]]
  }
}
```

### Development Dependencies
```json
{
  "devDependencies": {
    "@commitlint/cli": "^18.0.0",
    "@commitlint/config-conventional": "^18.0.0",
    "@types/lodash-es": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@types/uuid": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.0.0",
    "husky": "^8.0.0",
    "lint-staged": "^15.0.0",
    "npm-check-updates": "^16.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

## Project Structure

```
src/
├── app/                          # Next.js 14 App Router
│   ├── globals.css              # Global styles with Tailwind
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Home page with canvas
├── components/                   # React components
│   ├── ui/                      # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── canvas/
│   │   ├── canvas-engine.tsx    # Main canvas component
│   │   ├── sticky-note.tsx      # Sticky note component
│   │   └── connector.tsx        # Connector component
│   ├── toolbar/
│   │   ├── main-toolbar.tsx     # Primary toolbar
│   │   └── color-picker.tsx     # Color selection
│   └── dialogs/
│       ├── save-dialog.tsx      # Save functionality
│       └── load-dialog.tsx      # Load functionality
├── lib/                         # Utilities and configurations
│   ├── utils.ts                 # shadcn/ui utils
│   ├── canvas-utils.ts          # Canvas-specific utilities
│   └── storage/
│       ├── storage-adapter.ts   # Abstract storage interface
│       └── file-storage.ts      # File storage implementation
├── stores/                      # Zustand stores
│   ├── diagram-store.ts         # Main diagram state
│   └── ui-store.ts             # UI state (selections, etc.)
├── types/                       # TypeScript type definitions
│   ├── diagram.ts              # Core diagram types
│   ├── elements.ts             # Element type definitions
│   └── storage.ts              # Storage-related types
└── hooks/                       # Custom React hooks
    ├── use-canvas.ts           # Canvas interaction logic
    └── use-keyboard.ts         # Keyboard shortcuts
```

## Installation & Setup Commands

### Initial Project Setup
```bash
# Create Next.js project with TypeScript
pnpm create next-app@latest excalidraw-mvp --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd excalidraw-mvp

# Install shadcn/ui
pnpm dlx shadcn-ui@latest init

# Install core dependencies
pnpm add zustand immer uuid lodash-es clsx tailwind-merge

# Install development dependencies
pnpm add -D @commitlint/cli @commitlint/config-conventional @types/lodash-es @types/uuid @typescript-eslint/eslint-plugin @typescript-eslint/parser husky lint-staged npm-check-updates

# Initialize shadcn/ui components (install as needed)
pnpm dlx shadcn-ui@latest add button dialog input label select separator

# Setup Git hooks
pnpm prepare
```

### Development Workflow Commands
```bash
# Start development server
pnpm dev

# Type checking
pnpm type-check

# Linting
pnpm lint
pnpm lint:fix

# Code formatting
pnpm format
pnpm format:check

# Dependency management
pnpm deps:check     # Check for outdated packages
pnpm deps:update    # Update package.json with latest versions

# Pre-commit validation (runs automatically)
pnpm lint-staged
```

## Implementation Phases

### Phase 1: Project Setup & Foundation
1. **Initialize Next.js project** with all modern tooling
2. **Configure shadcn/ui** and basic component structure
3. **Set up state management** with Zustand stores
4. **Implement basic canvas** rendering and viewport management
5. **Add development workflow** (linting, pre-commit hooks, type checking)

### Phase 2: Core Canvas Functionality  
1. **Canvas engine implementation** with pan/zoom
2. **Sticky note creation** and basic text editing
3. **Element selection system** with multi-select support
4. **Basic interactions** (drag, resize, delete)
5. **Toolbar integration** using shadcn/ui components

### Phase 3: Connections & Advanced Interactions
1. **Connection points** on sticky notes
2. **Connector creation** via drag and drop
3. **Visual connection feedback** during creation
4. **Undo/redo system** for all operations
5. **Keyboard shortcuts** for power users

### Phase 4: Persistence & File Operations
1. **Abstract storage interface** implementation
2. **File-based storage adapter** with JSON format
3. **Save/Load dialogs** using shadcn/ui
4. **Error handling** and user feedback
5. **Diagram validation** and migration support

## Future Extensibility

The abstract storage interface enables future implementations:
- **Database Storage Adapter** - for cloud persistence
- **Local Storage Adapter** - for browser-based persistence
- **API Storage Adapter** - for server-based storage with collaboration features

## Performance Considerations

- **Virtualization** - Only render elements in viewport (for large diagrams)
- **Event delegation** - Use canvas-level event handling rather than per-element listeners
- **Throttled updates** - Debounce rapid position updates during dragging
- **Efficient re-renders** - Only re-render changed elements

## Accessibility

- **Keyboard navigation** - Support for tab navigation and arrow key movement
- **Screen reader support** - ARIA labels for canvas elements
- **High contrast mode** - Respect system accessibility preferences
- **Focus indicators** - Clear visual focus states for all interactive elements