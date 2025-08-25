/**
 * Main canvas event management system
 * Coordinates event processing, hit testing, gesture recognition, and delegation
 */

import type { DiagramElement } from '@/types/elements';
import type { InteractionMode, DragState } from '@/types/canvas';
import type { ID } from '@/types/common';
import { ViewportManager } from '../viewport';

import { EventProcessor, type EventProcessorConfig } from './event-processor';
import { HitTester, type DetailedHitTestResult } from './hit-tester';
import { GestureRecognizer, type GestureRecognizerConfig } from './gesture-recognizer';
import { EventDelegator } from './event-delegator';

import type {
  EventType,
  EventListenerMap,
  EventHandlerOptions,
  EventHandlerContext,
  ProcessedCanvasEvent,
  ProcessedKeyboardEvent,
  GestureEvent,
  TouchGesture,
  InteractionState,
  EventManagerConfig,
  EventMetrics,
  EventSystemState,
  HitTestOptions,
} from './types';

/**
 * Canvas event handler function type
 */
export type CanvasEventHandler<T = ProcessedCanvasEvent> = (
  event: T,
  context: EventHandlerContext
) => boolean | void;

/**
 * Event manager callback interface
 */
export interface EventManagerCallbacks {
  onElementHover?: (elementId: ID | null) => void;
  onElementSelect?: (elementIds: ID[]) => void;
  onElementEdit?: (elementId: ID | null) => void;
  onElementDrag?: (elements: DiagramElement[], delta: { x: number; y: number }) => void;
  onViewportChange?: (viewport: any) => void;
  onInteractionStateChange?: (state: InteractionState) => void;
}

/**
 * Main canvas event management system
 */
export class CanvasEventManager {
  private canvas: HTMLCanvasElement;
  private config: Required<EventManagerConfig>;
  private callbacks: EventManagerCallbacks;

  // Component systems
  private processor: EventProcessor;
  private hitTester: HitTester;
  private gestureRecognizer: GestureRecognizer;
  private delegator: EventDelegator;
  private viewportManager: ViewportManager;

  // State management
  private elements: DiagramElement[] = [];
  private selectedElements = new Set<ID>();
  private hoveredElement: ID | null = null;
  private editingElement: ID | null = null;
  private interactionMode: InteractionMode = 'normal';
  private dragState: DragState | null = null;
  private interactionState: InteractionState = InteractionState.IDLE;

  // Performance tracking
  private metrics: EventMetrics = {
    eventsPerSecond: 0,
    avgProcessingTime: 0,
    activeListeners: 0,
    hitTestTime: 0,
    gestureTime: 0,
  };

  private eventQueue: ProcessedCanvasEvent[] = [];
  private processingEvents = false;
  private lastFrameTime = 0;
  private frameEventCount = 0;

  constructor(config: EventManagerConfig, callbacks: EventManagerCallbacks = {}) {
    this.canvas = config.canvas;
    this.callbacks = callbacks;
    
    // Set default configuration
    this.config = {
      canvas: config.canvas,
      delegation: {
        useEventDelegation: true,
        throttleMove: 16,
        debounceResize: 100,
        maxTouchHistory: 10,
        ...config.delegation,
      },
      drag: {
        threshold: 5,
        cloneElements: false,
        snapToGrid: false,
        gridSize: 20,
        constrainAxis: null,
        ...config.drag,
      },
      selection: {
        multiSelect: true,
        selectionStyle: {
          fillColor: 'rgba(0, 123, 255, 0.1)',
          strokeColor: '#007bff',
          strokeWidth: 1,
          strokeDashArray: '3,3',
        },
        minSelectionSize: 10,
        ...config.selection,
      },
      hitTest: {
        layers: undefined,
        tolerance: 3,
        includeInvisible: false,
        includeLocked: false,
        ...config.hitTest,
      },
      gestures: config.gestures ?? true,
      keyboard: config.keyboard ?? true,
      debug: config.debug ?? false,
    };

    // Get viewport manager (should be passed in config)
    this.viewportManager = new ViewportManager({
      zoom: 1,
      minZoom: 0.1,
      maxZoom: 5,
      offset: { x: 0, y: 0 },
      size: { width: config.canvas.width, height: config.canvas.height },
      visibleArea: { x: 0, y: 0, width: config.canvas.width, height: config.canvas.height },
    });

    this.initializeComponents();
    this.setupEventHandlers();
    this.startMetricsTracking();
  }

