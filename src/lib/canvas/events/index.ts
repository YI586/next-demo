/**
 * Canvas event handling system exports
 * Provides comprehensive mouse/touch event processing, coordinate transformations,
 * and interaction management for the canvas
 */

export { CanvasEventManager } from './event-manager';
export { EventProcessor } from './event-processor';
export { HitTester } from './hit-tester';
export { GestureRecognizer } from './gesture-recognizer';
export { EventDelegator } from './event-delegator';

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
  EventHandlerContext,
} from './types';

// Re-export from event-manager
export type { EventManagerCallbacks } from './event-manager';

export {
  EventType,
  GestureType,
  InteractionState,
  HitTestLayer,
} from './types';