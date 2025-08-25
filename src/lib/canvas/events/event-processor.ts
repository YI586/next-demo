/**
 * Event processor for normalizing and transforming DOM events
 * Handles coordinate transformations and event normalization
 */

import type { ViewportManager } from '../viewport';
import type {
  ProcessedCanvasEvent,
  ProcessedKeyboardEvent,
  TouchPointer,
  EventType,
} from './types';
import type {
  ScreenCoordinates,
  WorldCoordinates,
  CanvasPointerEvent,
  CanvasKeyboardEvent,
} from '@/types/canvas';
import type { Point } from '@/types/common';

/**
 * Configuration for event processing
 */
export interface EventProcessorConfig {
  /** Canvas element for coordinate calculations */
  canvas: HTMLCanvasElement;
  /** Viewport manager for coordinate transformations */
  viewportManager: ViewportManager;
  /** Device pixel ratio override */
  devicePixelRatio?: number;
  /** Touch event handling */
  supportTouch?: boolean;
  /** Pointer event handling */
  supportPointer?: boolean;
}

/**
 * Event processor that normalizes DOM events into canvas events
 */
export class EventProcessor {
  private canvas: HTMLCanvasElement;
  private viewportManager: ViewportManager;
  private devicePixelRatio: number;
  private supportTouch: boolean;
  private supportPointer: boolean;
  private canvasRect: DOMRect | null = null;
  private rectUpdateId?: number;

  constructor(config: EventProcessorConfig) {
    this.canvas = config.canvas;
    this.viewportManager = config.viewportManager;
    this.devicePixelRatio = config.devicePixelRatio ?? window.devicePixelRatio ?? 1;
    this.supportTouch = config.supportTouch ?? 'ontouchstart' in window;
    this.supportPointer = config.supportPointer ?? 'onpointerdown' in window;

    // Update canvas rect periodically and on resize
    this.updateCanvasRect();
    this.setupRectUpdates();
  }

  /**
   * Process a mouse event into a canvas event
   */
  processMouseEvent(
    event: MouseEvent,
    eventType: EventType
  ): ProcessedCanvasEvent {
    const screenPos = this.getMouseScreenCoordinates(event);
    const worldPos = this.viewportManager.screenToWorld(screenPos);

    return this.createProcessedEvent({
      type: this.mapMouseEventType(eventType),
      position: screenPos,
      worldPosition: worldPos,
      button: this.mapMouseButton(event.button),
      modifiers: this.extractModifiers(event),
      originalEvent: event,
      pointerId: this.supportPointer ? (event as PointerEvent).pointerId : undefined,
      pressure: this.supportPointer ? (event as PointerEvent).pressure : undefined,
    });
  }

  /**
   * Process a touch event into canvas events
   */
  processTouchEvent(
    event: TouchEvent,
    eventType: EventType
  ): ProcessedCanvasEvent[] {
    const events: ProcessedCanvasEvent[] = [];

    // Process each changed touch
    const touches = eventType === EventType.POINTER_UP ? event.changedTouches : event.touches;
    
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      const screenPos = this.getTouchScreenCoordinates(touch);
      const worldPos = this.viewportManager.screenToWorld(screenPos);

      events.push(this.createProcessedEvent({
        type: this.mapTouchEventType(eventType),
        position: screenPos,
        worldPosition: worldPos,
        button: 'left', // Touch is always left button
        modifiers: this.extractModifiers(event),
        originalEvent: event,
        pointerId: touch.identifier,
        pressure: touch.force,
      }));
    }