  /**
   * Initialize component systems
   */
  private initializeComponents(): void {
    // Initialize event processor
    const processorConfig: EventProcessorConfig = {
      canvas: this.canvas,
      viewportManager: this.viewportManager,
      supportTouch: true,
      supportPointer: true,
    };
    this.processor = new EventProcessor(processorConfig);

    // Initialize hit tester
    this.hitTester = new HitTester(this.viewportManager, this.config.hitTest);

    // Initialize gesture recognizer
    const gestureConfig: GestureRecognizerConfig = {
      panThreshold: 10,
      pinchThreshold: 0.1,
      rotationThreshold: Math.PI / 12,
      longPressThreshold: 500,
      trackVelocity: true,
    };
    this.gestureRecognizer = new GestureRecognizer(gestureConfig);

    // Initialize event delegator
    this.delegator = new EventDelegator(this.canvas, this.config.delegation);
  }

  /**
   * Setup event handlers for all interaction types
   */
  private setupEventHandlers(): void {
    const handlers: Partial<EventListenerMap> = {
      [EventType.POINTER_DOWN]: this.handlePointerDown.bind(this),
      [EventType.POINTER_MOVE]: this.handlePointerMove.bind(this),
      [EventType.POINTER_UP]: this.handlePointerUp.bind(this),
      [EventType.CLICK]: this.handleClick.bind(this),
      [EventType.DOUBLE_CLICK]: this.handleDoubleClick.bind(this),
      [EventType.RIGHT_CLICK]: this.handleRightClick.bind(this),
      [EventType.WHEEL]: this.handleWheel.bind(this),
      [EventType.KEY_DOWN]: this.handleKeyDown.bind(this),
      [EventType.KEY_UP]: this.handleKeyUp.bind(this),
      [EventType.DRAG_START]: this.handleDragStart.bind(this),
      [EventType.DRAG]: this.handleDrag.bind(this),
      [EventType.DRAG_END]: this.handleDragEnd.bind(this),
    };

    if (this.config.gestures) {
      handlers[EventType.GESTURE_START] = this.handleGestureStart.bind(this);
      handlers[EventType.GESTURE] = this.handleGesture.bind(this);
      handlers[EventType.GESTURE_END] = this.handleGestureEnd.bind(this);
    }

    this.delegator.registerHandlers(handlers);
  }

  /**
   * Update elements for hit testing
   */
  updateElements(elements: DiagramElement[]): void {
    this.elements = elements;
  }

  /**
   * Update viewport manager
   */
  updateViewportManager(viewportManager: ViewportManager): void {
    this.viewportManager = viewportManager;
    this.processor.updateViewportManager(viewportManager);
    this.hitTester.updateViewportManager(viewportManager);
  }

  /**
   * Update interaction mode
   */
  setInteractionMode(mode: InteractionMode): void {
    this.interactionMode = mode;
    this.delegator.setInteractionState(this.mapInteractionModeToState(mode));
  }

  /**
   * Update selected elements
   */
  updateSelectedElements(elementIds: Set<ID>): void {
    this.selectedElements = new Set(elementIds);
  }

  /**
   * Update hovered element
   */
  updateHoveredElement(elementId: ID | null): void {
    this.hoveredElement = elementId;
  }

  /**
   * Update editing element
   */
  updateEditingElement(elementId: ID | null): void {
    this.editingElement = elementId;
  }

  /**
   * Register additional event handlers
   */
  registerHandler(
    eventType: EventType,
    handler: CanvasEventHandler,
    options?: Partial<EventHandlerOptions>
  ): string {
    return this.delegator.registerHandler(eventType, handler, options);
  }

  /**
   * Unregister event handler
   */
  unregisterHandler(handlerId: string): boolean {
    return this.delegator.unregisterHandler(handlerId);
  }

  /**
   * Enable or disable event system
   */
  setEnabled(enabled: boolean): void {
    this.delegator.setEnabled(enabled);
  }

