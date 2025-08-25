/**
 * Canvas rendering engine exports
 */

// Main render engine
export { RenderEngine, createRenderEngine, DEFAULT_RENDER_ENGINE_CONFIG } from './render-engine';
export type { RenderEngineConfig, RenderStats } from './render-engine';

// Core renderer
export { CanvasRenderer, createRenderer, DEFAULT_RENDER_CONFIG } from './renderer';
export type { RenderConfig, RenderResult, DirtyRegion } from './renderer';

// Layer management
export { LayerManager, createLayerManager, DEFAULT_LAYER_CONFIGS, getLayerName } from './layer-manager';
export type { LayerConfig, LayerRenderOp } from './layer-manager';

// Element renderers
export { 
  StickyNoteRenderer, 
  ConnectorRenderer, 
  ElementRendererFactory,
  createElementRendererFactory 
} from './element-renderers';
export type { ElementRenderer } from './element-renderers';

// Performance optimization
export { 
  PerformanceOptimizer, 
  createPerformanceOptimizer,
  DEFAULT_PERFORMANCE_CONFIG 
} from './performance-optimizer';
export type { PerformanceConfig, DirtyRegion as PerfDirtyRegion } from './performance-optimizer';
export { RenderLOD } from './performance-optimizer';