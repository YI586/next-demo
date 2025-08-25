/**
 * Hit testing system for canvas element interactions
 * Determines which elements are under cursor/touch points
 */

import type { DiagramElement, StickyNote, Connector } from '@/types/elements';
import type { Point, Rectangle } from '@/types/common';
import type {
  HitTestResult,
  WorldCoordinates,
  ScreenCoordinates,
  RenderLayer,
} from '@/types/canvas';
import type { ViewportManager } from '../viewport';
import type { HitTestOptions } from './types';
import { HitTestLayer } from './types';

/**
 * Hit test result with additional metadata
 */
export interface DetailedHitTestResult extends HitTestResult {
  /** World coordinates of hit point */
  worldPoint: WorldCoordinates;
  /** Screen coordinates of hit point */
  screenPoint: ScreenCoordinates;
  /** Additional context data */
  context?: Record<string, any>;
}

/**
 * Hit testing configuration and utilities
 */
export class HitTester {
  private viewportManager: ViewportManager;
  private defaultOptions: Required<HitTestOptions>;

  constructor(viewportManager: ViewportManager, options?: Partial<HitTestOptions>) {
    this.viewportManager = viewportManager;
    this.defaultOptions = {
      layers: [
        HitTestLayer.UI_OVERLAY,
        HitTestLayer.HANDLES,
        HitTestLayer.SELECTION_BOUNDS,
        HitTestLayer.ELEMENTS,
        HitTestLayer.CONNECTION_POINTS,
        HitTestLayer.GRID,
        HitTestLayer.BACKGROUND,
      ],
      tolerance: 3,
      includeInvisible: false,
      includeLocked: false,
      filter: () => true,
      ...options,
    };
  }

  /**
   * Perform hit test at screen coordinates
   */
  hitTestAtScreen(
    screenPoint: ScreenCoordinates,
    elements: DiagramElement[],
    options?: Partial<HitTestOptions>
  ): DetailedHitTestResult {
    const worldPoint = this.viewportManager.screenToWorld(screenPoint);
    return this.hitTestAtWorld(worldPoint, elements, options, screenPoint);
  }

  /**
   * Perform hit test at world coordinates
   */
  hitTestAtWorld(
    worldPoint: WorldCoordinates,
    elements: DiagramElement[],
    options?: Partial<HitTestOptions>,
    screenPoint?: ScreenCoordinates
  ): DetailedHitTestResult {
    const config = { ...this.defaultOptions, ...options };
    const screenPos = screenPoint || this.viewportManager.worldToScreen(worldPoint);

    // Filter elements based on visibility and lock status
    const filteredElements = this.filterElements(elements, config);

    // Sort elements by z-index (highest first) and layer priority
    const sortedElements = this.sortElementsByPriority(filteredElements);

    // Test each element in priority order
    for (const element of sortedElements) {
      const result = this.testElement(element, worldPoint, config);
      if (result.element) {
        return {
          ...result,
          worldPoint,
          screenPoint: screenPos,
        };
      }
    }

    // No hit found
    return {
      element: undefined,
      layer: RenderLayer.BACKGROUND,
      distance: Infinity,
      worldPoint,
      screenPoint: screenPos,
    };
  }

  /**
   * Hit test multiple points (for gesture recognition)
   */
  hitTestMultiple(
    points: ScreenCoordinates[],
    elements: DiagramElement[],
    options?: Partial<HitTestOptions>
  ): DetailedHitTestResult[] {
    return points.map(point => this.hitTestAtScreen(point, elements, options));
  }

  /**
   * Hit test within a rectangle (for selection)
   */
  hitTestRectangle(
    screenRect: Rectangle,
    elements: DiagramElement[],
    options?: Partial<HitTestOptions>
  ): DiagramElement[] {
    const config = { ...this.defaultOptions, ...options };
    const worldRect = this.viewportManager.screenRectToWorld(screenRect);
    
    const filteredElements = this.filterElements(elements, config);
    const hits: DiagramElement[] = [];

    for (const element of filteredElements) {
      if (this.elementIntersectsRectangle(element, worldRect)) {
        hits.push(element);
      }
    }

    return hits;
  }

