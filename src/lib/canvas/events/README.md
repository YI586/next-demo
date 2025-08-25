# Canvas Event Handling System

The canvas event handling system provides comprehensive mouse, touch, and keyboard interaction support for the diagram canvas. It includes coordinate transformation, hit testing, gesture recognition, and efficient event delegation.

## Architecture Overview

The event system consists of several interconnected components:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   DOM Events    │───▶│  EventDelegator  │───▶│  EventProcessor │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ GestureRecognizer│◀───│ CanvasEventManager│───▶│    HitTester    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   UI Store       │
                       │   Integration    │
                       └──────────────────┘
```

## Core Components

### 1. CanvasEventManager

The main orchestrator that coordinates all event handling components.

```typescript
import { CanvasEventManager, EventManagerConfig } from '@/lib/canvas/events';

const config: EventManagerConfig = {
  canvas: canvasElement,
  gestures: true,
  keyboard: true,
  debug: false,
};

const callbacks = {
  onElementSelect: (elementIds) => console.log('Selected:', elementIds),
  onElementHover: (elementId) => console.log('Hovered:', elementId),
  // ... other callbacks
};

const eventManager = new CanvasEventManager(config, callbacks);
```

### 2. EventProcessor

Normalizes DOM events into canvas-specific events with coordinate transformations.

```typescript
import { EventProcessor } from '@/lib/canvas/events';

const processor = new EventProcessor({
  canvas: canvasElement,
  viewportManager: viewportManager,
  supportTouch: true,
  supportPointer: true,
});

// Process mouse event
const canvasEvent = processor.processMouseEvent(mouseEvent, 'pointer-down');
```

### 3. HitTester

Determines which elements are under cursor/touch points with high precision.

```typescript
import { HitTester } from '@/lib/canvas/events';

const hitTester = new HitTester(viewportManager, {
  tolerance: 3,
  includeInvisible: false,
  includeLocked: false,
});

// Perform hit test
const result = hitTester.hitTestAtScreen(screenPoint, elements);
if (result.element) {
  console.log('Hit element:', result.element.id);
}
```

### 4. GestureRecognizer

Recognizes multi-touch gestures like pan, pinch, and rotate.

```typescript
import { GestureRecognizer } from '@/lib/canvas/events';

const gestureRecognizer = new GestureRecognizer({
  panThreshold: 10,
  pinchThreshold: 0.1,
  rotationThreshold: Math.PI / 12,
});

// Process touch events
const gestures = gestureRecognizer.processTouch(touchEvents);
for (const gesture of gestures) {
  console.log('Gesture:', gesture.type, gesture.state);
}
```

### 5. EventDelegator

Manages event listeners and provides performance optimizations.

```typescript
import { EventDelegator } from '@/lib/canvas/events';

const delegator = new EventDelegator(canvasElement, {
  useEventDelegation: true,
  throttleMove: 16, // 60fps
  debounceResize: 100,
});

// Register handlers
delegator.registerHandlers({
  'pointer-down': (event, context) => {
    console.log('Pointer down at:', event.position);
  },
});
```

## Event Types

The system supports various event types:

### Pointer Events
- `pointer-down` - Mouse/touch press
- `pointer-move` - Mouse/touch movement
- `pointer-up` - Mouse/touch release
- `pointer-enter` - Enter canvas area
- `pointer-leave` - Leave canvas area

### Click Events
- `click` - Single click/tap
- `double-click` - Double click/tap
- `right-click` - Context menu trigger

### Drag Events
- `drag-start` - Begin drag operation
- `drag` - During drag operation
- `drag-end` - End drag operation

### Gesture Events
- `gesture-start` - Begin multi-touch gesture
- `gesture` - During gesture
- `gesture-end` - End gesture

### Keyboard Events
- `key-down` - Key press
- `key-up` - Key release

## Usage with React

### Basic Setup

```typescript
import { useCanvasEvents } from '@/hooks/use-canvas-events';

function CanvasComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<DiagramElement[]>([]);
  
  const { eventManager, registerHandler } = useCanvasEvents({
    canvas: canvasRef.current,
    viewportManager: viewportManagerRef.current,
    elements,
    debug: true,
  });

  // Register custom handler
  useEffect(() => {
    if (eventManager) {
      const handlerId = registerHandler('click', (event, context) => {
        console.log('Custom click handler:', event.worldPosition);
      });

      return () => {
        if (handlerId) {
          eventManager.unregisterHandler(handlerId);
        }
      };
    }
  }, [eventManager, registerHandler]);

  return <canvas ref={canvasRef} />;
}
```

### Keyboard Shortcuts

```typescript
import { useCanvasKeyboardShortcuts } from '@/hooks/use-canvas-events';

