/**
 * Element-specific renderers for different diagram element types
 * Provides specialized rendering logic for sticky notes, connectors, and other elements
 */

import type { CanvasRenderContext } from '@/types/canvas';
import type { DiagramElement, StickyNote, Connector, ArrowStyle } from '@/types/elements';
import type { Point, Rectangle } from '@/types/common';

import type { ViewportManager } from '../viewport';

/**
 * Base renderer interface for elements
 */
export interface ElementRenderer<T extends DiagramElement = DiagramElement> {
  /** Render the element */
  render(context: CanvasRenderContext, element: T): void;
  /** Check if element needs re-rendering */
  needsRender(element: T, lastRenderTime?: number): boolean;
  /** Get element bounds for culling */
  getBounds(element: T): Rectangle;
  /** Get element render priority */
  getPriority(element: T): number;
}

/**
 * Sticky note renderer
 */
export class StickyNoteRenderer implements ElementRenderer<StickyNote> {
  private viewportManager: ViewportManager;

  constructor(viewportManager: ViewportManager) {
    this.viewportManager = viewportManager;
  }

  render(context: CanvasRenderContext, stickyNote: StickyNote): void {
    const { ctx } = context;
    const { position, size, style, content } = stickyNote;

    // Convert to screen coordinates
    const screenRect = this.viewportManager.worldRectToScreen({
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
    });

    ctx.save();

    // Set global opacity
    ctx.globalAlpha = style.opacity ?? 1;

    // Apply rotation if specified
    if (stickyNote.rotation) {
      const centerX = screenRect.x + screenRect.width / 2;
      const centerY = screenRect.y + screenRect.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate(stickyNote.rotation * Math.PI / 180);
      ctx.translate(-centerX, -centerY);
    }

    // Draw shadow first if enabled
    if (style.shadow) {
      this.renderShadow(ctx, screenRect);
    }

    // Draw background
    this.renderBackground(ctx, screenRect, style);

    // Draw border if specified
    if (style.borderColor && style.borderWidth) {
      this.renderBorder(ctx, screenRect, style);
    }

    // Draw text content
    if (content.text.trim()) {
      this.renderText(ctx, screenRect, content, style);
    }

    // Draw connection points if visible at current zoom
    if (context.viewport.zoom > 0.5) {
      this.renderConnectionPoints(ctx, stickyNote);
    }

    ctx.restore();
  }

  private renderShadow(ctx: CanvasRenderingContext2D, rect: Rectangle): void {
    const shadowOffset = 4;
    
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000000';
    
    // Create shadow effect using multiple passes
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.1;
      ctx.fillRect(
        rect.x + shadowOffset + i,
        rect.y + shadowOffset + i,
        rect.width,
        rect.height
      );
    }
    