  /**
   * Get elements within a certain distance from a point
   */
  getElementsNear(
    worldPoint: WorldCoordinates,
    distance: number,
    elements: DiagramElement[],
    options?: Partial<HitTestOptions>
  ): Array<{ element: DiagramElement; distance: number }> {
    const config = { ...this.defaultOptions, ...options };
    const filteredElements = this.filterElements(elements, config);
    const nearby: Array<{ element: DiagramElement; distance: number }> = [];

    for (const element of filteredElements) {
      const elementDistance = this.getDistanceToElement(element, worldPoint);
      if (elementDistance <= distance) {
        nearby.push({ element, distance: elementDistance });
      }
    }

    // Sort by distance (closest first)
    return nearby.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Test if a point is within element bounds
   */
  private testElement(
    element: DiagramElement,
    worldPoint: WorldCoordinates,
    config: Required<HitTestOptions>
  ): HitTestResult {
    switch (element.type) {
      case 'sticky_note':
        return this.testStickyNote(element as StickyNote, worldPoint, config);
      case 'connector':
        return this.testConnector(element as Connector, worldPoint, config);
      default:
        return {
          element: undefined,
          layer: RenderLayer.BACKGROUND,
          distance: Infinity,
        };
    }
  }

  /**
   * Test sticky note element
   */
  private testStickyNote(
    element: StickyNote,
    worldPoint: WorldCoordinates,
    config: Required<HitTestOptions>
  ): HitTestResult {
    const { position, size, rotation = 0 } = element;
    
    // Transform point if element is rotated
    const testPoint = rotation !== 0 
      ? this.rotatePoint(worldPoint, position, -rotation)
      : worldPoint;

    // Test element bounds with tolerance
    const bounds = {
      x: position.x - config.tolerance,
      y: position.y - config.tolerance,
      width: size.width + config.tolerance * 2,
      height: size.height + config.tolerance * 2,
    };

    if (this.pointInRectangle(testPoint, bounds)) {
      // Check for connection point hits (higher priority)
      for (const connectionPoint of element.connectionPoints) {
        const cpDistance = this.getDistance(worldPoint, connectionPoint.position);
        if (cpDistance <= config.tolerance + 5) { // Connection points have larger hit area
          return {
            element,
            connectionPoint: connectionPoint.id,
            layer: RenderLayer.CONNECTORS,
            distance: cpDistance,
          };
        }
      }

      // Check for resize handles if element is selected
      const handleResult = this.testResizeHandles(element, worldPoint, config.tolerance);
      if (handleResult.handle) {
        return handleResult;
      }

      // Regular element hit
      const distance = this.getDistanceToRectangle(worldPoint, {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      });

      return {
        element,
        layer: RenderLayer.ELEMENTS,
        distance,
      };
    }

    return {
      element: undefined,
      layer: RenderLayer.BACKGROUND,
      distance: Infinity,
    };
  }

  /**
   * Test connector element
   */
  private testConnector(
    element: Connector,
    worldPoint: WorldCoordinates,
    config: Required<HitTestOptions>
  ): HitTestResult {
    const { points, style } = element;
    const strokeWidth = style.strokeWidth;
    const hitTolerance = Math.max(config.tolerance, strokeWidth / 2 + 2);

    // Test line segments between points
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const distance = this.getDistanceToLineSegment(worldPoint, start, end);

      if (distance <= hitTolerance) {
        return {
          element,
          layer: RenderLayer.ELEMENTS,
          distance,
        };
      }
    }

    // Test control points for bezier curves
    for (const point of points) {
      const distance = this.getDistance(worldPoint, point);
      if (distance <= config.tolerance + 3) {
        return {
          element,
          handle: 'control-point',
          layer: RenderLayer.HANDLES,
          distance,
        };
      }
    }

    return {
      element: undefined,
      layer: RenderLayer.BACKGROUND,
      distance: Infinity,
    };
  }

  /**
   * Test resize handles for an element
   */
  private testResizeHandles(
    element: DiagramElement,
    worldPoint: WorldCoordinates,
    tolerance: number
  ): HitTestResult {
    const { position, size } = element;
    const handleSize = 6; // Handle size in screen pixels
    const handleTolerance = tolerance + handleSize / 2;

    // Corner handles
    const handles = [
      { id: 'nw', pos: { x: position.x, y: position.y } },
      { id: 'ne', pos: { x: position.x + size.width, y: position.y } },
      { id: 'sw', pos: { x: position.x, y: position.y + size.height } },
      { id: 'se', pos: { x: position.x + size.width, y: position.y + size.height } },
      // Edge handles
      { id: 'n', pos: { x: position.x + size.width / 2, y: position.y } },
      { id: 's', pos: { x: position.x + size.width / 2, y: position.y + size.height } },
      { id: 'w', pos: { x: position.x, y: position.y + size.height / 2 } },
      { id: 'e', pos: { x: position.x + size.width, y: position.y + size.height / 2 } },
    ];

    for (const handle of handles) {
      const distance = this.getDistance(worldPoint, handle.pos);
      if (distance <= handleTolerance) {
        return {
          element,
          handle: handle.id,
          layer: RenderLayer.HANDLES,
          distance,
        };
      }
    }

    return {
      element: undefined,
      layer: RenderLayer.BACKGROUND,
      distance: Infinity,
    };
  }

