/**
 * Main rendering engine that orchestrates all rendering subsystems
 * Integrates viewport management, layer rendering, element renderers, and performance optimization
 */

import type {
  CanvasRenderContext,
  CanvasPerformanceMetrics,
} from '@/types/canvas';
import { RenderLayer } from '@/types/canvas';
import type { DiagramElement } from '@/types/elements';
import type { Rectangle } from '@/types/common';

import type { ViewportManager } from '../viewport';

import { CanvasRenderer, type RenderConfig, type RenderResult } from './renderer';
import { LayerManager, type LayerConfig } from './layer-manager';
import { ElementRendererFactory } from './element-renderers';
import { PerformanceOptimizer, type PerformanceConfig } from './performance-optimizer';

/**
 * Render engine configuration
 */
export interface RenderEngineConfig {
  /** Renderer configuration */
  renderer: Partial<RenderConfig>;
  /** Layer configurations */
  layers: Partial<Record<RenderLayer, Partial<LayerConfig>>>;
  /** Performance optimization configuration */
  performance: Partial<PerformanceConfig>;
  /** Enable debug mode */
  debug: boolean;
  /** High-DPI scaling factor (auto-detected if not specified) */
  devicePixelRatio?: number;
}

/**
 * Default render engine configuration
 */
export const DEFAULT_RENDER_ENGINE_CONFIG: RenderEngineConfig = {
  renderer: {},
  layers: {},
  performance: {},
  debug: false,
};

/**
 * Render operation statistics
 */
export interface RenderStats {
  /** Total elements processed */
  totalElements: number;
  /** Elements actually rendered */
  renderedElements: number;
  /** Elements culled by optimization */
  culledElements: number;
  /** Elements skipped due to performance */
  skippedElements: number;
  /** Layers rendered */
  layersRendered: number;
  /** Dirty regions processed */
  dirtyRegions: number;
  /** Total render time */
  totalRenderTime: number;
  /** Performance metrics */
  performanceMetrics: CanvasPerformanceMetrics;
  /** Render result per layer */
  layerResults: Record<RenderLayer, RenderResult | null>;
}

/**
 * Main rendering engine class
 */
export class RenderEngine {
  private viewportManager: ViewportManager;
  private renderer: CanvasRenderer;
  private layerManager: LayerManager;
  private elementRenderers: ElementRendererFactory;
  private performanceOptimizer: PerformanceOptimizer;
  private config: RenderEngineConfig;
  private lastRenderStats: RenderStats | null = null;
  private isRendering = false;
  private renderQueue: (() => void)[] = [];

  constructor(
    viewportManager: ViewportManager,
    config: Partial<RenderEngineConfig> = {}
  ) {
    this.viewportManager = viewportManager;
    this.config = { ...DEFAULT_RENDER_ENGINE_CONFIG, ...config };

    // Initialize subsystems with proper configuration merging
    this.renderer = new CanvasRenderer(viewportManager);
    if (this.config.renderer) {
      this.renderer.setConfig(this.config.renderer);
    }
    
    this.layerManager = new LayerManager(this.config.layers);
    this.elementRenderers = new ElementRendererFactory(viewportManager);
    this.performanceOptimizer = new PerformanceOptimizer(viewportManager);
    if (this.config.performance) {
      this.performanceOptimizer.setConfig(this.config.performance);
    }

    if (this.config.debug) {
      this.enableDebugMode();
    }
  }

  /**
   * Main render method - renders complete diagram
   */
  async render(
    canvas: HTMLCanvasElement,
    elements: DiagramElement[],
    selectedElements: Set<string> = new Set()
  ): Promise<RenderStats> {
    if (this.isRendering) {
      // Queue render request if already rendering
      return new Promise((resolve) => {
        this.renderQueue.push(() => {
          this.render(canvas, elements, selectedElements).then(resolve);
        });
      });
    }

    this.isRendering = true;
    const renderStartTime = performance.now();

    try {
      // Setup render context
      const context = this.setupRenderContext(canvas, elements, selectedElements);
      
      // Optimize elements for performance
      const optimizedElements = this.performanceOptimizer.optimizeForRender(elements);
      
      // Get layer render operations
      const layerOps = this.layerManager.getLayerRenderOps(optimizedElements, selectedElements);
      
      // Initialize render stats
      const stats: RenderStats = {
        totalElements: elements.length,
        renderedElements: 0,
        culledElements: elements.length - optimizedElements.length,
        skippedElements: 0,
        layersRendered: 0,
        dirtyRegions: this.performanceOptimizer.getDirtyRegions().length,
        totalRenderTime: 0,
        performanceMetrics: this.performanceOptimizer.getPerformanceMetrics(),
        layerResults: {} as Record<RenderLayer, RenderResult | null>,
      };

      // Clear canvas
      this.clearCanvas(context);

      // Render each layer
      for (const layerOp of layerOps) {
        const layerResult = await this.renderLayer(context, layerOp);
        stats.layerResults[layerOp.layer] = layerResult;
        
        if (layerResult) {
          stats.renderedElements += layerResult.elementsRendered;
          stats.layersRendered++;
        }
      }

      // Update performance metrics
      this.performanceOptimizer.updatePerformanceMetrics(
        stats.totalElements,
        stats.renderedElements
      );

      // Clear dirty regions after successful render
      this.performanceOptimizer.clearDirtyRegions();

      // Calculate total render time
      stats.totalRenderTime = performance.now() - renderStartTime;
      stats.performanceMetrics = this.performanceOptimizer.getPerformanceMetrics();

      // Store last render stats
      this.lastRenderStats = stats;

      if (this.config.debug) {
        this.logRenderStats(stats);
      }

      return stats;

    } catch (error) {
      console.error('Render engine error:', error);
      throw error;
    } finally {
      this.isRendering = false;
      
      // Process queued render requests
      if (this.renderQueue.length > 0) {
        const nextRender = this.renderQueue.shift();
        if (nextRender) {
          setTimeout(nextRender, 0);
        }
      }
    }
  }

