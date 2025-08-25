/**
 * Canvas viewport management system
 * Handles coordinate transformations, pan/zoom operations, and viewport state management
 */

import type { Viewport, ScreenCoordinates, WorldCoordinates, CanvasBounds } from '@/types/canvas';
import type { Point, Rectangle, Size } from '@/types/common';
import type { DiagramElement } from '@/types/elements';

/**
 * Configuration for viewport animations
 */
export interface ViewportAnimationConfig {
  /** Duration of animation in milliseconds */
  duration: number;
  /** Easing function for smooth animations */
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

/**
 * Default animation configuration
 */
export const DEFAULT_ANIMATION_CONFIG: ViewportAnimationConfig = {
  duration: 300,
  easing: 'ease-out',
};

/**
 * Viewport constraints for limiting pan and zoom operations
 */
export interface ViewportConstraints {
  /** Maximum distance from origin for panning */
  maxPanDistance?: number;
  /** Minimum viewport size to maintain visibility */
  minVisibleArea?: Size;
  /** Snap to grid when zooming */
  snapToGrid?: boolean;
  /** Grid size for snapping */
  gridSize?: number;
}

/**
 * Result of a zoom operation including center point preservation
 */
export interface ZoomResult {
  /** New zoom level */
  zoom: number;
  /** New offset to maintain center point */
  offset: Point;
  /** Whether zoom limits were reached */
  limited: boolean;
}

/**
 * Pan operation result with constraint handling
 */
export interface PanResult {
  /** New offset position */
  offset: Point;
  /** Whether pan was constrained */
  constrained: boolean;
}

/**
 * Viewport utilities for coordinate transformations and operations
 */
export class ViewportManager {
  private viewport: Viewport;
  private constraints: ViewportConstraints | undefined;
  private animationId?: number;

  constructor(viewport: Viewport, constraints?: ViewportConstraints) {
    this.viewport = { ...viewport };
    this.constraints = constraints;
  }

  /**
   * Update the viewport state
   */
  setViewport(newViewport: Viewport): void {
    this.viewport = { ...newViewport };
    this.updateVisibleArea();
  }

  /**
   * Get current viewport state
   */
  getViewport(): Viewport {
    return { ...this.viewport };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenPoint: ScreenCoordinates): WorldCoordinates {
    const { zoom, offset } = this.viewport;
    return {
      x: (screenPoint.x - offset.x) / zoom,
      y: (screenPoint.y - offset.y) / zoom,
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldPoint: WorldCoordinates): ScreenCoordinates {
    const { zoom, offset } = this.viewport;
    return {
      x: worldPoint.x * zoom + offset.x,
      y: worldPoint.y * zoom + offset.y,
    };
  }

  /**
   * Convert a world rectangle to screen rectangle
   */
  worldRectToScreen(worldRect: Rectangle): Rectangle {
    const topLeft = this.worldToScreen({ x: worldRect.x, y: worldRect.y });
    const { zoom } = this.viewport;

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: worldRect.width * zoom,
      height: worldRect.height * zoom,
    };
  }

  /**
   * Convert a screen rectangle to world rectangle
   */
  screenRectToWorld(screenRect: Rectangle): Rectangle {
    const topLeft = this.screenToWorld({ x: screenRect.x, y: screenRect.y });
    const { zoom } = this.viewport;

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: screenRect.width / zoom,
      height: screenRect.height / zoom,
    };
  }

  /**
   * Zoom in by a specified factor, maintaining center point
   */
  zoomIn(factor: number = 1.2, centerPoint?: ScreenCoordinates): ZoomResult {
    const center = centerPoint || this.getViewportCenter();
    return this.zoomAtPoint(this.viewport.zoom * factor, center);
  }

  /**
   * Zoom out by a specified factor, maintaining center point
   */
  zoomOut(factor: number = 1.2, centerPoint?: ScreenCoordinates): ZoomResult {
    const center = centerPoint || this.getViewportCenter();
    return this.zoomAtPoint(this.viewport.zoom / factor, center);
  }

