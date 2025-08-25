# Diagram Store

The diagram store is a comprehensive Zustand store with Immer for managing
diagram state in the Excalidraw MVP application.

## Features

- **Diagram Management**: Create, load, and manage diagrams
- **Element Operations**: Add, update, delete, move, and duplicate elements
- **Viewport Management**: Handle zoom, pan, and viewport transformations
- **Undo/Redo**: Full history management with snapshots
- **Loading States**: Manage loading states and error handling
- **Dirty State Tracking**: Track unsaved changes
- **Recent Diagrams**: Manage recently opened diagrams

## Basic Usage

```typescript
import { useDiagramStore, diagramSelectors } from '@/stores/diagram-store';
import { ElementType } from '@/types';

function DiagramComponent() {
  const {
    createNewDiagram,
    addElement,
    updateElement,
    undo,
    redo,
    setViewport,
    currentDiagram,
    isDirty,
  } = useDiagramStore();

  // Create a new diagram
  const handleNewDiagram = () => {
    createNewDiagram('My New Diagram', 'A description');
  };

  // Add a sticky note
  const handleAddStickyNote = () => {
    const stickyNote = {
      type: ElementType.STICKY_NOTE,
      position: { x: 100, y: 100 },
      size: { width: 200, height: 150 },
      content: {
        text: 'New Note',
        fontSize: 14,
        fontFamily: 'Arial',
        textAlign: 'left' as const,
        verticalAlign: 'top' as const,
      },
      style: {
        backgroundColor: '#ffff88',
        textColor: '#000000',
      },
      connectionPoints: [],
    };

    addElement(stickyNote);
  };

  // Use selectors for computed values
  const elements = useDiagramStore(diagramSelectors.getElements);
  const canUndo = useDiagramStore(diagramSelectors.canUndo);
  const canRedo = useDiagramStore(diagramSelectors.canRedo);

  return (
    <div>
      <button onClick={handleNewDiagram}>New Diagram</button>
      <button onClick={handleAddStickyNote}>Add Note</button>
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>

      {isDirty && <span>• Unsaved changes</span>}

      <div>
        {currentDiagram?.name} ({elements.length} elements)
      </div>
    </div>
  );
}
```

## Selectors

The store provides several selectors for efficiently accessing computed state:

```typescript
// Use individual selectors
const elements = useDiagramStore(diagramSelectors.getElements);
const viewport = useDiagramStore(diagramSelectors.getViewport);
const canUndo = useDiagramStore(diagramSelectors.canUndo);
const isLoading = useDiagramStore(diagramSelectors.isLoading);

// Get specific element by ID
const element = useDiagramStore((state) =>
  diagramSelectors.getElementById(state, 'element-id')
);

// Get elements by type
const stickyNotes = useDiagramStore((state) =>
  diagramSelectors.getElementsByType(state, ElementType.STICKY_NOTE)
);
```

## Batch Operations

For performing multiple operations as a single undo/redo unit:

```typescript
const { performBatch, addElement, moveElements } = useDiagramStore();

performBatch(() => {
  const id1 = addElement(element1);
  const id2 = addElement(element2);
  moveElements([id1, id2], { x: 50, y: 50 });
}, 'Add and move elements');
```

## Error Handling

```typescript
const { setError, clearError, error } = useDiagramStore();

try {
  // Some operation that might fail
  await loadDiagram(data);
} catch (err) {
  setError({
    code: 'LOAD_ERROR',
    message: 'Failed to load diagram',
    details: { originalError: err },
  });
}

// Clear errors
if (error) {
  clearError();
}
```

## Viewport Operations

```typescript
const { zoomIn, zoomOut, zoomToFit, panTo, setViewport, resetViewport } =
  useDiagramStore();

// Zoom operations
zoomIn(); // 120% zoom
zoomOut(); // 83.3% zoom
zoomToFit(); // Fit all elements in view

// Pan to specific position
panTo({ x: 100, y: 200 });

// Custom viewport changes
setViewport({
  zoom: 1.5,
  offset: { x: -100, y: -50 },
});

// Reset to default viewport
resetViewport();
```

## TypeScript Integration

The store is fully typed with TypeScript and works seamlessly with the type
system:

```typescript
// All operations are type-safe
const elementId = addElement({
  type: ElementType.STICKY_NOTE,
  // TypeScript will enforce the correct shape for StickyNote
  position: { x: 0, y: 0 },
  size: { width: 200, height: 150 },
  // ... other required properties
});

// Updates are also type-safe
updateElement(elementId, {
  position: { x: 100, y: 100 }, // Valid
  // invalidProperty: 'value' // TypeScript error!
});
```

## Architecture Notes

- Uses Zustand with Immer middleware for immutable state updates
- Follows the single store pattern with clear separation of concerns
- Implements optimistic updates for better user experience
- Provides both imperative actions and reactive selectors
- Maintains referential stability for React optimization
