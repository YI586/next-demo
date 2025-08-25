/**
 * Canvas utilities, viewport management, and event handling exports
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
