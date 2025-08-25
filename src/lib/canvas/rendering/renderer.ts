/**
 * Canvas rendering engine for diagram elements
 * Handles layered rendering, performance optimization, and high-DPI support
 */

import type {
  CanvasRenderContext,
  CanvasPerformanceMetrics,
} from '@/types/canvas';
import { RenderLayer } from '@/types/canvas';
import type { DiagramElement, StickyNote, Connector } from '@/types/elements';
import type { Point, Rectangle } from '@/types/common';

import type { ViewportManager } from '../viewport';

/**
 * Configuration for rendering operations
 */
export interface RenderConfig {
  /** Enable performance monitoring */
  enableMetrics: boolean;
  /** Enable viewport culling for performance */
  enableCulling: boolean;
  /** Enable dirty region optimization */
  enableDirtyRegions: boolean;
  /** Maximum elements to render per frame */
  maxElementsPerFrame: number;
  /** Grid settings */
  grid: {
    enabled: boolean;
    size: number;
    color: string;
    opacity: number;
  };
  /** Background settings */
  background: {
    color: string;
    pattern?: 'dots' | 'grid' | 'none';
  };
  /** Selection rendering settings */
  selection: {
    color: string;
    width: number;
    dashPattern: number[];
  };
  /** Handle rendering settings */
  handles: {
    size: number;
    color: string;
    borderColor: string;
    borderWidth: number;
  };
}

/**
 * Default render configuration
 */
export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  enableMetrics: process.env.NODE_ENV === 'development',
  enableCulling: true,
  enableDirtyRegions: true,
  maxElementsPerFrame: 1000,
  grid: {
    enabled: true,
    size: 20,
    color: '#e0e0e0',
    opacity: 0.5,
  },
  background: {
    color: '#ffffff',
    pattern: 'none',
  },
  selection: {
    color: '#007acc',
    width: 2,
    dashPattern: [5, 5],
  },
  handles: {
    size: 8,
    color: '#ffffff',
    borderColor: '#007acc',
    borderWidth: 2,
  },
};

/**
 * Render operation result
 */
export interface RenderResult {
  /** Number of elements rendered */
  elementsRendered: number;
  /** Number of elements culled */
  elementsCulled: number;
  /** Render time in milliseconds */
  renderTime: number;
  /** Performance metrics */
  metrics?: CanvasPerformanceMetrics;
}

/**
 * Dirty region for optimization
 */
export interface DirtyRegion extends Rectangle {
  /** Priority level (higher = render first) */
  priority: number;
}

/**
 * Main canvas renderer class
 */
export class CanvasRenderer {
  private config: RenderConfig;
  private viewportManager: ViewportManager;
  private metrics: CanvasPerformanceMetrics | null = null;
  private lastRenderTime = 0;
  private frameCount = 0;
  private dirtyRegions: DirtyRegion[] = [];

  constructor(viewportManager: ViewportManager, config: RenderConfig = DEFAULT_RENDER_CONFIG) {
    this.viewportManager = viewportManager;
    this.config = { ...config };
  }

  /**
   * Main render method - renders all layers in order
   */
  render(context: CanvasRenderContext): RenderResult {
    const startTime = performance.now();
    
    try {
      // Setup canvas for high-DPI rendering
      this.setupCanvas(context);

      // Clear canvas
      this.clearCanvas(context);

      // Get visible elements for performance
      const visibleElements = this.getVisibleElements(context.elements);

      let elementsRendered = 0;
      const elementsCulled = context.elements.length - visibleElements.length;

      // Render layers in order
      this.renderLayer(context, RenderLayer.BACKGROUND);
      this.renderLayer(context, RenderLayer.GRID);
      
      // Render connectors first (behind elements)
      const connectors = visibleElements.filter(el => el.type === 'connector') as Connector[];
      elementsRendered += this.renderConnectors(context, connectors);

      // Render elements
      const elements = visibleElements.filter(el => el.type === 'sticky_note') as StickyNote[];
      elementsRendered += this.renderElements(context, elements);

      // Render selection and handles on top
      this.renderLayer(context, RenderLayer.SELECTION, context.selectedElements);
      this.renderLayer(context, RenderLayer.HANDLES, context.selectedElements);

      const renderTime = performance.now() - startTime;
      this.updateMetrics(elementsRendered, elementsCulled, renderTime);

      return {
        elementsRendered,
        elementsCulled,
        renderTime,
        ...(this.metrics && { metrics: this.metrics }),
      };
    } catch (error) {
      console.error('Canvas render error:', error);
      throw error;
    }
  }

