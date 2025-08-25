/**
 * Event delegation system for performance optimization
 * Manages event listeners and dispatches to appropriate handlers
 */

import type {
  EventListenerMap,
  EventHandlerOptions,
  ProcessedCanvasEvent,
  EventDelegationOptions,
} from './types';
import { EventType, InteractionState } from './types';
import { eventProcessorUtils } from './event-processor';

/**
 * Registered event handler with metadata
 */
interface RegisteredHandler {
  handler: Function;
  options: Required<EventHandlerOptions>;
  id: string;
}

/**
 * Event listener configuration for DOM events
 */
interface DOMEventListener {
  element: EventTarget;
  eventType: string;
  listener: EventListener;
  options?: AddEventListenerOptions;
}

/**
 * Event delegation manager for canvas interactions
 */
export class EventDelegator {
  private canvas: HTMLCanvasElement;
  private config: Required<EventDelegationOptions>;
  private handlers = new Map<EventType, RegisteredHandler[]>();
  private domListeners: DOMEventListener[] = [];
  private interactionState: InteractionState = InteractionState.IDLE;
  private throttledHandlers = new Map<string, Function>();
  private debouncedHandlers = new Map<string, Function>();
  private nextHandlerId = 0;
  private enabled = true;

  constructor(canvas: HTMLCanvasElement, config?: Partial<EventDelegationOptions>) {
    this.canvas = canvas;
    this.config = {
      useEventDelegation: true,
      throttleMove: 16, // ~60fps
      debounceResize: 100,
      maxTouchHistory: 10,
      ...config,
    };

    this.setupEventDelegation();
  }

  /**
   * Register event handlers
   */
  registerHandlers(handlers: Partial<EventListenerMap>): string[] {
    const ids: string[] = [];

    for (const [eventType, handler] of Object.entries(handlers)) {
      if (handler) {
        const id = this.registerHandler(eventType as EventType, handler);
        ids.push(id);
      }
    }

    return ids;
  }

  /**
   * Register single event handler
   */
  registerHandler(
    eventType: EventType,
    handler: Function,
    options?: Partial<EventHandlerOptions>
  ): string {
    const id = `handler-${this.nextHandlerId++}`;
    const fullOptions: Required<EventHandlerOptions> = {
      priority: 0,
      capture: false,
      once: false,
      passive: false,
      condition: () => true,
      ...options,
    };

    const registeredHandler: RegisteredHandler = {
      handler,
      options: fullOptions,
      id,
    };

    // Add to handlers map
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    const handlersForType = this.handlers.get(eventType)!;
    handlersForType.push(registeredHandler);

    // Sort by priority (higher priority first)
    handlersForType.sort((a, b) => b.options.priority - a.options.priority);

    return id;
  }