  /**
   * Get current system state
   */
  getState(): EventSystemState {
    return {
      interactionState: this.interactionState,
      activePointers: new Map(),
      currentGesture: null,
      metrics: { ...this.metrics },
      enabled: this.delegator.isEnabled(),
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.processor.destroy();
    this.gestureRecognizer.clearGestures();
    this.delegator.destroy();
    this.eventQueue.length = 0;
  }

  /**
   * Handle pointer down events
   */
  private handlePointerDown(
    event: ProcessedCanvasEvent,
    context: EventHandlerContext
  ): boolean | void {
    const startTime = performance.now();

    // Perform hit test
    const hitResult = this.hitTester.hitTestAtScreen(
      event.position,
      this.elements
    );

    context.hitTest = hitResult;

    // Update hover state
    this.updateHoverState(hitResult.element?.id || null);

    // Handle different interaction modes
    switch (this.interactionMode) {
      case 'normal':
        this.handleNormalPointerDown(event, hitResult);
        break;
      case 'drawing':
        this.handleDrawingPointerDown(event, hitResult);
        break;
      case 'panning':
        this.handlePanningPointerDown(event);
        break;
      case 'selecting':
        this.handleSelectionPointerDown(event, hitResult);
        break;
    }

    this.updateMetrics('hitTestTime', performance.now() - startTime);
  }

  /**
   * Handle pointer move events
   */
  private handlePointerMove(
    event: ProcessedCanvasEvent,
    context: EventHandlerContext
  ): boolean | void {
    const startTime = performance.now();

    // Throttled hit test for performance
    const hitResult = this.hitTester.hitTestAtScreen(
      event.position,
      this.elements
    );

    context.hitTest = hitResult;

    // Update hover state
    this.updateHoverState(hitResult.element?.id || null);

    // Handle drag operations
    if (this.dragState?.active) {
      this.handleDragMove(event);
    }

    // Update cursor based on hit result
    this.updateCursor(hitResult);

    this.updateMetrics('hitTestTime', performance.now() - startTime);
  }

  /**
   * Handle pointer up events
   */
  private handlePointerUp(
    event: ProcessedCanvasEvent,
    context: EventHandlerContext
  ): boolean | void {
    // End any active drag operation
    if (this.dragState?.active) {
      this.endDrag(event);
    }

    // Reset interaction state
    this.setInteractionState(InteractionState.IDLE);
  }

  /**
   * Handle click events
   */
  private handleClick(
    event: ProcessedCanvasEvent,
    context: EventHandlerContext
  ): boolean | void {
    const hitResult = context.hitTest;
    if (!hitResult) return;

    if (hitResult.element) {
      this.handleElementClick(hitResult.element.id, event.modifiers);
    } else {
      this.handleCanvasClick(event);
    }
  }

  /**
   * Handle double click events
   */
  private handleDoubleClick(
    event: ProcessedCanvasEvent,
    context: EventHandlerContext
  ): boolean | void {
    const hitResult = context.hitTest;
    if (hitResult?.element) {
      this.startEditing(hitResult.element.id);
    }
  }

  /**
   * Handle right click events
   */
  private handleRightClick(
    event: ProcessedCanvasEvent,
    context: EventHandlerContext
  ): boolean | void {
    const hitResult = context.hitTest;
    // Show context menu
    this.showContextMenu(event.position, hitResult?.element);
    return false; // Prevent default
  }

  /**
   * Handle wheel events (zoom)
   */
  private handleWheel(
    event: ProcessedCanvasEvent,
    context: EventHandlerContext
  ): boolean | void {
    const wheelEvent = event.originalEvent as WheelEvent;
    const delta = wheelEvent.deltaY;
    
    if (event.modifiers.ctrl || event.modifiers.meta) {
      // Zoom
      const zoomFactor = delta > 0 ? 0.9 : 1.1;
      this.viewportManager.zoomAtPoint(
        this.viewportManager.getViewport().zoom * zoomFactor,
        event.position
      );
      this.callbacks.onViewportChange?.(this.viewportManager.getViewport());
    } else {
      // Pan
      this.viewportManager.panBy({ x: wheelEvent.deltaX, y: wheelEvent.deltaY });
      this.callbacks.onViewportChange?.(this.viewportManager.getViewport());
    }

    return false; // Prevent default
  }

  /**
   * Handle keyboard down events
   */
  private handleKeyDown(
    event: ProcessedKeyboardEvent,
    context: EventHandlerContext
  ): boolean | void {
    if (!this.config.keyboard) return;

    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        this.deleteSelectedElements();
        break;
      case 'Escape':
        this.cancelCurrentOperation();
        break;
      case 'a':
        if (event.modifiers.ctrl || event.modifiers.meta) {
          this.selectAllElements();
          return false;
        }
        break;
    }
  }

