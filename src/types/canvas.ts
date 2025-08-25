/**
 * Canvas-related type definitions for viewport, interactions, and rendering
 */

import type { Point, Rectangle, Size } from './common';
import type { DiagramElement } from './elements';

/** Canvas viewport state */
export interface Viewport {
  /** Current zoom level (1.0 = 100%) */
  zoom: number;
  /** Minimum allowed zoom level */
  minZoom: number;
  /** Maximum allowed zoom level */
  maxZoom: number;
  /** Current pan offset */
  offset: Point;
  /** Viewport dimensions in screen pixels */
  size: Size;
  /** Visible area in world coordinates */
  visibleArea: Rectangle;
}

/** Canvas coordinate system types */
export type ScreenCoordinates = Point;
export type WorldCoordinates = Point;

/** Canvas interaction modes */
export enum InteractionMode {
  NORMAL = 'normal',
  DRAWING = 'drawing',
  EDITING = 'editing',
  PANNING = 'panning',
  SELECTING = 'selecting',
  RESIZING = 'resizing',
  CONNECTING = 'connecting',
}

/** Mouse/touch interaction events */
export interface CanvasPointerEvent {
  type: 'down' | 'move' | 'up' | 'click' | 'double-click';
  position: ScreenCoordinates;
  worldPosition: WorldCoordinates;
  button: 'left' | 'right' | 'middle';
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
  target?: DiagramElement;
}

/** Keyboard interaction events */
export interface CanvasKeyboardEvent {
  type: 'down' | 'up';
  key: string;
  code: string;
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
}

/** Canvas drag operation state */
export interface DragState {
  active: boolean;
  startPosition: WorldCoordinates;
  currentPosition: WorldCoordinates;
  delta: Point;
  target?: DiagramElement;
  mode: 'move' | 'resize' | 'pan' | 'select';
}

/** Canvas rendering context */
export interface CanvasRenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  viewport: Viewport;
  elements: DiagramElement[];
  selectedElements: Set<string>;
  hoveredElement?: DiagramElement;
  devicePixelRatio: number;
}

/** Render layer types for z-index management */
export enum RenderLayer {
  BACKGROUND = 0,
  GRID = 10,
  CONNECTORS = 20,
  ELEMENTS = 30,
  SELECTION = 40,
  HANDLES = 50,
  UI_OVERLAY = 60,
  TOOLTIP = 70,
}

/** Hit test result for mouse interactions */
export interface HitTestResult {
  element?: DiagramElement;
  handle?: string;
  connectionPoint?: string;
  layer: RenderLayer;
  distance: number;
}

/** Canvas bounds for collision detection */
export interface CanvasBounds extends Rectangle {
  padding?: number;
}

/** Performance monitoring for canvas operations */
export interface CanvasPerformanceMetrics {
  renderTime: number;
  elementCount: number;
  visibleElementCount: number;
  frameRate: number;
  memoryUsage?: number;
}