  /**
   * Setup canvas for high-DPI rendering
   */
  private setupCanvas(context: CanvasRenderContext): void {
    const { canvas, ctx, devicePixelRatio } = context;
    const { size } = context.viewport;

    // Set canvas size accounting for device pixel ratio
    const displayWidth = size.width;
    const displayHeight = size.height;
    const actualWidth = displayWidth * devicePixelRatio;
    const actualHeight = displayHeight * devicePixelRatio;

    // Set actual canvas size
    if (canvas.width !== actualWidth || canvas.height !== actualHeight) {
      canvas.width = actualWidth;
      canvas.height = actualHeight;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
    }

    // Scale context to account for device pixel ratio
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Set default rendering properties
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  /**
   * Clear the entire canvas
   */
  private clearCanvas(context: CanvasRenderContext): void {
    const { ctx, viewport } = context;
    const { size } = viewport;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.restore();
  }

  /**
   * Get elements visible in the current viewport
   */
  private getVisibleElements(elements: DiagramElement[]): DiagramElement[] {
    if (!this.config.enableCulling) {
      return elements;
    }

    return this.viewportManager.getVisibleElements(elements);
  }

  /**
   * Render a specific layer
   */
  private renderLayer(
    context: CanvasRenderContext,
    layer: RenderLayer,
    selectedElements?: Set<string>
  ): void {
    const { ctx } = context;

    ctx.save();
    
    switch (layer) {
      case RenderLayer.BACKGROUND:
        this.renderBackground(context);
        break;
      case RenderLayer.GRID:
        if (this.config.grid.enabled) {
          this.renderGrid(context);
        }
        break;
      case RenderLayer.SELECTION:
        if (selectedElements) {
          this.renderSelections(context, selectedElements);
        }
        break;
      case RenderLayer.HANDLES:
        if (selectedElements) {
          this.renderSelectionHandles(context, selectedElements);
        }
        break;
    }

    ctx.restore();
  }

  /**
   * Render background
   */
  private renderBackground(context: CanvasRenderContext): void {
    const { ctx, viewport } = context;
    const { size } = viewport;

    ctx.fillStyle = this.config.background.color;
    ctx.fillRect(0, 0, size.width, size.height);

    // Add pattern if specified
    if (this.config.background.pattern === 'dots') {
      this.renderBackgroundDots(context);
    }
  }

  /**
   * Render background dot pattern
   */
  private renderBackgroundDots(context: CanvasRenderContext): void {
    const { ctx, viewport } = context;
    const { zoom, visibleArea } = viewport;
    const dotSize = 1;
    const spacing = 20 * zoom;

    if (spacing < 5) {return;} // Skip if too dense

    ctx.fillStyle = '#e0e0e0';
    
    const startX = Math.floor(visibleArea.x / 20) * 20;
    const startY = Math.floor(visibleArea.y / 20) * 20;
    const endX = startX + visibleArea.width + 20;
    const endY = startY + visibleArea.height + 20;

    for (let x = startX; x < endX; x += 20) {
      for (let y = startY; y < endY; y += 20) {
        const screenPos = this.viewportManager.worldToScreen({ x, y });
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Render grid
   */
  private renderGrid(context: CanvasRenderContext): void {
    const { ctx, viewport } = context;
    const { zoom, visibleArea } = viewport;
    const { size, color, opacity } = this.config.grid;

    const gridSize = size * zoom;
    if (gridSize < 5) {return;} // Skip if too dense

    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = 0.5;

    // Calculate grid lines to draw
    const startX = Math.floor(visibleArea.x / size) * size;
    const startY = Math.floor(visibleArea.y / size) * size;
    const endX = startX + visibleArea.width + size;
    const endY = startY + visibleArea.height + size;

    ctx.beginPath();

    // Vertical lines
    for (let x = startX; x < endX; x += size) {
      const screenX = this.viewportManager.worldToScreen({ x, y: 0 }).x;
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, viewport.size.height);
    }

    // Horizontal lines
    for (let y = startY; y < endY; y += size) {
      const screenY = this.viewportManager.worldToScreen({ x: 0, y }).y;
      ctx.moveTo(0, screenY);
      ctx.lineTo(viewport.size.width, screenY);
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /**
   * Render connector elements
   */
  private renderConnectors(context: CanvasRenderContext, connectors: Connector[]): number {
    const { ctx } = context;
    let rendered = 0;

    for (const connector of connectors) {
      ctx.save();
      this.renderConnector(context, connector);
      ctx.restore();
      rendered++;
    }

    return rendered;
  }

  /**
   * Render a single connector
   */
  private renderConnector(context: CanvasRenderContext, connector: Connector): void {
    const { ctx } = context;
    const { style } = connector;

    // Set stroke properties
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.strokeWidth;
    ctx.globalAlpha = style.opacity ?? 1;

    // Set line dash pattern
    if (style.strokeStyle === 'dashed') {
      ctx.setLineDash([5, 5]);
    } else if (style.strokeStyle === 'dotted') {
      ctx.setLineDash([2, 3]);
    } else {
      ctx.setLineDash([]);
    }

    // Convert world coordinates to screen coordinates
    const startPos = this.viewportManager.worldToScreen(connector.startElement.position);
    const endPos = this.viewportManager.worldToScreen(connector.endElement.position);

    // Draw line (simplified - in real implementation would handle bezier curves)
    ctx.beginPath();
    ctx.moveTo(startPos.x, startPos.y);
    
    if (connector.points.length > 0) {
      // Draw bezier curve through control points
      for (const point of connector.points) {
        const screenPoint = this.viewportManager.worldToScreen(point);
        ctx.lineTo(screenPoint.x, screenPoint.y);
      }
    }
    
    ctx.lineTo(endPos.x, endPos.y);
    ctx.stroke();

    // Draw arrows if specified
    if (style.arrowStart) {
      this.renderArrow(context, startPos, this.getLineDirection(startPos, endPos, true), style.arrowStart);
    }
    if (style.arrowEnd) {
      this.renderArrow(context, endPos, this.getLineDirection(startPos, endPos, false), style.arrowEnd);
    }

    // Draw label if present
    if (connector.label) {
      this.renderConnectorLabel(context, connector);
    }
  }

  /**
   * Render sticky note elements
   */
  private renderElements(context: CanvasRenderContext, elements: StickyNote[]): number {
    const { ctx } = context;
    let rendered = 0;

    for (const element of elements) {
      ctx.save();
      this.renderStickyNote(context, element);
      ctx.restore();
      rendered++;
    }

    return rendered;
  }

  /**
   * Render a single sticky note
   */
  private renderStickyNote(context: CanvasRenderContext, stickyNote: StickyNote): void {
    const { ctx } = context;
    const { position, size, style, content } = stickyNote;

    // Convert to screen coordinates
    const screenRect = this.viewportManager.worldRectToScreen({
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
    });

    // Set opacity
    ctx.globalAlpha = style.opacity ?? 1;

    // Draw background
    ctx.fillStyle = style.backgroundColor;
    if (style.borderRadius) {
      this.drawRoundedRect(ctx, screenRect, style.borderRadius);
      ctx.fill();
    } else {
      ctx.fillRect(screenRect.x, screenRect.y, screenRect.width, screenRect.height);
    }

    // Draw border if specified
    if (style.borderColor && style.borderWidth) {
      ctx.strokeStyle = style.borderColor;
      ctx.lineWidth = style.borderWidth;
      
      if (style.borderStyle === 'dashed') {
        ctx.setLineDash([5, 5]);
      } else if (style.borderStyle === 'dotted') {
        ctx.setLineDash([2, 3]);
      } else {
        ctx.setLineDash([]);
      }

      if (style.borderRadius) {
        this.drawRoundedRect(ctx, screenRect, style.borderRadius);
        ctx.stroke();
      } else {
        ctx.strokeRect(screenRect.x, screenRect.y, screenRect.width, screenRect.height);
      }
    }

    // Draw shadow if enabled
    if (style.shadow) {
      this.drawElementShadow(ctx, screenRect);
    }

    // Draw text content
    this.renderStickyNoteText(context, stickyNote, screenRect);

    // Draw connection points if visible at current zoom
    if (context.viewport.zoom > 0.5) {
      this.renderConnectionPoints(context, stickyNote);
    }
  }

  /**
   * Render text content of sticky note
   */
  private renderStickyNoteText(
    context: CanvasRenderContext,
    stickyNote: StickyNote,
    screenRect: Rectangle
  ): void {
    const { ctx } = context;
    const { content, style } = stickyNote;

    if (!content.text.trim()) {return;}

    // Set text properties
    ctx.fillStyle = style.textColor;
    ctx.font = `${content.fontSize}px ${content.fontFamily}`;
    ctx.textAlign = content.textAlign;

    // Calculate text position based on alignment
    let textX = screenRect.x;
    let textY = screenRect.y;
    
    const padding = 8;
    const availableWidth = screenRect.width - (padding * 2);

    switch (content.textAlign) {
      case 'center':
        textX = screenRect.x + screenRect.width / 2;
        break;
      case 'right':
        textX = screenRect.x + screenRect.width - padding;
        break;
      default:
        textX = screenRect.x + padding;
    }

    // Vertical alignment
    switch (content.verticalAlign) {
      case 'middle':
        textY = screenRect.y + screenRect.height / 2;
        ctx.textBaseline = 'middle';
        break;
      case 'bottom':
        textY = screenRect.y + screenRect.height - padding;
        ctx.textBaseline = 'bottom';
        break;
      default:
        textY = screenRect.y + padding;
        ctx.textBaseline = 'top';
    }

    // Wrap text to fit within bounds
    this.drawWrappedText(ctx, content.text, textX, textY, availableWidth);
  }

  /**
   * Render connection points for an element
   */
  private renderConnectionPoints(context: CanvasRenderContext, element: StickyNote): void {
    const { ctx } = context;
    const pointSize = 6;

    for (const connectionPoint of element.connectionPoints) {
      const screenPos = this.viewportManager.worldToScreen(connectionPoint.position);
      
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#007acc';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, pointSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  /**
   * Render selection outlines
   */
  private renderSelections(context: CanvasRenderContext, selectedElements: Set<string>): void {
    const { ctx, elements } = context;
    const { color, width, dashPattern } = this.config.selection;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dashPattern);

    for (const element of elements) {
      if (selectedElements.has(element.id)) {
        const screenRect = this.viewportManager.worldRectToScreen({
          x: element.position.x,
          y: element.position.y,
          width: element.size.width,
          height: element.size.height,
        });

        // Add selection padding
        const padding = 2;
        ctx.strokeRect(
          screenRect.x - padding,
          screenRect.y - padding,
          screenRect.width + (padding * 2),
          screenRect.height + (padding * 2)
        );
      }
    }
  }

  /**
   * Render selection handles
   */
  private renderSelectionHandles(context: CanvasRenderContext, selectedElements: Set<string>): void {
    const { ctx, elements } = context;
    const { size, color, borderColor, borderWidth } = this.config.handles;

    for (const element of elements) {
      if (selectedElements.has(element.id)) {
        const screenRect = this.viewportManager.worldRectToScreen({
          x: element.position.x,
          y: element.position.y,
          width: element.size.width,
          height: element.size.height,
        });

        // Render handles at corners and edges
        const handles = this.getSelectionHandlePositions(screenRect);
        
        for (const handlePos of handles) {
          ctx.fillStyle = color;
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = borderWidth;

          ctx.fillRect(
            handlePos.x - size / 2,
            handlePos.y - size / 2,
            size,
            size
          );
          ctx.strokeRect(
            handlePos.x - size / 2,
            handlePos.y - size / 2,
            size,
            size
          );
        }
      }
    }
  }

  /**
   * Get selection handle positions for a rectangle
   */
  private getSelectionHandlePositions(rect: Rectangle): Point[] {
    const { x, y, width, height } = rect;
    
    return [
      // Corners
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
      // Edges
      { x: x + width / 2, y },
      { x: x + width, y: y + height / 2 },
      { x: x + width / 2, y: y + height },
      { x, y: y + height / 2 },
    ];
  }

  /**
   * Draw rounded rectangle
   */
  private drawRoundedRect(ctx: CanvasRenderingContext2D, rect: Rectangle, radius: number): void {
    const { x, y, width, height } = rect;
    
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Draw wrapped text within bounds
   */
  private drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number
  ): void {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    const lineHeight = parseInt(ctx.font) * 1.2;

    for (let i = 0; i < words.length; i++) {
      const testLine = `${line + words[i]  } `;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line, x, currentY);
        line = `${words[i]  } `;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    
    ctx.fillText(line, x, currentY);
  }

  /**
   * Draw element shadow
   */
  private drawElementShadow(ctx: CanvasRenderingContext2D, rect: Rectangle): void {
    const shadowOffset = 3;
    const shadowBlur = 6;
    
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000000';
    ctx.filter = `blur(${shadowBlur}px)`;
    
    ctx.fillRect(
      rect.x + shadowOffset,
      rect.y + shadowOffset,
      rect.width,
      rect.height
    );
    
    ctx.restore();
  }

  /**
   * Render arrow head
   */
  private renderArrow(
    context: CanvasRenderContext,
    position: Point,
    direction: Point,
    arrowStyle: any
  ): void {
    const { ctx } = context;
    const { size } = arrowStyle;

    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(Math.atan2(direction.y, direction.x));

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size / 2);
    ctx.lineTo(-size, size / 2);
    ctx.closePath();

    if (arrowStyle.filled) {
      ctx.fill();
    } else {
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render connector label
   */
  private renderConnectorLabel(_context: CanvasRenderContext, connector: Connector): void {
    if (!connector.label) {return;}

    const { ctx } = _context;
    const { label } = connector;
    const screenPos = this.viewportManager.worldToScreen(label.position);

    ctx.save();
    ctx.font = `${label.fontSize}px sans-serif`;
    ctx.fillStyle = label.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw background if specified
    if (label.backgroundColor) {
      const metrics = ctx.measureText(label.text);
      const padding = 4;
      
      ctx.fillStyle = label.backgroundColor;
      ctx.fillRect(
        screenPos.x - metrics.width / 2 - padding,
        screenPos.y - label.fontSize / 2 - padding,
        metrics.width + padding * 2,
        label.fontSize + padding * 2
      );
    }

    ctx.fillStyle = label.textColor;
    ctx.fillText(label.text, screenPos.x, screenPos.y);
    ctx.restore();
  }

  /**
   * Get line direction for arrow rendering
   */
  private getLineDirection(start: Point, end: Point, fromStart: boolean): Point {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {return { x: 1, y: 0 };}
    
    return fromStart ? 
      { x: dx / length, y: dy / length } : 
      { x: -dx / length, y: -dy / length };
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(elementsRendered: number, elementsCulled: number, renderTime: number): void {
    if (!this.config.enableMetrics) {return;}

    this.frameCount++;
    const now = performance.now();
    
    if (!this.metrics) {
      this.metrics = {
        renderTime,
        elementCount: elementsRendered + elementsCulled,
        visibleElementCount: elementsRendered,
        frameRate: 0,
      };
      this.lastRenderTime = now;
      return;
    }

    // Update metrics with exponential moving average
    const alpha = 0.1;
    this.metrics.renderTime = this.metrics.renderTime * (1 - alpha) + renderTime * alpha;
    this.metrics.elementCount = elementsRendered + elementsCulled;
    this.metrics.visibleElementCount = elementsRendered;

    // Calculate frame rate every second
    if (now - this.lastRenderTime >= 1000) {
      this.metrics.frameRate = this.frameCount;
      this.frameCount = 0;
      this.lastRenderTime = now;
    }
  }

  /**
   * Update render configuration
   */
  setConfig(newConfig: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current render configuration
   */
  getConfig(): RenderConfig {
    return { ...this.config };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): CanvasPerformanceMetrics | null {
    return this.metrics ? { ...this.metrics } : null;
  }

  /**
   * Add dirty region for optimization
   */
  addDirtyRegion(region: DirtyRegion): void {
    if (!this.config.enableDirtyRegions) {return;}
    this.dirtyRegions.push(region);
  }

  /**
   * Clear dirty regions
   */
  clearDirtyRegions(): void {
    this.dirtyRegions = [];
  }

  /**
   * Get current dirty regions
   */
  getDirtyRegions(): DirtyRegion[] {
    return [...this.dirtyRegions];
  }
}

/**
 * Create a canvas renderer instance
 */
export function createRenderer(
  viewportManager: ViewportManager,
  config?: Partial<RenderConfig>
): CanvasRenderer {
  const renderConfig = config ? { ...DEFAULT_RENDER_CONFIG, ...config } : DEFAULT_RENDER_CONFIG;
  return new CanvasRenderer(viewportManager, renderConfig);
}