  /**
   * Handle keyboard up events
   */
  private handleKeyUp(
    event: ProcessedKeyboardEvent,
    context: EventHandlerContext
  ): boolean | void {
    // Handle key up if needed
  }

  /**
   * Handle drag start
   */
  private handleDragStart(
    event: ProcessedCanvasEvent,
    context: EventHandlerContext
  ): boolean | void {
    const hitResult = context.hitTest;
    if (!hitResult?.element) return;

    this.startDrag(hitResult.element.id, event.worldPosition);
  }

  /**
   * Handle drag
   */
  private handleDrag(
    event: ProcessedCanvasEvent,
    context: EventHandlerContext
  ): boolean | void {
    if (this.dragState?.active) {
      this.updateDrag(event.worldPosition);
    }
  }

  /**
   * Handle drag end
   */
  private handleDragEnd(
    event: ProcessedCanvasEvent,
    context: EventHandlerContext
  ): boolean | void {
    this.endDrag(event);
  }

  /**
   * Handle gesture start
   */
  private handleGestureStart(
    event: GestureEvent,
    context: EventHandlerContext
  ): boolean | void {
    this.setInteractionState(InteractionState.GESTURING);
  }

  /**
   * Handle gesture
   */
  private handleGesture(
    event: GestureEvent,
    context: EventHandlerContext
  ): boolean | void {
    const gesture = event.gesture;
    
    switch (gesture.type) {
      case 'pan':
        this.viewportManager.panBy({ x: gesture.deltaX, y: gesture.deltaY });
        break;
      case 'pinch':
        if (gesture.scale) {
          this.viewportManager.zoomAtPoint(
            this.viewportManager.getViewport().zoom * gesture.scale,
            gesture.center
          );
        }
        break;
      case 'rotate':
        // Handle rotation if needed
        break;
    }

    this.callbacks.onViewportChange?.(this.viewportManager.getViewport());
  }

  /**
   * Handle gesture end
   */
  private handleGestureEnd(
    event: GestureEvent,
    context: EventHandlerContext
  ): boolean | void {
    this.setInteractionState(InteractionState.IDLE);
  }

  // Helper methods for different pointer down scenarios
  private handleNormalPointerDown(event: ProcessedCanvasEvent, hitResult: DetailedHitTestResult): void {
    if (hitResult.element) {
      if (event.modifiers.ctrl || event.modifiers.meta) {
        this.toggleElementSelection(hitResult.element.id);
      } else {
        this.selectElement(hitResult.element.id);
      }
    } else {
      this.clearSelection();
    }
  }

  private handleDrawingPointerDown(event: ProcessedCanvasEvent, hitResult: DetailedHitTestResult): void {
    // Handle drawing mode - create new element
  }

  private handlePanningPointerDown(event: ProcessedCanvasEvent): void {
    this.setInteractionState(InteractionState.DRAGGING);
  }

  private handleSelectionPointerDown(event: ProcessedCanvasEvent, hitResult: DetailedHitTestResult): void {
    this.setInteractionState(InteractionState.SELECTING);
  }

  private handleDragMove(event: ProcessedCanvasEvent): void {
    this.updateDrag(event.worldPosition);
  }

  // State management helpers
  private updateHoverState(elementId: ID | null): void {
    if (this.hoveredElement !== elementId) {
      this.hoveredElement = elementId;
      this.callbacks.onElementHover?.(elementId);
    }
  }

  private selectElement(elementId: ID): void {
    this.selectedElements.clear();
    this.selectedElements.add(elementId);
    this.callbacks.onElementSelect?.(Array.from(this.selectedElements));
  }