    return events;
  }

  /**
   * Process a wheel event into a canvas event
   */
  processWheelEvent(event: WheelEvent): ProcessedCanvasEvent {
    const screenPos = this.getMouseScreenCoordinates(event);
    const worldPos = this.viewportManager.screenToWorld(screenPos);

    return this.createProcessedEvent({
      type: 'click', // Will be overridden by event manager
      position: screenPos,
      worldPosition: worldPos,
      button: 'middle',
      modifiers: this.extractModifiers(event),
      originalEvent: event,
    });
  }

  /**
   * Process a keyboard event into a canvas event
   */
  processKeyboardEvent(
    event: KeyboardEvent,
    eventType: EventType
  ): ProcessedKeyboardEvent {
    return {
      type: eventType === EventType.KEY_DOWN ? 'down' : 'up',
      key: event.key,
      code: event.code,
      modifiers: this.extractModifiers(event),
      originalEvent: event,
      timestamp: performance.now(),
      prevented: false,
    };
  }

  /**
   * Extract touch pointers from a touch event
   */
  extractTouchPointers(event: TouchEvent): TouchPointer[] {
    const pointers: TouchPointer[] = [];

    for (let i = 0; i < event.touches.length; i++) {
      const touch = event.touches[i];
      const position = this.getTouchScreenCoordinates(touch);

      pointers.push({
        id: touch.identifier,
        position,
        startPosition: position, // This should be tracked externally
        force: touch.force,
      });
    }

    return pointers;
  }

  /**
   * Update viewport manager reference
   */
  updateViewportManager(viewportManager: ViewportManager): void {
    this.viewportManager = viewportManager;
  }

  /**
   * Update device pixel ratio
   */
  updateDevicePixelRatio(ratio?: number): void {
    this.devicePixelRatio = ratio ?? window.devicePixelRatio ?? 1;
  }

  /**
   * Update canvas reference
   */
  updateCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.updateCanvasRect();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.rectUpdateId) {
      cancelAnimationFrame(this.rectUpdateId);
      delete this.rectUpdateId;
    }
  }

  /**
   * Get mouse coordinates relative to canvas
   */
  private getMouseScreenCoordinates(event: MouseEvent): ScreenCoordinates {
    if (!this.canvasRect) {
      this.updateCanvasRect();
    }

    const rect = this.canvasRect!;
    return {
      x: (event.clientX - rect.left) * this.devicePixelRatio,
      y: (event.clientY - rect.top) * this.devicePixelRatio,
    };
  }

  /**
   * Get touch coordinates relative to canvas
   */
  private getTouchScreenCoordinates(touch: Touch): ScreenCoordinates {
    if (!this.canvasRect) {
      this.updateCanvasRect();
    }

    const rect = this.canvasRect!;
    return {
      x: (touch.clientX - rect.left) * this.devicePixelRatio,
      y: (touch.clientY - rect.top) * this.devicePixelRatio,
    };
  }

  /**
   * Create a processed canvas event with common properties
   */
  private createProcessedEvent(
    baseEvent: Partial<ProcessedCanvasEvent>
  ): ProcessedCanvasEvent {
    return {
      type: 'click',
      position: { x: 0, y: 0 },
      worldPosition: { x: 0, y: 0 },
      button: 'left',
      modifiers: {
        shift: false,
        ctrl: false,
        alt: false,
        meta: false,
      },
      timestamp: performance.now(),
      prevented: false,
      ...baseEvent,
      originalEvent: baseEvent.originalEvent!,
    } as ProcessedCanvasEvent;
  }

  /**
   * Map mouse event type to canvas event type
   */
  private mapMouseEventType(eventType: EventType): CanvasPointerEvent['type'] {
    switch (eventType) {
      case EventType.POINTER_DOWN:
        return 'down';
      case EventType.POINTER_MOVE:
        return 'move';
      case EventType.POINTER_UP:
        return 'up';
      case EventType.CLICK:
        return 'click';
      case EventType.DOUBLE_CLICK:
        return 'double-click';
      default:
        return 'click';
    }
  }

  /**
   * Map touch event type to canvas event type
   */
  private mapTouchEventType(eventType: EventType): CanvasPointerEvent['type'] {
    switch (eventType) {
      case EventType.POINTER_DOWN:
        return 'down';
      case EventType.POINTER_MOVE:
        return 'move';
      case EventType.POINTER_UP:
        return 'up';
      default:
        return 'down';
    }
  }

  /**
   * Map mouse button number to string
   */
  private mapMouseButton(button: number): CanvasPointerEvent['button'] {
    switch (button) {
      case 0:
        return 'left';
      case 1:
        return 'middle';
      case 2:
        return 'right';
      default:
        return 'left';
    }
  }

  /**
   * Extract modifier keys from event
   */
  private extractModifiers(event: MouseEvent | TouchEvent | KeyboardEvent) {
    return {
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey,
      meta: event.metaKey,
    };
  }

  /**
   * Update cached canvas bounding rect
   */
  private updateCanvasRect(): void {
    if (this.canvas) {
      this.canvasRect = this.canvas.getBoundingClientRect();
    }
  }

  /**
   * Setup periodic canvas rect updates
   */
  private setupRectUpdates(): void {
    const updateLoop = () => {
      this.updateCanvasRect();
      this.rectUpdateId = requestAnimationFrame(updateLoop);
    };

    // Update on resize
    window.addEventListener('resize', () => this.updateCanvasRect());
    window.addEventListener('scroll', () => this.updateCanvasRect());

    // Periodic updates for other layout changes
    updateLoop();
  }
}

/**
 * Utility functions for event processing
 */
export const eventProcessorUtils = {
  /**
   * Check if an event is a touch event
   */
  isTouchEvent(event: Event): event is TouchEvent {
    return 'touches' in event;
  },

  /**
   * Check if an event is a pointer event
   */
  isPointerEvent(event: Event): event is PointerEvent {
    return 'pointerId' in event;
  },

  /**
   * Check if an event is a mouse event
   */
  isMouseEvent(event: Event): event is MouseEvent {
    return 'button' in event && !('pointerId' in event);
  },

  /**
   * Check if an event is a keyboard event
   */
  isKeyboardEvent(event: Event): event is KeyboardEvent {
    return 'key' in event;
  },

  /**
   * Get primary pointer from touch event
   */
  getPrimaryTouch(event: TouchEvent): Touch | null {
    return event.touches.length > 0 ? event.touches[0] : null;
  },

  /**
   * Calculate distance between two points
   */
  getDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /**
   * Calculate angle between two points in radians
   */
  getAngle(p1: Point, p2: Point): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
  },

  /**
   * Calculate center point between multiple points
   */
  getCenterPoint(points: Point[]): Point {
    if (points.length === 0) {
      return { x: 0, y: 0 };
    }

    const sum = points.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 }
    );

    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
    };
  },

  /**
   * Throttle function for high-frequency events
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return function (this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * Debounce function for event handling
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | undefined;
    return function (this: any, ...args: Parameters<T>) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },
};