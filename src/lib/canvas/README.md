# Canvas Viewport Management System

This module provides comprehensive viewport management for the infinite canvas,
including coordinate transformations, zoom/pan operations, and performance
optimizations.

## Core Components

### ViewportManager Class

The main class that handles all viewport operations:

```typescript
import { ViewportManager, createViewportManager } from '@/lib/canvas/viewport';

const manager = createViewportManager(viewport);

// Coordinate transformations
const worldPoint = manager.screenToWorld({ x: 100, y: 200 });
const screenPoint = manager.worldToScreen({ x: 50, y: 75 });

// Zoom operations
manager.zoomIn(1.2, { x: 400, y: 300 });
manager.zoomOut(1.2);
manager.zoomToFitElements(elements, 50);

// Pan operations
manager.panBy({ x: 50, y: -30 });
manager.panToWorldPoint({ x: 100, y: 200 });
```

### React Hooks

#### useViewport()

Full viewport management hook with all operations:

```typescript
import { useViewport } from '@/hooks/use-viewport';

function CanvasComponent() {
  const {
    viewport,
    manager,
    screenToWorld,
    worldToScreen,
    zoomIn,
    zoomOut,
    panBy,
    panTo,
    isPointVisible,
    getVisibleElements,
  } = useViewport();

  // Use the functions...
}
```

#### useViewportTransforms()

Lightweight hook for coordinate transformations only:

```typescript
import { useViewportTransforms } from '@/hooks/use-viewport';

function ElementComponent() {
  const { screenToWorld, worldToScreen, viewport } = useViewportTransforms();

  // Transform coordinates...
}
```

## Key Features

### Coordinate System Management

- **Screen Coordinates**: Pixel coordinates relative to the canvas element
- **World Coordinates**: Logical coordinates in the infinite canvas space
- **Bidirectional Transformations**: Convert between screen and world
  coordinates
- **High Precision**: Accurate transformations for all zoom levels

### Zoom Operations

- **Zoom In/Out**: With configurable zoom factors
- **Zoom At Point**: Maintain specific screen point during zoom
- **Zoom To Fit**: Automatically fit elements within viewport
- **Zoom Limits**: Configurable min/max zoom constraints
- **Center Preservation**: Keep zoom center point stable

### Pan Operations

- **Pan By Delta**: Move viewport by pixel offset
- **Pan To Position**: Move viewport to specific offset
- **Pan To World Point**: Center viewport on world coordinate
- **Constraint Support**: Optional pan distance limitations

### Visibility Management

- **Point Visibility**: Check if world point is in viewport
- **Rectangle Visibility**: Check if world rectangle intersects viewport
- **Element Filtering**: Get only visible elements for performance
- **Viewport Bounds**: Calculate and track visible world area

### Performance Optimizations

- **Efficient Calculations**: Optimized coordinate transformations
- **Viewport Culling**: Only process visible elements
- **Animation Support**: Smooth transitions with easing
- **Memory Management**: Minimal object creation in hot paths

## Integration with Diagram Store

The viewport system is fully integrated with the Zustand diagram store:

```typescript
// Store actions automatically use ViewportManager
const { zoomIn, zoomOut, panBy, zoomToFit } = useDiagramStore();

// Direct manager access when needed
const { getViewportManager } = useDiagramStore();
const manager = getViewportManager();
```

## Animation Support

Smooth viewport transitions with configurable easing:

```typescript
manager.animateToViewport(
  { zoom: 2.0, offset: { x: 100, y: 50 } },
  { duration: 300, easing: 'ease-out' },
  (viewport) => console.log('Update:', viewport),
  () => console.log('Complete!')
);
```

## Configuration Options

### Viewport Constraints

```typescript
const constraints: ViewportConstraints = {
  maxPanDistance: 5000, // Limit pan distance from origin
  minVisibleArea: { width: 100, height: 100 }, // Minimum visible area
  snapToGrid: true, // Snap zoom to grid
  gridSize: 10, // Grid size for snapping
};

const manager = createViewportManager(viewport, constraints);
```

### Default Settings

```typescript
const DEFAULT_VIEWPORT = {
  zoom: 1.0,
  minZoom: 0.1,
  maxZoom: 5.0,
  offset: { x: 0, y: 0 },
  size: { width: 800, height: 600 },
  visibleArea: { x: 0, y: 0, width: 800, height: 600 },
};
```

## Testing

Run the test suite to verify functionality:

```typescript
import { runViewportTests } from '@/lib/canvas/viewport.test';

// Run in development console
runViewportTests();
```

## Architecture Benefits

1. **Separation of Concerns**: Viewport logic separated from UI components
2. **Type Safety**: Full TypeScript support with comprehensive interfaces
3. **Performance**: Optimized for smooth 60fps interactions
4. **Extensibility**: Easy to add new viewport features
5. **Testability**: Pure functions and isolated logic
6. **Integration**: Seamless store and React hook integration
