/**
 * Event handling type definitions for canvas interactions
 */

import type {
  Point,
  ID,
} from '@/types/common';
import type {
  CanvasPointerEvent,
  CanvasKeyboardEvent,
  InteractionMode,
  DragState,
  HitTestResult,
} from '@/types/canvas';
import type { DiagramElement } from '@/types/elements';

/** Event types supported by the canvas event system */
export enum EventType {
  POINTER_DOWN = 'pointer-down',
  POINTER_MOVE = 'pointer-move',
  POINTER_UP = 'pointer-up',
  POINTER_ENTER = 'pointer-enter',
  POINTER_LEAVE = 'pointer-leave',
  CLICK = 'click',
  DOUBLE_CLICK = 'double-click',
  RIGHT_CLICK = 'right-click',
  WHEEL = 'wheel',
  KEY_DOWN = 'key-down',
  KEY_UP = 'key-up',
  DRAG_START = 'drag-start',
  DRAG = 'drag',
  DRAG_END = 'drag-end',
  GESTURE_START = 'gesture-start',
  GESTURE = 'gesture',
  GESTURE_END = 'gesture-end',
}

/** Touch gesture types */
export enum GestureType {
  PAN = 'pan',
  PINCH = 'pinch',
  ROTATE = 'rotate',
  TWO_FINGER_TAP = 'two-finger-tap',
  LONG_PRESS = 'long-press',
}

/** Interaction states for event handling */
export enum InteractionState {
  IDLE = 'idle',
  HOVERING = 'hovering',
  DRAGGING = 'dragging',
  SELECTING = 'selecting',
  GESTURING = 'gesturing',
  EDITING = 'editing',
}

/** Hit test layers for priority ordering */
export enum HitTestLayer {
  UI_OVERLAY = 100,
  HANDLES = 90,
  SELECTION_BOUNDS = 80,
  ELEMENTS = 70,
  CONNECTION_POINTS = 60,
  GRID = 50,
  BACKGROUND = 0,
}

/** Processed canvas event with normalized coordinates and metadata */
export interface ProcessedCanvasEvent extends CanvasPointerEvent {
  /** Original DOM event */
  originalEvent: MouseEvent | TouchEvent | KeyboardEvent;
  /** Event timestamp */
  timestamp: number;
  /** Touch/pointer identifier for multi-touch */
  pointerId?: number;
  /** Pressure for pressure-sensitive devices */
  pressure?: number;
  /** Whether event was prevented */
  prevented: boolean;
  /** Touch gesture data if applicable */
  gesture?: TouchGesture;
}

/** Touch gesture data */
export interface TouchGesture {
  type: GestureType;
  state: GestureState;
  center: Point;
  deltaX: number;
  deltaY: number;
  scale?: number;
  rotation?: number;
  velocity?: Point;
  pointers: TouchPointer[];
}

/** Individual touch pointer information */
export interface TouchPointer {
  id: number;
  position: Point;
  startPosition: Point;
  force?: number;
}