  /**
   * Filter elements based on options
   */
  private filterElements(
    elements: DiagramElement[],
    config: Required<HitTestOptions>
  ): DiagramElement[] {
    return elements.filter(element => {
      if (!config.includeInvisible && element.visible === false) {
        return false;
      }
      if (!config.includeLocked && element.locked === true) {
        return false;
      }
      return config.filter(element);
    });
  }

  /**
   * Sort elements by hit test priority
   */
  private sortElementsByPriority(elements: DiagramElement[]): DiagramElement[] {
    return elements.sort((a, b) => {
      // Higher z-index first
      if (a.zIndex !== b.zIndex) {
        return b.zIndex - a.zIndex;
      }
      // Smaller elements first (more specific)
      const aArea = a.size.width * a.size.height;
      const bArea = b.size.width * b.size.height;
      return aArea - bArea;
    });
  }

  /**
   * Check if point is within rectangle
   */
  private pointInRectangle(point: Point, rect: Rectangle): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  /**
   * Check if element intersects with rectangle
   */
  private elementIntersectsRectangle(element: DiagramElement, rect: Rectangle): boolean {
    const elementRect = {
      x: element.position.x,
      y: element.position.y,
      width: element.size.width,
      height: element.size.height,
    };

    return this.rectanglesIntersect(elementRect, rect);
  }

  /**
   * Check if two rectangles intersect
   */
  private rectanglesIntersect(rect1: Rectangle, rect2: Rectangle): boolean {
    return !(
      rect1.x + rect1.width < rect2.x ||
      rect2.x + rect2.width < rect1.x ||
      rect1.y + rect1.height < rect2.y ||
      rect2.y + rect2.height < rect1.y
    );
  }

  /**
   * Calculate distance between two points
   */
  private getDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate distance from point to rectangle
   */
  private getDistanceToRectangle(point: Point, rect: Rectangle): number {
    const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
    const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate distance from point to element
   */
  private getDistanceToElement(element: DiagramElement, point: Point): number {
    switch (element.type) {
      case 'sticky_note':
        return this.getDistanceToRectangle(point, {
          x: element.position.x,
          y: element.position.y,
          width: element.size.width,
          height: element.size.height,
        });
      case 'connector':
        // Find minimum distance to any line segment
        let minDistance = Infinity;
        for (let i = 0; i < element.points.length - 1; i++) {
          const distance = this.getDistanceToLineSegment(
            point,
            element.points[i],
            element.points[i + 1]
          );
          minDistance = Math.min(minDistance, distance);
        }
        return minDistance;
      default:
        return Infinity;
    }
  }

  /**
   * Calculate distance from point to line segment
   */
  private getDistanceToLineSegment(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
      return this.getDistance(point, lineStart);
    }

    const t = Math.max(0, Math.min(1, 
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (length * length)
    ));

    const projection = {
      x: lineStart.x + t * dx,
      y: lineStart.y + t * dy,
    };

    return this.getDistance(point, projection);
  }

  /**
   * Rotate point around center
   */
  private rotatePoint(point: Point, center: Point, angle: number): Point {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.x - center.x;
    const dy = point.y - center.y;

    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  }

  /**
   * Update viewport manager reference
   */
  updateViewportManager(viewportManager: ViewportManager): void {
    this.viewportManager = viewportManager;
  }

  /**
   * Update default options
   */
  updateOptions(options: Partial<HitTestOptions>): void {
    Object.assign(this.defaultOptions, options);
  }
}

/**
 * Hit tester utility functions
 */
export const hitTestUtils = {
  /**
   * Create hit test tolerance based on zoom level
   */
  getZoomAdjustedTolerance(baseTolerance: number, zoomLevel: number): number {
    // Increase tolerance when zoomed out, decrease when zoomed in
    return baseTolerance / Math.sqrt(zoomLevel);
  },

  /**
   * Check if hit test result indicates a handle
   */
  isHandleHit(result: HitTestResult): boolean {
    return result.layer === RenderLayer.HANDLES && !!result.handle;
  },

  /**
   * Check if hit test result indicates a connection point
   */
  isConnectionPointHit(result: HitTestResult): boolean {
    return result.layer === RenderLayer.CONNECTORS && !!result.connectionPoint;
  },

  /**
   * Check if hit test result indicates an element
   */
  isElementHit(result: HitTestResult): boolean {
    return !!result.element && result.layer === RenderLayer.ELEMENTS;
  },

  /**
   * Get cursor style based on hit test result
   */
  getCursorForHitResult(result: HitTestResult): string {
    if (result.handle) {
      switch (result.handle) {
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

    if (result.connectionPoint) {
      return 'crosshair';
    }

    if (result.element) {
      return 'move';
    }

    return 'default';
  },
};