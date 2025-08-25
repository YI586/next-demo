/**
 * Layer-based rendering system for canvas elements
 * Manages render order, layer visibility, and layer-specific operations
 */

import { RenderLayer } from '@/types/canvas';
import type { DiagramElement } from '@/types/elements';
import type { Point } from '@/types/common';

/**
 * Layer configuration for rendering
 */
export interface LayerConfig {
  /** Whether this layer is visible */
  visible: boolean;
  /** Layer opacity (0-1) */
  opacity: number;
  /** Layer z-index for ordering */
  zIndex: number;
  /** Whether this layer should be cached */
  cacheable: boolean;
  /** Layer name for debugging */
  name: string;
}

/**
 * Layer render operation
 */
export interface LayerRenderOp {
  /** Layer to render */
  layer: RenderLayer;
  /** Elements to render in this layer */
  elements: DiagramElement[];
  /** Additional render data */
  renderData?: any;
}

/**
 * Default layer configurations
 */
export const DEFAULT_LAYER_CONFIGS: Record<RenderLayer, LayerConfig> = {
  [RenderLayer.BACKGROUND]: {
    visible: true,
    opacity: 1,
    zIndex: 0,
    cacheable: true,
    name: 'Background',
  },
  [RenderLayer.GRID]: {
    visible: true,
    opacity: 0.5,
    zIndex: 10,
    cacheable: true,
    name: 'Grid',
  },
  [RenderLayer.CONNECTORS]: {
    visible: true,
    opacity: 1,
    zIndex: 20,
    cacheable: false,
    name: 'Connectors',
  },
  [RenderLayer.ELEMENTS]: {
    visible: true,
    opacity: 1,
    zIndex: 30,
    cacheable: false,
    name: 'Elements',
  },
  [RenderLayer.SELECTION]: {
    visible: true,
    opacity: 1,
    zIndex: 40,
    cacheable: false,
    name: 'Selection',
  },
  [RenderLayer.HANDLES]: {
    visible: true,
    opacity: 1,
    zIndex: 50,
    cacheable: false,
    name: 'Handles',
  },
  [RenderLayer.UI_OVERLAY]: {
    visible: true,
    opacity: 1,
    zIndex: 60,
    cacheable: false,
    name: 'UI Overlay',
  },
  [RenderLayer.TOOLTIP]: {
    visible: true,
    opacity: 1,
    zIndex: 70,
    cacheable: false,
    name: 'Tooltip',
  },
};

/**
 * Layer cache entry
 */
interface LayerCacheEntry {
  /** Cached canvas for this layer */
  canvas: HTMLCanvasElement;
  /** Cached context */
  ctx: CanvasRenderingContext2D;
  /** Last render timestamp */
  lastRender: number;
  /** Whether cache is valid */
  valid: boolean;
  /** Viewport state when cached */
  viewport: {
    zoom: number;
    offset: Point;
    size: { width: number; height: number };
  };
}

/**
 * Layer manager for handling rendering layers
 */
export class LayerManager {
  private layerConfigs: Record<RenderLayer, LayerConfig>;
  private layerCache = new Map<RenderLayer, LayerCacheEntry>();
  private enableCaching: boolean;

  constructor(
    configs: Partial<Record<RenderLayer, Partial<LayerConfig>>> = {},
    enableCaching = true
  ) {
    this.layerConfigs = { ...DEFAULT_LAYER_CONFIGS };
    this.enableCaching = enableCaching;

    // Apply custom configurations
    for (const [layer, config] of Object.entries(configs)) {
      const layerEnum = parseInt(layer) as RenderLayer;
      if (this.layerConfigs[layerEnum]) {
        this.layerConfigs[layerEnum] = { ...this.layerConfigs[layerEnum], ...config };
      }
    }
  }