    ctx.restore();
  }

  private renderBackground(
    ctx: CanvasRenderingContext2D, 
    rect: Rectangle, 
    style: StickyNote['style']
  ): void {
    ctx.fillStyle = style.backgroundColor;

    if (style.borderRadius && style.borderRadius > 0) {
      this.drawRoundedRect(ctx, rect, style.borderRadius);
      ctx.fill();
    } else {
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  private renderBorder(
    ctx: CanvasRenderingContext2D,
    rect: Rectangle,
    style: StickyNote['style']
  ): void {
    if (!style.borderColor || !style.borderWidth) {return;}

    ctx.strokeStyle = style.borderColor;
    ctx.lineWidth = style.borderWidth;

    // Set line dash pattern
    switch (style.borderStyle) {
      case 'dashed':
        ctx.setLineDash([8, 4]);
        break;
      case 'dotted':
        ctx.setLineDash([2, 4]);
        break;
      default:
        ctx.setLineDash([]);
    }

    if (style.borderRadius && style.borderRadius > 0) {
      this.drawRoundedRect(ctx, rect, style.borderRadius);
      ctx.stroke();
    } else {
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }

    // Reset line dash
    ctx.setLineDash([]);
  }

  private renderText(
    ctx: CanvasRenderingContext2D,
    rect: Rectangle,
    content: StickyNote['content'],
    style: StickyNote['style']
  ): void {
    const padding = 8;
    const availableWidth = rect.width - (padding * 2);

    if (availableWidth <= 0) {return;}

    // Set text properties
    ctx.fillStyle = style.textColor;
    ctx.font = `${content.fontSize}px ${content.fontFamily}`;

    // Calculate text position
    let textX = rect.x + padding;
    let textY = rect.y + padding;

    // Horizontal alignment
    switch (content.textAlign) {
      case 'center':
        textX = rect.x + rect.width / 2;
        ctx.textAlign = 'center';
        break;
      case 'right':
        textX = rect.x + rect.width - padding;
        ctx.textAlign = 'right';
        break;
      default:
        ctx.textAlign = 'left';
    }

    // Vertical alignment
    const lineHeight = content.fontSize * 1.2;
    const lines = this.wrapText(ctx, content.text, availableWidth);
    const totalTextHeight = lines.length * lineHeight;

    switch (content.verticalAlign) {
      case 'middle':
        textY = rect.y + (rect.height - totalTextHeight) / 2;
        break;
      case 'bottom':
        textY = rect.y + rect.height - totalTextHeight - padding;
        break;
      default:
        // top alignment is already set
        break;
    }

    // Draw each line
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      const y = textY + (i * lineHeight);
      if (y + lineHeight <= rect.y + rect.height - padding) {
        ctx.fillText(lines[i], textX, y);
      }
    }
  }

  private renderConnectionPoints(ctx: CanvasRenderingContext2D, stickyNote: StickyNote): void {
    const pointSize = 6;
    const borderWidth = 2;

    for (const connectionPoint of stickyNote.connectionPoints) {
      const screenPos = this.viewportManager.worldToScreen(connectionPoint.position);
      
      ctx.save();
      
      // Draw connection point
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#007acc';
      ctx.lineWidth = borderWidth;

      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, pointSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Connection points don't have direction property in current schema
      // This would be added in future versions

      ctx.restore();
    }
  }

  private drawDirectionIndicator(
    ctx: CanvasRenderingContext2D, 
    position: Point, 
    direction: string
  ): void {
    const indicatorSize = 3;
    
    ctx.fillStyle = '#007acc';
    ctx.beginPath();

    switch (direction) {
      case 'top':
        ctx.moveTo(position.x, position.y - indicatorSize);
        ctx.lineTo(position.x - indicatorSize, position.y);
        ctx.lineTo(position.x + indicatorSize, position.y);
        break;
      case 'right':
        ctx.moveTo(position.x + indicatorSize, position.y);
        ctx.lineTo(position.x, position.y - indicatorSize);
        ctx.lineTo(position.x, position.y + indicatorSize);
        break;
      case 'bottom':
        ctx.moveTo(position.x, position.y + indicatorSize);
        ctx.lineTo(position.x - indicatorSize, position.y);
        ctx.lineTo(position.x + indicatorSize, position.y);
        break;
      case 'left':
        ctx.moveTo(position.x - indicatorSize, position.y);
        ctx.lineTo(position.x, position.y - indicatorSize);
        ctx.lineTo(position.x, position.y + indicatorSize);
        break;
    }

    ctx.closePath();
    ctx.fill();
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D, 
    rect: Rectangle, 
    radius: number
  ): void {
    const { x, y, width, height } = rect;
    const r = Math.min(radius, width / 2, height / 2);
    
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  needsRender(element: StickyNote, lastRenderTime = 0): boolean {
    return element.updatedAt > lastRenderTime;
  }

  getBounds(element: StickyNote): Rectangle {
    return {
      x: element.position.x,
      y: element.position.y,
      width: element.size.width,
      height: element.size.height,
    };
  }

  getPriority(element: StickyNote): number {
    return element.zIndex || 0;
  }
}

/**
 * Connector renderer
 */
export class ConnectorRenderer implements ElementRenderer<Connector> {
  private viewportManager: ViewportManager;

  constructor(viewportManager: ViewportManager) {
    this.viewportManager = viewportManager;
  }

  render(context: CanvasRenderContext, connector: Connector): void {
    const { ctx } = context;
    const { style } = connector;

    ctx.save();

    // Set stroke properties
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.strokeWidth;
    ctx.globalAlpha = style.opacity ?? 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Set line dash pattern
    switch (style.strokeStyle) {
      case 'dashed':
        ctx.setLineDash([8, 4]);
        break;
      case 'dotted':
        ctx.setLineDash([2, 4]);
        break;
      default:
        ctx.setLineDash([]);
    }

    // Draw the connector path
    this.drawConnectorPath(ctx, connector);

    // Draw arrows
    if (style.arrowStart) {
      this.drawArrow(ctx, connector, 'start', style.arrowStart);
    }
    if (style.arrowEnd) {
      this.drawArrow(ctx, connector, 'end', style.arrowEnd);
    }

    // Draw label if present
    if (connector.label) {
      this.drawLabel(ctx, connector);
    }

    ctx.restore();
  }

  private drawConnectorPath(ctx: CanvasRenderingContext2D, connector: Connector): void {
    const startScreen = this.viewportManager.worldToScreen(connector.startElement.position);
    const endScreen = this.viewportManager.worldToScreen(connector.endElement.position);

    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);

    if (connector.points.length === 0) {
      // Simple straight line
      ctx.lineTo(endScreen.x, endScreen.y);
    } else {
      // Bezier curve through control points
      if (connector.points.length === 1) {
        // Quadratic curve
        const controlPoint = connector.points[0];
        if (controlPoint) {
          const controlScreen = this.viewportManager.worldToScreen(controlPoint);
          ctx.quadraticCurveTo(controlScreen.x, controlScreen.y, endScreen.x, endScreen.y);
        }
      } else if (connector.points.length >= 2) {
        // Cubic bezier curve
        const cp1 = connector.points[0];
        const cp2 = connector.points[1];
        if (cp1 && cp2) {
          const cp1Screen = this.viewportManager.worldToScreen(cp1);
          const cp2Screen = this.viewportManager.worldToScreen(cp2);
          ctx.bezierCurveTo(cp1Screen.x, cp1Screen.y, cp2Screen.x, cp2Screen.y, endScreen.x, endScreen.y);
        }
      }
    }

    ctx.stroke();
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D, 
    connector: Connector, 
    end: 'start' | 'end',
    arrowStyle: ArrowStyle
  ): void {
    const position = end === 'start' 
      ? this.viewportManager.worldToScreen(connector.startElement.position)
      : this.viewportManager.worldToScreen(connector.endElement.position);

    const direction = this.getArrowDirection(connector, end);
    
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(direction);

    switch (arrowStyle.type) {
      case 'triangle':
        this.drawTriangleArrow(ctx, arrowStyle);
        break;
      case 'circle':
        this.drawCircleArrow(ctx, arrowStyle);
        break;
      case 'diamond':
        this.drawDiamondArrow(ctx, arrowStyle);
        break;
    }

    ctx.restore();
  }

  private drawTriangleArrow(ctx: CanvasRenderingContext2D, style: ArrowStyle): void {
    const { size, filled } = style;
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size / 2);
    ctx.lineTo(-size, size / 2);
    ctx.closePath();

    if (filled) {
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }

  private drawCircleArrow(ctx: CanvasRenderingContext2D, style: ArrowStyle): void {
    const { size, filled } = style;
    
    ctx.beginPath();
    ctx.arc(-size / 2, 0, size / 2, 0, Math.PI * 2);

    if (filled) {
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }

  private drawDiamondArrow(ctx: CanvasRenderingContext2D, style: ArrowStyle): void {
    const { size, filled } = style;
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size / 2, -size / 2);
    ctx.lineTo(-size, 0);
    ctx.lineTo(-size / 2, size / 2);
    ctx.closePath();

    if (filled) {
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }

  private getArrowDirection(connector: Connector, end: 'start' | 'end'): number {
    const start = connector.startElement.position;
    const finish = connector.endElement.position;

    if (end === 'start') {
      // Direction from start towards end
      const dx = finish.x - start.x;
      const dy = finish.y - start.y;
      return Math.atan2(dy, dx);
    } 
      // Direction from end towards start
      const dx = start.x - finish.x;
      const dy = start.y - finish.y;
      return Math.atan2(dy, dx);
    
  }

  private drawLabel(ctx: CanvasRenderingContext2D, connector: Connector): void {
    if (!connector.label) {return;}

    const { label } = connector;
    const screenPos = this.viewportManager.worldToScreen(label.position);

    ctx.save();
    ctx.font = `${label.fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw background if specified
    if (label.backgroundColor) {
      const metrics = ctx.measureText(label.text);
      const padding = 4;
      const bgWidth = metrics.width + padding * 2;
      const bgHeight = label.fontSize + padding * 2;
      
      ctx.fillStyle = label.backgroundColor;
      ctx.fillRect(
        screenPos.x - bgWidth / 2,
        screenPos.y - bgHeight / 2,
        bgWidth,
        bgHeight
      );
    }

    // Draw text
    ctx.fillStyle = label.textColor;
    ctx.fillText(label.text, screenPos.x, screenPos.y);
    ctx.restore();
  }

  needsRender(element: Connector, lastRenderTime = 0): boolean {
    return element.updatedAt > lastRenderTime;
  }

  getBounds(element: Connector): Rectangle {
    const start = element.startElement.position;
    const end = element.endElement.position;
    
    let minX = Math.min(start.x, end.x);
    let minY = Math.min(start.y, end.y);
    let maxX = Math.max(start.x, end.x);
    let maxY = Math.max(start.y, end.y);

    // Include control points in bounds
    for (const point of element.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  getPriority(element: Connector): number {
    return element.zIndex || 0;
  }
}

/**
 * Element renderer factory
 */
export class ElementRendererFactory {
  private renderers = new Map<string, ElementRenderer>();

  constructor(viewportManager: ViewportManager) {
    // Register built-in renderers
    this.registerRenderer('sticky_note', new StickyNoteRenderer(viewportManager));
    this.registerRenderer('connector', new ConnectorRenderer(viewportManager));
  }

  /**
   * Register a renderer for an element type
   */
  registerRenderer<T extends DiagramElement>(type: string, renderer: ElementRenderer<T>): void {
    this.renderers.set(type, renderer as ElementRenderer);
  }

  /**
   * Get renderer for an element type
   */
  getRenderer(type: string): ElementRenderer | null {
    return this.renderers.get(type) || null;
  }

  /**
   * Render an element using the appropriate renderer
   */
  renderElement(context: CanvasRenderContext, element: DiagramElement): boolean {
    const renderer = this.getRenderer(element.type);
    if (!renderer) {
      console.warn(`No renderer found for element type: ${element.type}`);
      return false;
    }

    try {
      renderer.render(context, element);
      return true;
    } catch (error) {
      console.error(`Error rendering element ${element.id}:`, error);
      return false;
    }
  }

  /**
   * Check if an element needs re-rendering
   */
  elementNeedsRender(element: DiagramElement, lastRenderTime = 0): boolean {
    const renderer = this.getRenderer(element.type);
    return renderer?.needsRender(element, lastRenderTime) ?? true;
  }

  /**
   * Get element bounds
   */
  getElementBounds(element: DiagramElement): Rectangle | null {
    const renderer = this.getRenderer(element.type);
    return renderer?.getBounds(element) || null;
  }

  /**
   * Get all registered renderer types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.renderers.keys());
  }
}

/**
 * Create an element renderer factory
 */
export function createElementRendererFactory(viewportManager: ViewportManager): ElementRendererFactory {
  return new ElementRendererFactory(viewportManager);
}