  /**
   * Render incremental updates (dirty regions only)
   */
  async renderIncremental(
    canvas: HTMLCanvasElement,
    elements: DiagramElement[],
    selectedElements: Set<string> = new Set()
  ): Promise<RenderStats> {
    const dirtyRegions = this.performanceOptimizer.getDirtyRegions();
    
    if (dirtyRegions.length === 0) {
      // Nothing to render
      return this.createEmptyRenderStats();
    }

    // For now, fall back to full render for incremental updates
    // In a more advanced implementation, we would only render dirty regions
    return this.render(canvas, elements, selectedElements);
  }

  /**
   * Setup render context
   */
  private setupRenderContext(
    canvas: HTMLCanvasElement,
    elements: DiagramElement[],
    selectedElements: Set<string>
  ): CanvasRenderContext {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    const viewport = this.viewportManager.getViewport();
    const devicePixelRatio = this.config.devicePixelRatio ?? window.devicePixelRatio ?? 1;

    return {
      canvas,
      ctx,
      viewport,
      elements,
      selectedElements,
      devicePixelRatio,
    };
  }

  /**
   * Clear canvas
   */
  private clearCanvas(context: CanvasRenderContext): void {
    const { ctx, viewport, devicePixelRatio } = context;
    
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, viewport.size.width * devicePixelRatio, viewport.size.height * devicePixelRatio);
    ctx.restore();
  }

  /**
   * Render a single layer
   */
  private async renderLayer(
    context: CanvasRenderContext,
    layerOp: { layer: RenderLayer; elements: DiagramElement[]; renderData?: any }
  ): Promise<RenderResult | null> {
    const { layer, elements, renderData } = layerOp;
    const layerConfig = this.layerManager.getLayerConfig(layer);
    
    if (!layerConfig.visible) {
      return null;
    }

    const { ctx } = context;
    const layerStartTime = performance.now();

    ctx.save();
    ctx.globalAlpha = layerConfig.opacity;

    let result: RenderResult;

    // Handle different layer types
    switch (layer) {
      case RenderLayer.BACKGROUND:
        result = this.renderBackgroundLayer(context);
        break;

      case RenderLayer.GRID:
        result = this.renderGridLayer(context);
        break;

      case RenderLayer.CONNECTORS:
      case RenderLayer.ELEMENTS:
        result = this.renderElementsLayer(context, elements);
        break;

      case RenderLayer.SELECTION:
        result = this.renderSelectionLayer(context, elements, renderData?.selectedElements);
        break;

      case RenderLayer.HANDLES:
        result = this.renderHandlesLayer(context, elements, renderData?.selectedElements);
        break;

      case RenderLayer.UI_OVERLAY:
        result = this.renderUIOverlayLayer(context);
        break;

      case RenderLayer.TOOLTIP:
        result = this.renderTooltipLayer(context);
        break;

      default:
        console.warn(`Unknown layer type: ${layer}`);
        result = this.createEmptyRenderResult();
    }

    ctx.restore();

    // Update render time
    result.renderTime = performance.now() - layerStartTime;

    return result;
  }

  /**
   * Render background layer
   */
  private renderBackgroundLayer(context: CanvasRenderContext): RenderResult {
    return this.renderer.render({
      ...context,
      elements: [],
      selectedElements: new Set(),
    });
  }

  /**
   * Render grid layer
   */
  private renderGridLayer(context: CanvasRenderContext): RenderResult {
    return this.renderer.render({
      ...context,
      elements: [],
      selectedElements: new Set(),
    });
  }

  /**
   * Render elements layer
   */
  private renderElementsLayer(
    context: CanvasRenderContext, 
    elements: DiagramElement[]
  ): RenderResult {
    const startTime = performance.now();
    let renderedCount = 0;

    for (const element of elements) {
      const elementStartTime = performance.now();
      
      try {
        const success = this.elementRenderers.renderElement(context, element);
        if (success) {
          renderedCount++;
        }
        
        // Record render time for performance optimization
        const elementRenderTime = performance.now() - elementStartTime;
        this.performanceOptimizer.recordElementRenderTime(element.id, elementRenderTime);
        
      } catch (error) {
        console.error(`Failed to render element ${element.id}:`, error);
      }
    }

    return {
      elementsRendered: renderedCount,
      elementsCulled: 0,
      renderTime: performance.now() - startTime,
    };
  }

  /**
   * Render selection layer
   */
  private renderSelectionLayer(
    context: CanvasRenderContext,
    elements: DiagramElement[],
    selectedElements?: Set<string>
  ): RenderResult {
    if (!selectedElements || selectedElements.size === 0) {
      return this.createEmptyRenderResult();
    }

    // Use the main renderer for selection rendering
    return this.renderer.render({
      ...context,
      elements,
      selectedElements,
    });
  }

  /**
   * Render handles layer
   */
  private renderHandlesLayer(
    context: CanvasRenderContext,
    elements: DiagramElement[],
    selectedElements?: Set<string>
  ): RenderResult {
    if (!selectedElements || selectedElements.size === 0) {
      return this.createEmptyRenderResult();
    }

    // Use the main renderer for handles rendering
    return this.renderer.render({
      ...context,
      elements,
      selectedElements,
    });
  }

  /**
   * Render UI overlay layer
   */
  private renderUIOverlayLayer(_context: CanvasRenderContext): RenderResult {
    // Placeholder for UI overlay rendering
    return this.createEmptyRenderResult();
  }

  /**
   * Render tooltip layer
   */
  private renderTooltipLayer(_context: CanvasRenderContext): RenderResult {
    // Placeholder for tooltip rendering
    return this.createEmptyRenderResult();
  }

  /**
   * Create empty render result
   */
  private createEmptyRenderResult(): RenderResult {
    return {
      elementsRendered: 0,
      elementsCulled: 0,
      renderTime: 0,
    };
  }

  /**
   * Create empty render stats
   */
  private createEmptyRenderStats(): RenderStats {
    return {
      totalElements: 0,
      renderedElements: 0,
      culledElements: 0,
      skippedElements: 0,
      layersRendered: 0,
      dirtyRegions: 0,
      totalRenderTime: 0,
      performanceMetrics: this.performanceOptimizer.getPerformanceMetrics(),
      layerResults: {} as Record<RenderLayer, RenderResult | null>,
    };
  }

  /**
   * Add dirty region for incremental rendering
   */
  addDirtyRegion(region: Rectangle, priority = 1, elementIds: string[] = []): void {
    this.performanceOptimizer.addDirtyRegion(region, priority, elementIds);
  }

  /**
   * Get last render statistics
   */
  getLastRenderStats(): RenderStats | null {
    return this.lastRenderStats;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): CanvasPerformanceMetrics {
    return this.performanceOptimizer.getPerformanceMetrics();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RenderEngineConfig>): void {
    this.config = { ...this.config, ...config };

    // Update subsystem configurations
    if (config.renderer) {
      this.renderer.setConfig(config.renderer);
    }
    if (config.performance) {
      this.performanceOptimizer.setConfig(config.performance);
    }
    if (config.debug !== undefined) {
      if (config.debug) {
        this.enableDebugMode();
      } else {
        this.disableDebugMode();
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): RenderEngineConfig {
    return { ...this.config };
  }

  /**
   * Enable debug mode
   */
  private enableDebugMode(): void {
    this.config.debug = true;
    console.log('Render engine debug mode enabled');
  }

  /**
   * Disable debug mode
   */
  private disableDebugMode(): void {
    this.config.debug = false;
  }

  /**
   * Log render statistics in debug mode
   */
  private logRenderStats(stats: RenderStats): void {
    if (!this.config.debug) {return;}

    console.group('Render Stats');
    console.log(`Total elements: ${stats.totalElements}`);
    console.log(`Rendered elements: ${stats.renderedElements}`);
    console.log(`Culled elements: ${stats.culledElements}`);
    console.log(`Layers rendered: ${stats.layersRendered}`);
    console.log(`Render time: ${stats.totalRenderTime.toFixed(2)}ms`);
    console.log(`Frame rate: ${stats.performanceMetrics.frameRate}fps`);
    console.groupEnd();
  }

  /**
   * Reset render engine state
   */
  reset(): void {
    this.performanceOptimizer.reset();
    this.layerManager.clearLayerCache();
    this.lastRenderStats = null;
    this.renderQueue = [];
  }

  /**
   * Dispose of render engine resources
   */
  dispose(): void {
    this.reset();
    // Additional cleanup if needed
  }
}

/**
 * Create a render engine instance
 */
export function createRenderEngine(
  viewportManager: ViewportManager,
  config?: Partial<RenderEngineConfig>
): RenderEngine {
  return new RenderEngine(viewportManager, config);
}