  /**
   * Get render operations in correct layer order
   */
  getLayerRenderOps(elements: DiagramElement[], selectedElements: Set<string>): LayerRenderOp[] {
    const ops: LayerRenderOp[] = [];

    // Get layers sorted by z-index
    const sortedLayers = this.getSortedLayers();

    for (const layer of sortedLayers) {
      const config = this.layerConfigs[layer];
      if (!config.visible) {continue;}

      let layerElements: DiagramElement[] = [];
      const renderData: any = {};

      // Determine elements for each layer
      switch (layer) {
        case RenderLayer.BACKGROUND:
          // Background has no elements
          break;

        case RenderLayer.GRID:
          // Grid has no elements
          break;

        case RenderLayer.CONNECTORS:
          layerElements = elements.filter(el => el.type === 'connector');
          break;

        case RenderLayer.ELEMENTS:
          layerElements = elements.filter(el => el.type === 'sticky_note');
          break;

        case RenderLayer.SELECTION:
          layerElements = elements.filter(el => selectedElements.has(el.id));
          renderData.selectedElements = selectedElements;
          break;

        case RenderLayer.HANDLES:
          layerElements = elements.filter(el => selectedElements.has(el.id));
          renderData.selectedElements = selectedElements;
          break;

        case RenderLayer.UI_OVERLAY:
          // UI overlay elements would be added here
          break;

        case RenderLayer.TOOLTIP:
          // Tooltip elements would be added here
          break;
      }

      ops.push({
        layer,
        elements: layerElements,
        renderData,
      });
    }

    return ops;
  }

  /**
   * Get layers sorted by z-index
   */
  private getSortedLayers(): RenderLayer[] {
    return Object.values(RenderLayer)
      .filter((layer): layer is RenderLayer => typeof layer === 'number')
      .sort((a, b) => this.layerConfigs[a].zIndex - this.layerConfigs[b].zIndex);
  }

  /**
   * Check if layer should be cached
   */
  shouldCacheLayer(layer: RenderLayer): boolean {
    return this.enableCaching && this.layerConfigs[layer].cacheable;
  }

  /**
   * Get cached layer canvas if valid
   */
  getCachedLayer(
    layer: RenderLayer,
    currentViewport: { zoom: number; offset: Point; size: { width: number; height: number } }
  ): LayerCacheEntry | null {
    if (!this.shouldCacheLayer(layer)) {return null;}

    const cached = this.layerCache.get(layer);
    if (!cached || !cached.valid) {return null;}

    // Check if viewport has changed significantly
    const viewportChanged = 
      Math.abs(cached.viewport.zoom - currentViewport.zoom) > 0.01 ||
      Math.abs(cached.viewport.offset.x - currentViewport.offset.x) > 1 ||
      Math.abs(cached.viewport.offset.y - currentViewport.offset.y) > 1 ||
      cached.viewport.size.width !== currentViewport.size.width ||
      cached.viewport.size.height !== currentViewport.size.height;

    if (viewportChanged) {
      cached.valid = false;
      return null;
    }

    return cached;
  }

  /**
   * Cache layer canvas
   */
  cacheLayer(
    layer: RenderLayer,
    canvas: HTMLCanvasElement,
    viewport: { zoom: number; offset: Point; size: { width: number; height: number } }
  ): void {
    if (!this.shouldCacheLayer(layer)) {return;}

    // Create cache canvas
    const cacheCanvas = document.createElement('canvas');
    const cacheCtx = cacheCanvas.getContext('2d');
    if (!cacheCtx) {return;}

    // Copy canvas content
    cacheCanvas.width = canvas.width;
    cacheCanvas.height = canvas.height;
    cacheCtx.drawImage(canvas, 0, 0);

    const cacheEntry: LayerCacheEntry = {
      canvas: cacheCanvas,
      ctx: cacheCtx,
      lastRender: performance.now(),
      valid: true,
      viewport: { ...viewport },
    };

    this.layerCache.set(layer, cacheEntry);
  }

  /**
   * Invalidate layer cache
   */
  invalidateLayerCache(layer?: RenderLayer): void {
    if (layer) {
      const cached = this.layerCache.get(layer);
      if (cached) {
        cached.valid = false;
      }
    } else {
      // Invalidate all caches
      for (const cached of this.layerCache.values()) {
        cached.valid = false;
      }
    }
  }

  /**
   * Clear layer cache
   */
  clearLayerCache(layer?: RenderLayer): void {
    if (layer) {
      this.layerCache.delete(layer);
    } else {
      this.layerCache.clear();
    }
  }

  /**
   * Set layer visibility
   */
  setLayerVisibility(layer: RenderLayer, visible: boolean): void {
    this.layerConfigs[layer].visible = visible;
    this.invalidateLayerCache(layer);
  }

  /**
   * Set layer opacity
   */
  setLayerOpacity(layer: RenderLayer, opacity: number): void {
    this.layerConfigs[layer].opacity = Math.max(0, Math.min(1, opacity));
    this.invalidateLayerCache(layer);
  }