/** Gesture recognition state */
export enum GestureState {
  POSSIBLE = 'possible',
  BEGAN = 'began',
  CHANGED = 'changed',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

/** Canvas event handler function signature */
export type CanvasEventHandler<T = ProcessedCanvasEvent> = (
  event: T,
  context: EventHandlerContext
) => boolean | void;

/** Context provided to event handlers */
export interface EventHandlerContext {
  /** Current interaction mode */
  mode: InteractionMode;
  /** Currently selected elements */
  selectedElements: Set<ID>;
  /** Element being hovered */
  hoveredElement: ID | null;
  /** Element being edited */
  editingElement: ID | null;
  /** Current drag state */
  dragState: DragState | null;
  /** Hit test result */
  hitTest: HitTestResult | null;
}

/** Event listener configuration */
export interface EventListenerMap {
  [EventType.POINTER_DOWN]?: CanvasEventHandler;
  [EventType.POINTER_MOVE]?: CanvasEventHandler;
  [EventType.POINTER_UP]?: CanvasEventHandler;
  [EventType.POINTER_ENTER]?: CanvasEventHandler;
  [EventType.POINTER_LEAVE]?: CanvasEventHandler;
  [EventType.CLICK]?: CanvasEventHandler;
  [EventType.DOUBLE_CLICK]?: CanvasEventHandler;
  [EventType.RIGHT_CLICK]?: CanvasEventHandler;
  [EventType.WHEEL]?: CanvasEventHandler;
  [EventType.KEY_DOWN]?: CanvasEventHandler<ProcessedKeyboardEvent>;
  [EventType.KEY_UP]?: CanvasEventHandler<ProcessedKeyboardEvent>;
  [EventType.DRAG_START]?: CanvasEventHandler;
  [EventType.DRAG]?: CanvasEventHandler;
  [EventType.DRAG_END]?: CanvasEventHandler;
  [EventType.GESTURE_START]?: CanvasEventHandler<GestureEvent>;
  [EventType.GESTURE]?: CanvasEventHandler<GestureEvent>;
  [EventType.GESTURE_END]?: CanvasEventHandler<GestureEvent>;
}

/** Processed keyboard event */
export interface ProcessedKeyboardEvent extends CanvasKeyboardEvent {
  originalEvent: KeyboardEvent;
  timestamp: number;
  prevented: boolean;
}

/** Gesture event */
export interface GestureEvent extends ProcessedCanvasEvent {
  gesture: TouchGesture;
}

/** Event handler registration options */
export interface EventHandlerOptions {
  /** Priority for event handling order (higher = earlier) */
  priority?: number;
  /** Capture phase handling */
  capture?: boolean;
  /** Handle events only once */
  once?: boolean;
  /** Handle events passively (cannot preventDefault) */
  passive?: boolean;
  /** Condition function to determine if handler should run */
  condition?: (event: ProcessedCanvasEvent, context: EventHandlerContext) => boolean;
}

/** Hit testing configuration */
export interface HitTestOptions {
  /** Layers to test (defaults to all) */
  layers?: HitTestLayer[];
  /** Tolerance for hit detection in pixels */
  tolerance?: number;
  /** Whether to include invisible elements */
  includeInvisible?: boolean;
  /** Whether to include locked elements */
  includeLocked?: boolean;
  /** Filter function for elements */
  filter?: (element: DiagramElement) => boolean;
}

/** Event delegation configuration */
export interface EventDelegationOptions {
  /** Whether to use event delegation for performance */
  useEventDelegation?: boolean;
  /** Throttle interval for move events in ms */
  throttleMove?: number;
  /** Debounce interval for resize events in ms */
  debounceResize?: number;
  /** Maximum number of stored touch points for gesture recognition */
  maxTouchHistory?: number;
}

/** Drag operation configuration */
export interface DragConfiguration {
  /** Minimum distance to start drag */
  threshold?: number;
  /** Whether to clone elements while dragging */
  cloneElements?: boolean;
  /** Snap to grid during drag */
  snapToGrid?: boolean;
  /** Grid size for snapping */
  gridSize?: number;
  /** Constrain drag to specific axis */
  constrainAxis?: 'x' | 'y' | null;
  /** Custom drag handler */
  onDrag?: (elements: DiagramElement[], delta: Point) => DiagramElement[];
}

/** Selection configuration */
export interface SelectionConfiguration {
  /** Allow multi-selection with Ctrl/Cmd */
  multiSelect?: boolean;
  /** Selection rectangle style */
  selectionStyle?: {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    strokeDashArray?: string;
  };
  /** Minimum size for selection rectangle */
  minSelectionSize?: number;
}

/** Event manager configuration */
export interface EventManagerConfig {
  /** Canvas element to attach events to */
  canvas: HTMLCanvasElement;
  /** Event delegation options */
  delegation?: EventDelegationOptions;
  /** Drag configuration */
  drag?: DragConfiguration;
  /** Selection configuration */
  selection?: SelectionConfiguration;
  /** Hit test options */
  hitTest?: HitTestOptions;
  /** Touch gesture recognition */
  gestures?: boolean;
  /** Keyboard shortcut handling */
  keyboard?: boolean;
  /** Debug mode for event logging */
  debug?: boolean;
}

/** Event performance metrics */
export interface EventMetrics {
  /** Number of events processed per second */
  eventsPerSecond: number;
  /** Average event processing time in ms */
  avgProcessingTime: number;
  /** Number of active listeners */
  activeListeners: number;
  /** Memory usage of event system */
  memoryUsage?: number;
  /** Hit test performance */
  hitTestTime: number;
  /** Gesture recognition performance */
  gestureTime: number;
}

/** Event system state */
export interface EventSystemState {
  /** Current interaction state */
  interactionState: InteractionState;
  /** Active pointers/touches */
  activePointers: Map<number, TouchPointer>;
  /** Current gesture being recognized */
  currentGesture: TouchGesture | null;
  /** Event metrics */
  metrics: EventMetrics;
  /** Whether event system is enabled */
  enabled: boolean;
}