  private toggleElementSelection(elementId: ID): void {
    if (this.selectedElements.has(elementId)) {
      this.selectedElements.delete(elementId);
    } else {
      this.selectedElements.add(elementId);
    }
    this.callbacks.onElementSelect?.(Array.from(this.selectedElements));
  }

  private clearSelection(): void {
    this.selectedElements.clear();
    this.callbacks.onElementSelect?.([]);
  }

  private selectAllElements(): void {
    this.selectedElements.clear();
    for (const element of this.elements) {
      this.selectedElements.add(element.id);
    }
    this.callbacks.onElementSelect?.(Array.from(this.selectedElements));
  }

  private startEditing(elementId: ID): void {
    this.editingElement = elementId;
    this.callbacks.onElementEdit?.(elementId);
  }

  private startDrag(elementId: ID, startPosition: { x: number; y: number }): void {
    this.dragState = {
      active: true,
      startPosition,
      currentPosition: startPosition,
      delta: { x: 0, y: 0 },
      target: this.elements.find(e => e.id === elementId),
      mode: 'move',
    };
    this.setInteractionState(InteractionState.DRAGGING);
  }

  private updateDrag(currentPosition: { x: number; y: number }): void {
    if (!this.dragState?.active) return;

    const delta = {
      x: currentPosition.x - this.dragState.startPosition.x,
      y: currentPosition.y - this.dragState.startPosition.y,
    };

    this.dragState.currentPosition = currentPosition;
    this.dragState.delta = delta;

    const draggedElements = this.elements.filter(e => this.selectedElements.has(e.id));
    this.callbacks.onElementDrag?.(draggedElements, delta);
  }

  private endDrag(event: ProcessedCanvasEvent): void {
    this.dragState = null;
    this.setInteractionState(InteractionState.IDLE);
  }

  private handleElementClick(elementId: ID, modifiers: any): void {
    // Handle element click logic
  }

  private handleCanvasClick(event: ProcessedCanvasEvent): void {
    // Handle canvas click logic
  }

  private showContextMenu(position: { x: number; y: number }, element?: DiagramElement): void {
    // Show context menu logic
  }

  private deleteSelectedElements(): void {
    // Delete selected elements logic
  }

  private cancelCurrentOperation(): void {
    this.dragState = null;
    this.editingElement = null;
    this.setInteractionState(InteractionState.IDLE);
  }

  private updateCursor(hitResult: DetailedHitTestResult): void {
    // Update cursor based on hit result
    const cursor = this.getCursorForHitResult(hitResult);
    this.canvas.style.cursor = cursor;
  }

  private getCursorForHitResult(hitResult: DetailedHitTestResult): string {
    if (hitResult.handle) {
      return this.getCursorForHandle(hitResult.handle);
    }
    if (hitResult.element) {
      return 'move';
    }
    return 'default';
  }

  private getCursorForHandle(handle: string): string {
    switch (handle) {
      case 'nw':
      case 'se':
        return 'nw-resize';
      case 'ne':
      case 'sw':
        return 'ne-resize';
      case 'n':
      case 's':
        return 'ns-resize';
      case 'e':
      case 'w':
        return 'ew-resize';
      default:
        return 'move';
    }
  }

  private setInteractionState(state: InteractionState): void {
    if (this.interactionState !== state) {
      this.interactionState = state;
      this.callbacks.onInteractionStateChange?.(state);
    }
  }

  private mapInteractionModeToState(mode: InteractionMode): InteractionState {
    switch (mode) {
      case 'drawing':
        return InteractionState.IDLE;
      case 'editing':
        return InteractionState.EDITING;
      case 'panning':
        return InteractionState.DRAGGING;
      case 'selecting':
        return InteractionState.SELECTING;
      default:
        return InteractionState.IDLE;
    }
  }

  private updateMetrics(metric: keyof EventMetrics, value: number): void {
    if (metric === 'hitTestTime' || metric === 'gestureTime') {
      // Use exponential moving average
      this.metrics[metric] = this.metrics[metric] * 0.9 + value * 0.1;
    } else {
      this.metrics[metric] = value;
    }
  }

  private startMetricsTracking(): void {
    setInterval(() => {
      this.metrics.eventsPerSecond = this.frameEventCount;
      this.metrics.activeListeners = this.delegator.getHandlerCount();
      this.frameEventCount = 0;
    }, 1000);
  }
}