  /**
   * Set zoom to a specific level at a given point
   */
  zoomAtPoint(newZoom: number, centerPoint: ScreenCoordinates): ZoomResult {
    const { zoom, offset, minZoom, maxZoom } = this.viewport;

    // Apply zoom limits
    const limitedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
    const limited = limitedZoom !== newZoom;

    if (limitedZoom === zoom) {
      return { zoom, offset, limited };
    }

    // Convert center point to world coordinates at current zoom
    const worldCenter = this.screenToWorld(centerPoint);

    // Calculate new offset to maintain the same world point at the center
    const newOffset = {
      x: centerPoint.x - worldCenter.x * limitedZoom,
      y: centerPoint.y - worldCenter.y * limitedZoom,
    };

    // Apply constraints if any
    const constrainedOffset = this.applyPanConstraints(newOffset);

    this.viewport.zoom = limitedZoom;
    this.viewport.offset = constrainedOffset.offset;
    this.updateVisibleArea();

    return {
      zoom: limitedZoom,
      offset: constrainedOffset.offset,
      limited: limited || constrainedOffset.constrained,
    };
  }

  /**
   * Reset zoom to 100% and center the viewport
   */
  resetZoom(): ZoomResult {
    const center = this.getViewportCenter();
    return this.zoomAtPoint(1.0, center);
  }

  /**
   * Zoom to fit all elements within the viewport with padding
   */
  zoomToFitElements(elements: DiagramElement[], padding: number = 50): ZoomResult {
    if (elements.length === 0) {
      return this.resetZoom();
    }

    const bounds = this.calculateElementsBounds(elements);
    return this.zoomToFitBounds(bounds, padding);
  }

  /**
   * Zoom to fit a specific bounds within the viewport
   */
  zoomToFitBounds(bounds: Rectangle, padding: number = 50): ZoomResult {
    const { size, maxZoom, minZoom } = this.viewport;

    // Calculate the scale needed to fit the bounds
    const availableWidth = size.width - padding * 2;
    const availableHeight = size.height - padding * 2;

    const scaleX = availableWidth / bounds.width;
    const scaleY = availableHeight / bounds.height;
    const scale = Math.min(scaleX, scaleY);

    // Apply zoom limits
    const limitedZoom = Math.max(minZoom, Math.min(maxZoom, scale));

    // Calculate center of bounds
    const boundsCenter: WorldCoordinates = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };

    // Calculate new offset to center the bounds
    const newOffset = {
      x: size.width / 2 - boundsCenter.x * limitedZoom,
      y: size.height / 2 - boundsCenter.y * limitedZoom,
    };

    // Apply constraints
    const constrainedOffset = this.applyPanConstraints(newOffset);

    this.viewport.zoom = limitedZoom;
    this.viewport.offset = constrainedOffset.offset;
    this.updateVisibleArea();