function CanvasWithShortcuts() {
  const shortcuts = {
    'delete': () => deleteSelectedElements(),
    'ctrl+a': () => selectAllElements(),
    'ctrl+z': () => undo(),
    'ctrl+y': () => redo(),
    'escape': () => cancelCurrentOperation(),
  };

  useCanvasKeyboardShortcuts(eventManager, shortcuts);
  
  // ... rest of component
}
```

### Performance Monitoring

```typescript
import { useCanvasEventMetrics } from '@/hooks/use-canvas-events';

function PerformanceMonitor({ eventManager }) {
  const metrics = useCanvasEventMetrics(eventManager);

  return (
    <div>
      <p>Events/sec: {metrics.eventsPerSecond}</p>
      <p>Avg processing time: {metrics.avgProcessingTime}ms</p>
      <p>Hit test time: {metrics.hitTestTime}ms</p>
    </div>
  );
}
```

## Configuration Options

### Event Manager Configuration

```typescript
interface EventManagerConfig {
  canvas: HTMLCanvasElement;
  
  // Delegation options
  delegation?: {
    useEventDelegation?: boolean;
    throttleMove?: number;
    debounceResize?: number;
    maxTouchHistory?: number;
  };
  
  // Drag configuration
  drag?: {
    threshold?: number;
    cloneElements?: boolean;
    snapToGrid?: boolean;
    gridSize?: number;
    constrainAxis?: 'x' | 'y' | null;
  };
  
  // Selection configuration
  selection?: {
    multiSelect?: boolean;
    selectionStyle?: {
      fillColor?: string;
      strokeColor?: string;
      strokeWidth?: number;
      strokeDashArray?: string;
    };
    minSelectionSize?: number;
  };
  
  // Hit test options
  hitTest?: {
    tolerance?: number;
    includeInvisible?: boolean;
    includeLocked?: boolean;
  };
  
  // Feature flags
  gestures?: boolean;
  keyboard?: boolean;
  debug?: boolean;
}
```

## Advanced Usage

### Custom Event Handlers

```typescript
// Register handler with options
const handlerId = eventManager.registerHandler(
  'pointer-move',
  (event, context) => {
    if (context.mode === 'drawing') {
      // Handle drawing mode movement
      return false; // Prevent default
    }
  },
  {
    priority: 100, // Higher priority
    condition: (event, context) => context.selectedElements.size > 0,
    once: false,
    passive: false,
  }
);
```

### Custom Hit Testing

```typescript
// Custom hit test with filter
const hits = hitTester.hitTestRectangle(selectionRect, elements, {
  filter: (element) => element.type === 'sticky_note',
  tolerance: 5,
  includeInvisible: false,
});
```

### Gesture Recognition

```typescript
// Configure gesture recognition
const gestureRecognizer = new GestureRecognizer({
  panThreshold: 15, // Require more movement for pan
  pinchThreshold: 0.05, // More sensitive pinch
  longPressThreshold: 800, // Longer press time
  trackVelocity: true, // Enable velocity tracking
});

// Process gestures
const gestures = gestureRecognizer.processTouch(touchEvents);
for (const gesture of gestures) {
  switch (gesture.type) {
    case 'pan':
      viewportManager.panBy({ x: gesture.deltaX, y: gesture.deltaY });
      break;
    case 'pinch':
      if (gesture.scale) {
        viewportManager.zoomAtPoint(
          viewportManager.getViewport().zoom * gesture.scale,
          gesture.center
        );
      }
      break;
  }
}
```

## Performance Considerations

1. **Event Throttling**: Move events are throttled by default to ~60fps
2. **Hit Test Optimization**: Elements are sorted by z-index and size for efficient hit testing
3. **Gesture Recognition**: Touch history is limited to prevent memory leaks
4. **Event Delegation**: Single listener per event type reduces memory usage
5. **Coordinate Caching**: Canvas bounds are cached and updated periodically

## Debugging

Enable debug mode for detailed logging:

```typescript
const eventManager = new CanvasEventManager({
  canvas: canvasElement,
  debug: true, // Enable debug logging
}, callbacks);
```

Debug output includes:
- Event processing times
- Hit test results
- Gesture recognition states
- Performance metrics
- Error conditions

## Integration with UI State

The event system integrates seamlessly with the UI store:

```typescript
// UI store updates are automatically handled
const {
  selectedElements,
  hoveredElement,
  editingElement,
  currentTool,
} = useUIStore();

// Event manager syncs with UI state
useEffect(() => {
  if (eventManager) {
    eventManager.updateSelectedElements(selectedElements);
    eventManager.updateHoveredElement(hoveredElement);
    eventManager.updateEditingElement(editingElement);
    eventManager.setInteractionMode(mapToolToMode(currentTool));
  }
}, [eventManager, selectedElements, hoveredElement, editingElement, currentTool]);
```

This provides a complete, high-performance event handling system that supports all modern interaction patterns including multi-touch gestures, keyboard shortcuts, and complex canvas manipulations.