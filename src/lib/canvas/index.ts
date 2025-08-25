/**
 * Canvas utilities, viewport management, event handling, and rendering exports
 */

// Viewport management
export {
  ViewportManager,
  createViewportManager,
  viewportUtils,
  DEFAULT_VIEWPORT,
  DEFAULT_ANIMATION_CONFIG,
} from './viewport';

export type {
  ViewportAnimationConfig,
  ViewportConstraints,
  ZoomResult,
  PanResult,
} from './viewport';

// Event handling system
export {
  CanvasEventManager,
  EventProcessor,
  HitTester,
  GestureRecognizer,
  EventDelegator,
} from './events';

export type {
  CanvasEventHandler,
  EventListenerMap,
  EventHandlerOptions,
  ProcessedCanvasEvent,
  TouchGesture,
  GestureState,
  HitTestOptions,
  EventDelegationOptions,
  EventManagerConfig,
  EventMetrics,
  EventSystemState,
} from './events';

export {
  EventType,
  GestureType,
  InteractionState,
  HitTestLayer,
} from './events';

// Rendering system
export {
  RenderEngine,
  createRenderEngine,
  CanvasRenderer,
  createRenderer,
  LayerManager,
  createLayerManager,
  ElementRendererFactory,
  createElementRendererFactory,
  StickyNoteRenderer,
  ConnectorRenderer,
  PerformanceOptimizer,
  createPerformanceOptimizer,
  DEFAULT_RENDER_ENGINE_CONFIG,
  DEFAULT_RENDER_CONFIG,
  DEFAULT_LAYER_CONFIGS,
  DEFAULT_PERFORMANCE_CONFIG,
  getLayerName,
} from './rendering';

export type {
  RenderEngineConfig,
  RenderStats,
  RenderConfig,
  RenderResult,
  LayerConfig,
  LayerRenderOp,
  ElementRenderer,
  PerformanceConfig,
  DirtyRegion,
} from './rendering';

export { RenderLOD } from './rendering';