    return {
      zoom: limitedZoom,
      offset: constrainedOffset.offset,
      limited: scale !== limitedZoom || constrainedOffset.constrained,
    };
  }

  /**
   * Pan the viewport by a delta amount
   */
  panBy(delta: Point): PanResult {
    const newOffset = {
      x: this.viewport.offset.x + delta.x,
      y: this.viewport.offset.y + delta.y,
    };

    return this.panTo(newOffset);
  }

  /**
   * Pan the viewport to a specific offset
   */
  panTo(newOffset: Point): PanResult {
    const constrainedResult = this.applyPanConstraints(newOffset);

    this.viewport.offset = constrainedResult.offset;
    this.updateVisibleArea();

    return constrainedResult;
  }

  /**
   * Pan to center a specific world point in the viewport
   */
  panToWorldPoint(worldPoint: WorldCoordinates): PanResult {
    const { size, zoom } = this.viewport;

    const newOffset = {
      x: size.width / 2 - worldPoint.x * zoom,
      y: size.height / 2 - worldPoint.y * zoom,
    };

    return this.panTo(newOffset);
  }

  /**
   * Check if a world rectangle is visible in the current viewport
   */
  isRectVisible(worldRect: Rectangle): boolean {
    const { visibleArea } = this.viewport;

    return !(
      worldRect.x + worldRect.width < visibleArea.x ||
      worldRect.x > visibleArea.x + visibleArea.width ||
      worldRect.y + worldRect.height < visibleArea.y ||
      worldRect.y > visibleArea.y + visibleArea.height
    );
  }

  /**
   * Check if a world point is visible in the current viewport
   */
  isPointVisible(worldPoint: WorldCoordinates): boolean {
    const { visibleArea } = this.viewport;

    return (
      worldPoint.x >= visibleArea.x &&
      worldPoint.x <= visibleArea.x + visibleArea.width &&
      worldPoint.y >= visibleArea.y &&
      worldPoint.y <= visibleArea.y + visibleArea.height
    );
  }

  /**
   * Get elements that are visible in the current viewport
   */
  getVisibleElements(elements: DiagramElement[]): DiagramElement[] {
    return elements.filter((element) =>
      this.isRectVisible({
        x: element.position.x,
        y: element.position.y,
        width: element.size.width,
        height: element.size.height,
      })
    );
  }

  /**
   * Calculate bounds that contain all given elements
   */
  calculateElementsBounds(elements: DiagramElement[]): Rectangle {
    if (elements.length === 0) {
      return { x: 0, y: 0, width: 100, height: 100 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    elements.forEach((element) => {
      const { position, size } = element;
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + size.width);
      maxY = Math.max(maxY, position.y + size.height);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Update viewport constraints
   */
  setConstraints(constraints?: ViewportConstraints): void {
    this.constraints = constraints;
  }

  /**
   * Get current viewport constraints
   */
  getConstraints(): ViewportConstraints | undefined {
    return this.constraints;
  }

  /**
   * Animate viewport to a new state
   */
  animateToViewport(
    targetViewport: Partial<Viewport>,
    config: ViewportAnimationConfig = DEFAULT_ANIMATION_CONFIG,
    onUpdate?: (viewport: Viewport) => void,
    onComplete?: () => void
  ): void {
    // Cancel existing animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    const startViewport = { ...this.viewport };
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / config.duration, 1);

      // Apply easing function
      const easedProgress = this.applyEasing(progress, config.easing);

      // Interpolate viewport values
      const currentViewport: Viewport = {
        ...startViewport,
        zoom: this.interpolate(
          startViewport.zoom,
          targetViewport.zoom ?? startViewport.zoom,
          easedProgress
        ),
        offset: {
          x: this.interpolate(
            startViewport.offset.x,
            targetViewport.offset?.x ?? startViewport.offset.x,
            easedProgress
          ),
          y: this.interpolate(
            startViewport.offset.y,
            targetViewport.offset?.y ?? startViewport.offset.y,
            easedProgress
          ),
        },
      };

      this.setViewport(currentViewport);
      onUpdate?.(currentViewport);

      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        delete this.animationId;
        onComplete?.();
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Cancel any running animation
   */
  cancelAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      delete this.animationId;
    }
  }

  /**
   * Get the center point of the viewport in screen coordinates
   */
  private getViewportCenter(): ScreenCoordinates {
    const { size } = this.viewport;
    return {
      x: size.width / 2,
      y: size.height / 2,
    };
  }

  /**
   * Apply pan constraints to an offset
   */
  private applyPanConstraints(offset: Point): PanResult {
    if (!this.constraints?.maxPanDistance) {
      return { offset, constrained: false };
    }

    const { maxPanDistance } = this.constraints;
    const distance = Math.sqrt(offset.x * offset.x + offset.y * offset.y);

    if (distance <= maxPanDistance) {
      return { offset, constrained: false };
    }

    // Constrain to maximum distance
    const scale = maxPanDistance / distance;
    return {
      offset: {
        x: offset.x * scale,
        y: offset.y * scale,
      },
      constrained: true,
    };
  }

  /**
   * Update the visible area based on current viewport state
   */
  private updateVisibleArea(): void {
    const { zoom, offset, size } = this.viewport;

    this.viewport.visibleArea = {
      x: -offset.x / zoom,
      y: -offset.y / zoom,
      width: size.width / zoom,
      height: size.height / zoom,
    };
  }

  /**
   * Linear interpolation between two values
   */
  private interpolate(start: number, end: number, progress: number): number {
    return start + (end - start) * progress;
  }

  /**
   * Apply easing function to progress
   */
  private applyEasing(progress: number, easing: ViewportAnimationConfig['easing']): number {
    switch (easing) {
      case 'linear':
        return progress;
      case 'ease-in':
        return progress * progress;
      case 'ease-out':
        return 1 - Math.pow(1 - progress, 2);
      case 'ease-in-out':
        return progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      default:
        return progress;
    }
  }
}

/**
 * Utility functions for viewport operations
 */
export const viewportUtils = {
  /**
   * Create a new viewport with default values
   */
  createViewport(options?: Partial<Viewport>): Viewport {
    return {
      zoom: 1.0,
      minZoom: 0.1,
      maxZoom: 5.0,
      offset: { x: 0, y: 0 },
      size: { width: 800, height: 600 },
      visibleArea: { x: 0, y: 0, width: 800, height: 600 },
      ...options,
    };
  },

  /**
   * Check if two viewports are equal
   */
  areViewportsEqual(a: Viewport, b: Viewport): boolean {
    return (
      a.zoom === b.zoom &&
      a.minZoom === b.minZoom &&
      a.maxZoom === b.maxZoom &&
      a.offset.x === b.offset.x &&
      a.offset.y === b.offset.y &&
      a.size.width === b.size.width &&
      a.size.height === b.size.height
    );
  },

  /**
   * Clone a viewport
   */
  cloneViewport(viewport: Viewport): Viewport {
    return {
      ...viewport,
      offset: { ...viewport.offset },
      size: { ...viewport.size },
      visibleArea: { ...viewport.visibleArea },
    };
  },

  /**
   * Convert screen coordinates to world coordinates (static version)
   */
  screenToWorld(screenPoint: ScreenCoordinates, viewport: Viewport): WorldCoordinates {
    const { zoom, offset } = viewport;
    return {
      x: (screenPoint.x - offset.x) / zoom,
      y: (screenPoint.y - offset.y) / zoom,
    };
  },

  /**
   * Convert world coordinates to screen coordinates (static version)
   */
  worldToScreen(worldPoint: WorldCoordinates, viewport: Viewport): ScreenCoordinates {
    const { zoom, offset } = viewport;
    return {
      x: worldPoint.x * zoom + offset.x,
      y: worldPoint.y * zoom + offset.y,
    };
  },

  /**
   * Calculate visible area from viewport state
   */
  calculateVisibleArea(viewport: Viewport): Rectangle {
    const { zoom, offset, size } = viewport;
    return {
      x: -offset.x / zoom,
      y: -offset.y / zoom,
      width: size.width / zoom,
      height: size.height / zoom,
    };
  },

  /**
   * Check if a point is within canvas bounds
   */
  isWithinBounds(point: Point, bounds: CanvasBounds): boolean {
    const padding = bounds.padding || 0;
    return (
      point.x >= bounds.x - padding &&
      point.x <= bounds.x + bounds.width + padding &&
      point.y >= bounds.y - padding &&
      point.y <= bounds.y + bounds.height + padding
    );
  },

  /**
   * Constrain a rectangle to fit within bounds
   */
  constrainToBounds(rect: Rectangle, bounds: CanvasBounds): Rectangle {
    const padding = bounds.padding || 0;
    const minX = bounds.x - padding;
    const minY = bounds.y - padding;
    const maxX = bounds.x + bounds.width + padding;
    const maxY = bounds.y + bounds.height + padding;

    return {
      x: Math.max(minX, Math.min(maxX - rect.width, rect.x)),
      y: Math.max(minY, Math.min(maxY - rect.height, rect.y)),
      width: Math.min(rect.width, maxX - minX),
      height: Math.min(rect.height, maxY - minY),
    };
  },
};

/**
 * Create a viewport manager instance
 */
export function createViewportManager(
  viewport: Viewport,
  constraints?: ViewportConstraints
): ViewportManager {
  return new ViewportManager(viewport, constraints);
}

/**
 * Export default viewport configuration
 */
export const DEFAULT_VIEWPORT: Viewport = {
  zoom: 1.0,
  minZoom: 0.1,
  maxZoom: 5.0,
  offset: { x: 0, y: 0 },
  size: { width: 800, height: 600 },
  visibleArea: { x: 0, y: 0, width: 800, height: 600 },
};
