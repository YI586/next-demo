/**
 * Performance optimization system for canvas rendering
 * Handles viewport culling, dirty regions, and render scheduling
 */

import type { DiagramElement } from '@/types/elements';
import type { CanvasPerformanceMetrics } from '@/types/canvas';
import type { Rectangle } from '@/types/common';

import type { ViewportManager } from '../viewport';

/**
 * Performance optimization configuration
 */
export interface PerformanceConfig {
  /** Enable viewport culling */
  enableCulling: boolean;
  /** Enable dirty region optimization */
  enableDirtyRegions: boolean;
  /** Enable render scheduling based on frame budget */
  enableRenderScheduling: boolean;
  /** Target frame rate (fps) */
  targetFrameRate: number;
  /** Maximum render time per frame (ms) */
  maxFrameTime: number;
  /** Culling margin (extends viewport for preloading) */
  cullingMargin: number;
  /** Dirty region merge threshold */
  dirtyRegionMergeThreshold: number;
  /** Enable level-of-detail rendering */
  enableLOD: boolean;
  /** LOD zoom thresholds */
  lodZoomThresholds: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Default performance configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enableCulling: true,
  enableDirtyRegions: true,
  enableRenderScheduling: true,
  targetFrameRate: 60,
  maxFrameTime: 16, // ~60fps
  cullingMargin: 100,
  dirtyRegionMergeThreshold: 50,
  enableLOD: true,
  lodZoomThresholds: {
    high: 1.0,
    medium: 0.5,
    low: 0.25,
  },
};

/**
 * Dirty region for tracking areas that need re-rendering
 */
export interface DirtyRegion extends Rectangle {
  /** Priority level (higher = render first) */
  priority: number;
  /** Timestamp when region was marked dirty */
  timestamp: number;
  /** Elements that caused this region to be dirty */
  elements: Set<string>;
}

/**
 * Level of detail for rendering
 */
export enum RenderLOD {
  HIGH = 'high',
  MEDIUM = 'medium', 
  LOW = 'low',
  MINIMAL = 'minimal',
}


/**
 * Performance metrics tracker
 */
class PerformanceTracker {
  private metrics: CanvasPerformanceMetrics;
  private frameStartTime = 0;
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private renderTimes: number[] = [];
  private maxSampleSize = 100;

  constructor() {
    this.metrics = {
      renderTime: 0,
      elementCount: 0,
      visibleElementCount: 0,
      frameRate: 0,
    };
  }

  startFrame(): void {
    this.frameStartTime = performance.now();
  }

  endFrame(elementCount: number, visibleElementCount: number): void {
    const renderTime = performance.now() - this.frameStartTime;
    
    // Update render times with moving average
    this.renderTimes.push(renderTime);
    if (this.renderTimes.length > this.maxSampleSize) {
      this.renderTimes.shift();
    }

    // Calculate average render time
    const avgRenderTime = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;

    // Update metrics
    this.metrics.renderTime = avgRenderTime;
    this.metrics.elementCount = elementCount;
    this.metrics.visibleElementCount = visibleElementCount;

    // Update frame rate every second
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.metrics.frameRate = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  getMetrics(): CanvasPerformanceMetrics {
    return { ...this.metrics };
  }

  isPerformanceGood(config: PerformanceConfig): boolean {
    return this.metrics.renderTime <= config.maxFrameTime;
  }
}

/**
 * Performance optimizer for canvas rendering
 */
export class PerformanceOptimizer {
  private config: PerformanceConfig;
  private viewportManager: ViewportManager;
  private tracker: PerformanceTracker;
  private dirtyRegions: DirtyRegion[] = [];
  private elementRenderTimes = new Map<string, number>();

  constructor(viewportManager: ViewportManager, config: PerformanceConfig = DEFAULT_PERFORMANCE_CONFIG) {
    this.viewportManager = viewportManager;
    this.config = { ...config };
    this.tracker = new PerformanceTracker();
  }

  /**
   * Optimize elements for rendering based on viewport and performance constraints
   */
  optimizeForRender(elements: DiagramElement[]): DiagramElement[] {
    this.tracker.startFrame();

    let optimizedElements = elements;

    // Apply viewport culling
    if (this.config.enableCulling) {
      optimizedElements = this.cullElements(optimizedElements);
    }

    // Apply level-of-detail filtering
    if (this.config.enableLOD) {
      optimizedElements = this.applyLevelOfDetail(optimizedElements);
    }

    // Sort by render priority
    optimizedElements = this.sortByRenderPriority(optimizedElements);

    // Apply render scheduling if needed
    if (this.config.enableRenderScheduling && !this.tracker.isPerformanceGood(this.config)) {
      optimizedElements = this.scheduleRendering(optimizedElements);
    }

    return optimizedElements;
  }

