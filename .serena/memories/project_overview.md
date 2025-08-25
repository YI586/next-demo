# Project Overview

This is a **simplified Excalidraw MVP** - a minimal diagramming application for
creating, editing, saving, and loading diagrams composed of sticky notes
connected by lines. The architecture emphasizes simplicity and extensibility
through an abstract storage layer.

## Technology Stack

- **Next.js 14+** with App Router
- **TypeScript** with strict mode
- **shadcn/ui** for UI components
- **Tailwind CSS** for styling
- **Zustand** with Immer for state management
- **Canvas API** for diagram rendering
- **pnpm** for package management

## Core Features

- Create and edit diagrams with sticky notes and connectors
- Pan and zoom infinite canvas
- Save/load diagrams through pluggable storage adapters
- Undo/redo functionality
- Multi-element selection and manipulation

## Architecture

The project follows a modular architecture with:

- Abstract storage layer for different backends (file, cloud, database)
- Zustand stores for state management
- Canvas-based rendering engine
- Component-based UI with shadcn/ui