  /**
   * Get layer configuration
   */
  getLayerConfig(layer: RenderLayer): LayerConfig {
    return { ...this.layerConfigs[layer] };
  }

  /**
   * Set layer configuration
   */
  setLayerConfig(layer: RenderLayer, config: Partial<LayerConfig>): void {
    this.layerConfigs[layer] = { ...this.layerConfigs[layer], ...config };
    this.invalidateLayerCache(layer);
  }

  /**
   * Get all layer configurations
   */
  getAllLayerConfigs(): Record<RenderLayer, LayerConfig> {
    const configs: Record<RenderLayer, LayerConfig> = {} as any;
    for (const [layer, config] of Object.entries(this.layerConfigs)) {
      configs[parseInt(layer) as RenderLayer] = { ...config };
    }
    return configs;
  }

  /**
   * Reset layer configurations to default
   */
  resetLayerConfigs(): void {
    this.layerConfigs = { ...DEFAULT_LAYER_CONFIGS };
    this.clearLayerCache();
  }

  /**
   * Get layer render statistics
   */
  getLayerStats(): Record<RenderLayer, { cached: boolean; lastRender?: number }> {
    const stats: Record<RenderLayer, { cached: boolean; lastRender?: number }> = {} as any;
    
    for (const layer of Object.values(RenderLayer).filter((l): l is RenderLayer => typeof l === 'number')) {
      const cached = this.layerCache.get(layer);
      stats[layer] = {
        cached: cached?.valid ?? false,
        ...(cached?.lastRender !== undefined && { lastRender: cached.lastRender }),
      };
    }

    return stats;
  }

  /**
   * Check if any layer needs re-rendering
   */
  hasInvalidLayers(): boolean {
    for (const cached of this.layerCache.values()) {
      if (!cached.valid) {return true;}
    }
    return false;
  }

  /**
   * Get memory usage of layer caches
   */
  getCacheMemoryUsage(): number {
    let totalBytes = 0;
    
    for (const cached of this.layerCache.values()) {
      // Estimate canvas memory usage (width * height * 4 bytes per pixel)
      totalBytes += cached.canvas.width * cached.canvas.height * 4;
    }

    return totalBytes;
  }

  /**
   * Optimize cache memory by removing least recently used entries
   */
  optimizeCacheMemory(maxMemoryBytes: number): void {
    const currentUsage = this.getCacheMemoryUsage();
    if (currentUsage <= maxMemoryBytes) {return;}

    // Sort by last render time (oldest first)
    const sortedEntries = Array.from(this.layerCache.entries())
      .sort(([, a], [, b]) => a.lastRender - b.lastRender);

    let removedBytes = 0;
    const targetToRemove = currentUsage - maxMemoryBytes;

    for (const [layer, cached] of sortedEntries) {
      if (removedBytes >= targetToRemove) {break;}

      const entryBytes = cached.canvas.width * cached.canvas.height * 4;
      this.layerCache.delete(layer);
      removedBytes += entryBytes;
    }
  }

  /**
   * Enable or disable layer caching
   */
  setCachingEnabled(enabled: boolean): void {
    this.enableCaching = enabled;
    if (!enabled) {
      this.clearLayerCache();
    }
  }

  /**
   * Get caching enabled state
   */
  isCachingEnabled(): boolean {
    return this.enableCaching;
  }
}

/**
 * Create a layer manager instance
 */
export function createLayerManager(
  configs?: Partial<Record<RenderLayer, Partial<LayerConfig>>>,
  enableCaching = true
): LayerManager {
  return new LayerManager(configs, enableCaching);
}

/**
 * Utility function to get layer name for debugging
 */
export function getLayerName(layer: RenderLayer): string {
  const names: Record<RenderLayer, string> = {
    [RenderLayer.BACKGROUND]: 'Background',
    [RenderLayer.GRID]: 'Grid',
    [RenderLayer.CONNECTORS]: 'Connectors',
    [RenderLayer.ELEMENTS]: 'Elements',
    [RenderLayer.SELECTION]: 'Selection',
    [RenderLayer.HANDLES]: 'Handles',
    [RenderLayer.UI_OVERLAY]: 'UI Overlay',
    [RenderLayer.TOOLTIP]: 'Tooltip',
  };
  return names[layer] || `Layer ${layer}`;
}