  /**
   * Cull elements outside viewport
   */
  private cullElements(elements: DiagramElement[]): DiagramElement[] {
    const viewport = this.viewportManager.getViewport();
    const { visibleArea } = viewport;
    const margin = this.config.cullingMargin;

    const cullingBounds: Rectangle = {
      x: visibleArea.x - margin,
      y: visibleArea.y - margin,
      width: visibleArea.width + margin * 2,
      height: visibleArea.height + margin * 2,
    };

    return elements.filter(element => {
      const elementBounds = {
        x: element.position.x,
        y: element.position.y,
        width: element.size.width,
        height: element.size.height,
      };

      return this.rectanglesIntersect(elementBounds, cullingBounds);
    });
  }

  /**
   * Apply level-of-detail based on zoom level
   */
  private applyLevelOfDetail(elements: DiagramElement[]): DiagramElement[] {
    const {zoom} = this.viewportManager.getViewport();
    const lod = this.getLevelOfDetail(zoom);

    switch (lod) {
      case RenderLOD.MINIMAL:
        // Only render largest elements
        return elements.filter(el => {
          const area = el.size.width * el.size.height;
          return area > 10000; // Only large elements
        });

      case RenderLOD.LOW:
        // Skip small details, simplified rendering
        return elements.filter(el => {
          const area = el.size.width * el.size.height;
          return area > 1000;
        });

      case RenderLOD.MEDIUM:
        // Skip very small elements
        return elements.filter(el => {
          const area = el.size.width * el.size.height;
          return area > 100;
        });

      case RenderLOD.HIGH:
      default:
        return elements; // Render all elements
    }
  }

  /**
   * Sort elements by render priority
   */
  private sortByRenderPriority(elements: DiagramElement[]): DiagramElement[] {
    return [...elements].sort((a, b) => {
      // Primary sort: z-index
      const zDiff = (a.zIndex || 0) - (b.zIndex || 0);
      if (zDiff !== 0) {return zDiff;}

      // Secondary sort: element type (connectors first)
      if (a.type === 'connector' && b.type !== 'connector') {return -1;}
      if (b.type === 'connector' && a.type !== 'connector') {return 1;}

      // Tertiary sort: creation time (newer first for same z-index)
      return b.createdAt - a.createdAt;
    });
  }

  /**
   * Schedule rendering based on performance constraints
   */
  private scheduleRendering(elements: DiagramElement[]): DiagramElement[] {
    const availableTime = this.config.maxFrameTime - this.tracker.getMetrics().renderTime;
    if (availableTime <= 0) {
      // Skip rendering if no time available
      return [];
    }

    const scheduledElements: DiagramElement[] = [];
    let estimatedTime = 0;

    for (const element of elements) {
      const elementTime = this.getElementRenderTime(element);
      if (estimatedTime + elementTime <= availableTime) {
        scheduledElements.push(element);
        estimatedTime += elementTime;
      } else {
        break; // No more time available
      }
    }

    return scheduledElements;
  }

  /**
   * Get level of detail based on zoom level
   */
  private getLevelOfDetail(zoom: number): RenderLOD {
    const { lodZoomThresholds } = this.config;

    if (zoom >= lodZoomThresholds.high) {
      return RenderLOD.HIGH;
    } else if (zoom >= lodZoomThresholds.medium) {
      return RenderLOD.MEDIUM;
    } else if (zoom >= lodZoomThresholds.low) {
      return RenderLOD.LOW;
    } 
      return RenderLOD.MINIMAL;
    
  }

  /**
   * Estimate render time for an element
   */
  private getElementRenderTime(element: DiagramElement): number {
    // Use historical data if available
    const historicalTime = this.elementRenderTimes.get(element.id);
    if (historicalTime) {
      return historicalTime;
    }

    // Estimate based on element type and size
    const baseTime = element.type === 'connector' ? 0.5 : 1.0; // ms
    const sizeMultiplier = (element.size.width * element.size.height) / 10000;
    return baseTime * (1 + sizeMultiplier);
  }

  /**
   * Record actual render time for an element
   */
  recordElementRenderTime(elementId: string, renderTime: number): void {
    // Use exponential moving average
    const existing = this.elementRenderTimes.get(elementId) || renderTime;
    const alpha = 0.2;
    this.elementRenderTimes.set(elementId, existing * (1 - alpha) + renderTime * alpha);
  }

