# Canvas Rendering Engine

This module provides a comprehensive canvas rendering engine for diagram elements with performance optimization, layered rendering, and high-DPI support.

## Architecture

The rendering engine is composed of several specialized subsystems:

### 1. RenderEngine (render-engine.ts)
The main orchestrator that coordinates all rendering operations.

```typescript
import { createRenderEngine } from '@/lib/canvas/rendering';

const renderEngine = createRenderEngine(viewportManager, {
  debug: true,
  performance: {
    enableCulling: true,
    enableDirtyRegions: true,
    targetFrameRate: 60,
  }
});

// Render complete diagram
const stats = await renderEngine.render(canvas, elements, selectedElements);
```

### 2. CanvasRenderer (renderer.ts)
Core renderer that handles canvas setup, clearing, and basic rendering operations.

```typescript
import { createRenderer } from '@/lib/canvas/rendering';

const renderer = createRenderer(viewportManager, {
  enableMetrics: true,
  grid: { enabled: true, size: 20 },
  background: { color: '#ffffff' }
});
```

### 3. LayerManager (layer-manager.ts)
Manages render layers with proper z-ordering and caching.

```typescript
import { createLayerManager, RenderLayer } from '@/lib/canvas/rendering';

const layerManager = createLayerManager({
  [RenderLayer.GRID]: { opacity: 0.3 },
  [RenderLayer.SELECTION]: { cacheable: false }
});
```

### 4. ElementRendererFactory (element-renderers.ts)
Provides specialized renderers for different element types.

```typescript
import { createElementRendererFactory } from '@/lib/canvas/rendering';

const renderers = createElementRendererFactory(viewportManager);
renderers.renderElement(context, stickyNote);
```

### 5. PerformanceOptimizer (performance-optimizer.ts)
Handles viewport culling, dirty regions, and performance monitoring.

```typescript
import { createPerformanceOptimizer } from '@/lib/canvas/rendering';

const optimizer = createPerformanceOptimizer(viewportManager, {
  enableCulling: true,
  enableDirtyRegions: true,
  targetFrameRate: 60
});
```

## Rendering Layers

The engine uses a layered rendering approach for proper z-ordering:

1. **Background** - Solid background color and patterns
2. **Grid** - Canvas grid overlay
3. **Connectors** - Connection lines between elements  
4. **Elements** - Diagram elements (sticky notes, shapes)
5. **Selection** - Selection outlines
6. **Handles** - Resize/move handles
7. **UI Overlay** - UI elements overlaid on canvas
8. **Tooltip** - Tooltips and help text

## Performance Features

### Viewport Culling
Only renders elements visible in the current viewport plus a margin:

```typescript
const optimizer = createPerformanceOptimizer(viewportManager, {
  enableCulling: true,
  cullingMargin: 100 // pixels
});
```

### Level of Detail (LOD)
Adjusts rendering quality based on zoom level:

```typescript
// Automatic LOD based on zoom
const config = {
  enableLOD: true,
  lodZoomThresholds: {
    high: 1.0,    // Full detail above 100% zoom
    medium: 0.5,  // Reduced detail 50%-100%
    low: 0.25     // Minimal detail below 25%
  }
};
```

### Dirty Regions
Tracks areas that need re-rendering for incremental updates:

```typescript
// Mark region as needing re-render
renderEngine.addDirtyRegion(
  { x: 100, y: 100, width: 200, height: 150 },
  1, // priority
  ['element-1', 'element-2'] // affected elements
);

// Render only dirty regions
await renderEngine.renderIncremental(canvas, elements, selectedElements);
```

### Render Scheduling
Limits render time per frame to maintain smooth frame rate:

```typescript
const config = {
  enableRenderScheduling: true,
  targetFrameRate: 60,
  maxFrameTime: 16 // milliseconds
};
```

## High-DPI Support

Automatically handles high-DPI displays:

```typescript
const renderEngine = createRenderEngine(viewportManager, {
  devicePixelRatio: window.devicePixelRatio // Auto-detected
});
```

## Element Rendering

### Sticky Notes
Renders sticky note elements with:
- Rounded corners and shadows
- Text wrapping and alignment
- Connection points
- Borders and styling

### Connectors
Renders connection lines with:
- Bezier curve support
- Arrow heads (triangle, circle, diamond)
- Labels and styling
- Dashed/dotted line patterns