  /**
   * Unregister event handler by ID
   */
  unregisterHandler(handlerId: string): boolean {
    for (const [eventType, handlersForType] of this.handlers) {
      const index = handlersForType.findIndex(h => h.id === handlerId);
      if (index !== -1) {
        handlersForType.splice(index, 1);
        if (handlersForType.length === 0) {
          this.handlers.delete(eventType);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Unregister all handlers for event type
   */
  unregisterHandlersForType(eventType: EventType): number {
    const handlers = this.handlers.get(eventType);
    if (!handlers) return 0;

    const count = handlers.length;
    this.handlers.delete(eventType);
    return count;
  }

  /**
   * Dispatch event to registered handlers
   */
  dispatchEvent(
    eventType: EventType,
    event: ProcessedCanvasEvent,
    context?: any
  ): boolean {
    if (!this.enabled) return false;

    const handlers = this.handlers.get(eventType);
    if (!handlers || handlers.length === 0) return false;

    let handled = false;
    let preventDefault = false;

    for (const registeredHandler of handlers) {
      const { handler, options } = registeredHandler;

      // Check condition
      if (!options.condition(event, context)) {
        continue;
      }

      // Apply throttling for move events
      if (eventType === EventType.POINTER_MOVE && this.config.throttleMove > 0) {
        const throttledHandler = this.getThrottledHandler(
          registeredHandler.id,
          handler as Function,
          this.config.throttleMove
        );
        const result = throttledHandler(event, context);
        if (result === false) preventDefault = true;
      } else {
        const result = handler(event, context);
        if (result === false) preventDefault = true;
      }

      handled = true;

      // Remove handler if once option is set
      if (options.once) {
        this.unregisterHandler(registeredHandler.id);
      }

      // Stop propagation in capture phase if handled
      if (options.capture && handled) {
        break;
      }
    }

    // Update prevented status
    if (preventDefault) {
      event.prevented = true;
    }

    return handled;
  }

  /**
   * Set interaction state
   */
  setInteractionState(state: InteractionState): void {
    this.interactionState = state;
  }

  /**
   * Get current interaction state
   */
  getInteractionState(): InteractionState {
    return this.interactionState;
  }

  /**
   * Enable or disable event processing
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if event processing is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EventDelegationOptions>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get registered handler count for event type
   */
  getHandlerCount(eventType?: EventType): number {
    if (eventType) {
      return this.handlers.get(eventType)?.length ?? 0;
    }

    let total = 0;
    for (const handlers of this.handlers.values()) {
      total += handlers.length;
    }
    return total;
  }

  /**
   * Get all registered event types
   */
  getRegisteredEventTypes(): EventType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear all handlers
    this.handlers.clear();

    // Remove DOM listeners
    for (const listener of this.domListeners) {
      listener.element.removeEventListener(
        listener.eventType,
        listener.listener,
        listener.options
      );
    }
    this.domListeners.length = 0;

    // Clear throttled/debounced handlers
    this.throttledHandlers.clear();
    this.debouncedHandlers.clear();
  }

  /**
   * Setup event delegation on canvas element
   */
  private setupEventDelegation(): void {
    if (!this.config.useEventDelegation) return;

    // Mouse events
    this.addDOMListener(this.canvas, 'mousedown', (e) => this.handleMouseEvent(e as MouseEvent));
    this.addDOMListener(this.canvas, 'mousemove', (e) => this.handleMouseEvent(e as MouseEvent));
    this.addDOMListener(this.canvas, 'mouseup', (e) => this.handleMouseEvent(e as MouseEvent));
    this.addDOMListener(this.canvas, 'mouseenter', (e) => this.handleMouseEvent(e as MouseEvent));
    this.addDOMListener(this.canvas, 'mouseleave', (e) => this.handleMouseEvent(e as MouseEvent));
    this.addDOMListener(this.canvas, 'click', (e) => this.handleMouseEvent(e as MouseEvent));
    this.addDOMListener(this.canvas, 'dblclick', (e) => this.handleMouseEvent(e as MouseEvent));
    this.addDOMListener(this.canvas, 'contextmenu', (e) => this.handleMouseEvent(e as MouseEvent));
    this.addDOMListener(this.canvas, 'wheel', (e) => this.handleWheelEvent(e as WheelEvent), { passive: false });

    // Touch events
    this.addDOMListener(this.canvas, 'touchstart', (e) => this.handleTouchEvent(e as TouchEvent), { passive: false });
    this.addDOMListener(this.canvas, 'touchmove', (e) => this.handleTouchEvent(e as TouchEvent), { passive: false });
    this.addDOMListener(this.canvas, 'touchend', (e) => this.handleTouchEvent(e as TouchEvent), { passive: false });
    this.addDOMListener(this.canvas, 'touchcancel', (e) => this.handleTouchEvent(e as TouchEvent), { passive: false });

    // Pointer events (if supported)
    if ('onpointerdown' in window) {
      this.addDOMListener(this.canvas, 'pointerdown', (e) => this.handlePointerEvent(e as PointerEvent));
      this.addDOMListener(this.canvas, 'pointermove', (e) => this.handlePointerEvent(e as PointerEvent));
      this.addDOMListener(this.canvas, 'pointerup', (e) => this.handlePointerEvent(e as PointerEvent));
      this.addDOMListener(this.canvas, 'pointerenter', (e) => this.handlePointerEvent(e as PointerEvent));
      this.addDOMListener(this.canvas, 'pointerleave', (e) => this.handlePointerEvent(e as PointerEvent));
    }

    // Keyboard events (on document for global capture)
    this.addDOMListener(document, 'keydown', (e) => this.handleKeyboardEvent(e as KeyboardEvent));
    this.addDOMListener(document, 'keyup', (e) => this.handleKeyboardEvent(e as KeyboardEvent));

    // Window events
    this.addDOMListener(window, 'resize', (e) => this.handleWindowEvent(e));
    this.addDOMListener(window, 'blur', (e) => this.handleWindowEvent(e));
  }

  /**
   * Add DOM event listener and track it
   */
  private addDOMListener(
    element: EventTarget,
    eventType: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): void {
    element.addEventListener(eventType, listener, options);
    this.domListeners.push({ element, eventType, listener, options });
  }

  /**
   * Handle mouse events
   */
  private handleMouseEvent(event: MouseEvent): void {
    if (!this.enabled) return;

    event.preventDefault();

    let canvasEventType: EventType;
    switch (event.type) {
      case 'mousedown':
        canvasEventType = EventType.POINTER_DOWN;
        break;
      case 'mousemove':
        canvasEventType = EventType.POINTER_MOVE;
        break;
      case 'mouseup':
        canvasEventType = EventType.POINTER_UP;
        break;
      case 'mouseenter':
        canvasEventType = EventType.POINTER_ENTER;
        break;
      case 'mouseleave':
        canvasEventType = EventType.POINTER_LEAVE;
        break;
      case 'click':
        canvasEventType = EventType.CLICK;
        break;
      case 'dblclick':
        canvasEventType = EventType.DOUBLE_CLICK;
        break;
      case 'contextmenu':
        canvasEventType = EventType.RIGHT_CLICK;
        break;
      default:
        return;
    }

    // Dispatch to event manager or processor
    this.dispatchMouseEvent(canvasEventType, event);
  }

  /**
   * Handle touch events
   */
  private handleTouchEvent(event: TouchEvent): void {
    if (!this.enabled) return;

    event.preventDefault();

    let canvasEventType: EventType;
    switch (event.type) {
      case 'touchstart':
        canvasEventType = EventType.POINTER_DOWN;
        break;
      case 'touchmove':
        canvasEventType = EventType.POINTER_MOVE;
        break;
      case 'touchend':
      case 'touchcancel':
        canvasEventType = EventType.POINTER_UP;
        break;
      default:
        return;
    }

    this.dispatchTouchEvent(canvasEventType, event);
  }

  /**
   * Handle pointer events
   */
  private handlePointerEvent(event: PointerEvent): void {
    if (!this.enabled) return;

    // Let mouse events handle mouse pointers
    if (event.pointerType === 'mouse') return;

    event.preventDefault();

    let canvasEventType: EventType;
    switch (event.type) {
      case 'pointerdown':
        canvasEventType = EventType.POINTER_DOWN;
        break;
      case 'pointermove':
        canvasEventType = EventType.POINTER_MOVE;
        break;
      case 'pointerup':
        canvasEventType = EventType.POINTER_UP;
        break;
      case 'pointerenter':
        canvasEventType = EventType.POINTER_ENTER;
        break;
      case 'pointerleave':
        canvasEventType = EventType.POINTER_LEAVE;
        break;
      default:
        return;
    }

    this.dispatchPointerEvent(canvasEventType, event);
  }

  /**
   * Handle keyboard events
   */
  private handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.enabled) return;

    // Only handle if canvas has focus or is in focus chain
    if (!this.isCanvasFocused()) return;

    const canvasEventType = event.type === 'keydown' ? EventType.KEY_DOWN : EventType.KEY_UP;
    this.dispatchKeyboardEvent(canvasEventType, event);
  }

  /**
   * Handle window events
   */
  private handleWindowEvent(event: Event): void {
    if (!this.enabled) return;

    if (event.type === 'resize') {
      const debouncedHandler = this.getDebouncedHandler(
        'window-resize',
        () => this.dispatchWindowResize(),
        this.config.debounceResize
      );
      debouncedHandler();
    } else if (event.type === 'blur') {
      // Clear interaction state on window blur
      this.setInteractionState(InteractionState.IDLE);
    }
  }

  /**
   * Handle wheel events
   */
  private handleWheelEvent(event: WheelEvent): void {
    if (!this.enabled) return;

    event.preventDefault();
    this.dispatchWheelEvent(event);
  }

  /**
   * Dispatch mouse event (placeholder - should connect to event processor)
   */
  private dispatchMouseEvent(eventType: EventType, event: MouseEvent): void {
    // This would typically be connected to the EventProcessor
    console.debug('Mouse event:', eventType, event);
  }

  /**
   * Dispatch touch event (placeholder - should connect to event processor)
   */
  private dispatchTouchEvent(eventType: EventType, event: TouchEvent): void {
    // This would typically be connected to the EventProcessor
    console.debug('Touch event:', eventType, event);
  }

  /**
   * Dispatch pointer event (placeholder - should connect to event processor)
   */
  private dispatchPointerEvent(eventType: EventType, event: PointerEvent): void {
    // This would typically be connected to the EventProcessor
    console.debug('Pointer event:', eventType, event);
  }

  /**
   * Dispatch keyboard event (placeholder - should connect to event processor)
   */
  private dispatchKeyboardEvent(eventType: EventType, event: KeyboardEvent): void {
    // This would typically be connected to the EventProcessor
    console.debug('Keyboard event:', eventType, event);
  }

  /**
   * Dispatch wheel event (placeholder - should connect to event processor)
   */
  private dispatchWheelEvent(event: WheelEvent): void {
    // This would typically be connected to the EventProcessor
    console.debug('Wheel event:', event);
  }

  /**
   * Dispatch window resize
   */
  private dispatchWindowResize(): void {
    // Notify about resize
    console.debug('Window resized');
  }

  /**
   * Check if canvas is focused or should receive keyboard events
   */
  private isCanvasFocused(): boolean {
    const activeElement = document.activeElement;
    return activeElement === this.canvas ||
           this.canvas.contains(activeElement) ||
           activeElement === document.body; // Fallback for canvas focus
  }

  /**
   * Get throttled handler for high-frequency events
   */
  private getThrottledHandler(id: string, handler: Function, interval: number): Function {
    if (!this.throttledHandlers.has(id)) {
      this.throttledHandlers.set(
        id,
        eventProcessorUtils.throttle(handler, interval)
      );
    }
    return this.throttledHandlers.get(id)!;
  }

  /**
   * Get debounced handler for resize events
   */
  private getDebouncedHandler(id: string, handler: Function, delay: number): Function {
    if (!this.debouncedHandlers.has(id)) {
      this.debouncedHandlers.set(
        id,
        eventProcessorUtils.debounce(handler, delay)
      );
    }
    return this.debouncedHandlers.get(id)!;
  }
}

/**
 * Event delegation utilities
 */
export const delegationUtils = {
  /**
   * Create event handler with automatic cleanup
   */
  createAutoCleanupHandler<T extends Function>(
    handler: T,
    cleanup: () => void,
    options?: { timeout?: number }
  ): T {
    const wrappedHandler = ((...args: any[]) => {
      try {
        return handler(...args);
      } finally {
        if (options?.timeout) {
          setTimeout(cleanup, options.timeout);
        } else {
          cleanup();
        }
      }
    }) as any;

    return wrappedHandler;
  },

  /**
   * Create conditional handler
   */
  createConditionalHandler<T extends Function>(
    handler: T,
    condition: () => boolean
  ): T {
    const wrappedHandler = ((...args: any[]) => {
      if (condition()) {
        return handler(...args);
      }
      return true; // Don't prevent default
    }) as any;

    return wrappedHandler;
  },

  /**
   * Chain multiple handlers
   */
  chainHandlers<T extends Function>(...handlers: T[]): T {
    const chainedHandler = ((...args: any[]) => {
      let result = true;
      for (const handler of handlers) {
        const handlerResult = handler(...args);
        if (handlerResult === false) {
          result = false;
        }
      }
      return result;
    }) as any;

    return chainedHandler;
  },

  /**
   * Create handler with retry logic
   */
  createRetryHandler<T extends Function>(
    handler: T,
    maxRetries: number = 3,
    delay: number = 100
  ): T {
    const retryHandler = ((...args: any[]) => {
      let retries = 0;
      
      const attempt = () => {
        try {
          return handler(...args);
        } catch (error) {
          retries++;
          if (retries <= maxRetries) {
            setTimeout(attempt, delay * retries);
          } else {
            console.error('Handler failed after', maxRetries, 'retries:', error);
            return false;
          }
        }
      };

      return attempt();
    }) as any;

    return retryHandler;
  },
};