  /**
   * Add dirty region
   */
  addDirtyRegion(region: Rectangle, priority = 1, elementIds: string[] = []): void {
    if (!this.config.enableDirtyRegions) {return;}

    const dirtyRegion: DirtyRegion = {
      ...region,
      priority,
      timestamp: performance.now(),
      elements: new Set(elementIds),
    };

    // Try to merge with existing regions
    const merged = this.tryMergeDirtyRegion(dirtyRegion);
    if (!merged) {
      this.dirtyRegions.push(dirtyRegion);
    }

    // Clean up old regions
    this.cleanupDirtyRegions();
  }

  /**
   * Get dirty regions for rendering
   */
  getDirtyRegions(): DirtyRegion[] {
    return [...this.dirtyRegions].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Clear dirty regions
   */
  clearDirtyRegions(): void {
    this.dirtyRegions = [];
  }

  /**
   * Try to merge dirty region with existing ones
   */
  private tryMergeDirtyRegion(newRegion: DirtyRegion): boolean {
    for (let i = 0; i < this.dirtyRegions.length; i++) {
      const existing = this.dirtyRegions[i];
      
      if (existing && this.shouldMergeDirtyRegions(existing, newRegion)) {
        // Merge regions
        const merged = this.mergeDirtyRegions(existing, newRegion);
        this.dirtyRegions[i] = merged;
        return true;
      }
    }
    return false;
  }

  /**
   * Check if two dirty regions should be merged
   */
  private shouldMergeDirtyRegions(a: DirtyRegion, b: DirtyRegion): boolean {
    const distance = this.getRegionDistance(a, b);
    return distance <= this.config.dirtyRegionMergeThreshold;
  }

  /**
   * Merge two dirty regions
   */
  private mergeDirtyRegions(a: DirtyRegion, b: DirtyRegion): DirtyRegion {
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x + a.width, b.x + b.width);
    const maxY = Math.max(a.y + a.height, b.y + b.height);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      priority: Math.max(a.priority, b.priority),
      timestamp: Math.min(a.timestamp, b.timestamp),
      elements: new Set([...a.elements, ...b.elements]),
    };
  }

  /**
   * Get distance between two regions
   */
  private getRegionDistance(a: Rectangle, b: Rectangle): number {
    const aCenterX = a.x + a.width / 2;
    const aCenterY = a.y + a.height / 2;
    const bCenterX = b.x + b.width / 2;
    const bCenterY = b.y + b.height / 2;

    const dx = aCenterX - bCenterX;
    const dy = aCenterY - bCenterY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Clean up old dirty regions
   */
  private cleanupDirtyRegions(): void {
    const now = performance.now();
    const maxAge = 1000; // 1 second

    this.dirtyRegions = this.dirtyRegions.filter(region => {
      return now - region.timestamp <= maxAge;
    });
  }

  /**
   * Check if two rectangles intersect
   */
  private rectanglesIntersect(a: Rectangle, b: Rectangle): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    );
  }

  /**
   * Update performance tracker after rendering
   */
  updatePerformanceMetrics(elementCount: number, visibleElementCount: number): void {
    this.tracker.endFrame(elementCount, visibleElementCount);
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): CanvasPerformanceMetrics {
    return this.tracker.getMetrics();
  }

  /**
   * Update configuration
   */
  setConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Check if performance optimization is enabled
   */
  isOptimizationEnabled(feature: keyof PerformanceConfig): boolean {
    return !!this.config[feature];
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    cullingEnabled: boolean;
    dirtyRegionsEnabled: boolean;
    schedulingEnabled: boolean;
    currentLOD: RenderLOD;
    dirtyRegionCount: number;
    avgRenderTime: number;
    frameRate: number;
  } {
    const {zoom} = this.viewportManager.getViewport();
    const metrics = this.tracker.getMetrics();

    return {
      cullingEnabled: this.config.enableCulling,
      dirtyRegionsEnabled: this.config.enableDirtyRegions,
      schedulingEnabled: this.config.enableRenderScheduling,
      currentLOD: this.getLevelOfDetail(zoom),
      dirtyRegionCount: this.dirtyRegions.length,
      avgRenderTime: metrics.renderTime,
      frameRate: metrics.frameRate,
    };
  }

  /**
   * Reset all optimization state
   */
  reset(): void {
    this.dirtyRegions = [];
    this.elementRenderTimes.clear();
    this.tracker = new PerformanceTracker();
  }
}

/**
 * Create a performance optimizer
 */
export function createPerformanceOptimizer(
  viewportManager: ViewportManager,
  config?: Partial<PerformanceConfig>
): PerformanceOptimizer {
  const optimizerConfig = config ? { ...DEFAULT_PERFORMANCE_CONFIG, ...config } : DEFAULT_PERFORMANCE_CONFIG;
  return new PerformanceOptimizer(viewportManager, optimizerConfig);
}