### Custom Elements
Extend the system with custom renderers:

```typescript
class MyCustomRenderer implements ElementRenderer<MyElement> {
  render(context: CanvasRenderContext, element: MyElement): void {
    // Custom rendering logic
  }
  
  needsRender(element: MyElement, lastRenderTime?: number): boolean {
    return element.updatedAt > lastRenderTime;
  }
  
  getBounds(element: MyElement): Rectangle {
    return { x: element.x, y: element.y, width: element.w, height: element.h };
  }
  
  getPriority(element: MyElement): number {
    return element.zIndex || 0;
  }
}

// Register custom renderer
renderers.registerRenderer('my_element', new MyCustomRenderer());
```

## Performance Monitoring

Get detailed render statistics:

```typescript
const stats = await renderEngine.render(canvas, elements, selectedElements);

console.log({
  totalElements: stats.totalElements,
  renderedElements: stats.renderedElements,
  culledElements: stats.culledElements,
  renderTime: stats.totalRenderTime,
  frameRate: stats.performanceMetrics.frameRate
});
```

## Configuration Options

### RenderEngineConfig
```typescript
interface RenderEngineConfig {
  renderer: Partial<RenderConfig>;
  layers: Partial<Record<RenderLayer, Partial<LayerConfig>>>;
  performance: Partial<PerformanceConfig>;
  debug: boolean;
  devicePixelRatio?: number;
}
```

### RenderConfig
```typescript
interface RenderConfig {
  enableMetrics: boolean;
  enableCulling: boolean;
  enableDirtyRegions: boolean;
  maxElementsPerFrame: number;
  grid: { enabled: boolean; size: number; color: string; opacity: number };
  background: { color: string; pattern?: 'dots' | 'grid' | 'none' };
  selection: { color: string; width: number; dashPattern: number[] };
  handles: { size: number; color: string; borderColor: string; borderWidth: number };
}
```

### PerformanceConfig
```typescript
interface PerformanceConfig {
  enableCulling: boolean;
  enableDirtyRegions: boolean;
  enableRenderScheduling: boolean;
  targetFrameRate: number;
  maxFrameTime: number;
  cullingMargin: number;
  dirtyRegionMergeThreshold: number;
  enableLOD: boolean;
  lodZoomThresholds: { high: number; medium: number; low: number };
}
```

## Usage Examples

### Basic Rendering
```typescript
import { createRenderEngine } from '@/lib/canvas/rendering';
import { createViewportManager } from '@/lib/canvas/viewport';

// Setup viewport and render engine
const viewportManager = createViewportManager(viewport);
const renderEngine = createRenderEngine(viewportManager);

// Render diagram
const stats = await renderEngine.render(canvas, elements, selectedElements);
console.log(`Rendered ${stats.renderedElements} elements in ${stats.totalRenderTime}ms`);
```

### Performance Optimized Rendering
```typescript
const renderEngine = createRenderEngine(viewportManager, {
  performance: {
    enableCulling: true,
    enableDirtyRegions: true,
    enableLOD: true,
    targetFrameRate: 60
  },
  debug: process.env.NODE_ENV === 'development'
});
```

### Custom Layer Configuration
```typescript
const renderEngine = createRenderEngine(viewportManager, {
  layers: {
    [RenderLayer.GRID]: { 
      visible: true, 
      opacity: 0.2,
      cacheable: true 
    },
    [RenderLayer.SELECTION]: { 
      opacity: 0.8,
      cacheable: false 
    }
  }
});
```

## Integration

The rendering engine integrates with:
- **Viewport Management** - Coordinate transformations and culling
- **Event System** - Hit testing and interaction feedback
- **State Management** - Element updates and selection state
- **UI Components** - Canvas component integration

## Performance Tips

1. **Enable Culling** - Significantly improves performance with many elements
2. **Use Dirty Regions** - For incremental updates when only some elements change
3. **Configure LOD** - Reduce detail at low zoom levels
4. **Layer Caching** - Cache static layers like grid and background
5. **Monitor Metrics** - Use debug mode to identify performance bottlenecks

## Browser Compatibility

- Modern browsers with Canvas 2D API support
- High-DPI display support
- Hardware acceleration when available
- Graceful degradation on older browsers