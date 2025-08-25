/**
 * Element type definitions for diagram components
 */

import type { ID, Point, Size, Color, Timestamp, ConnectionPoint } from './common';

/** Base element interface that all diagram elements extend */
export interface BaseElement {
  id: ID;
  type: ElementType;
  position: Point;
  size: Size;
  rotation?: number;
  locked?: boolean;
  visible?: boolean;
  zIndex: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Available element types */
export enum ElementType {
  STICKY_NOTE = 'sticky_note',
  CONNECTOR = 'connector',
}

/** Sticky note element with text content and customization options */
export interface StickyNote extends BaseElement {
  type: ElementType.STICKY_NOTE;
  content: {
    text: string;
    fontSize: number;
    fontFamily: string;
    textAlign: 'left' | 'center' | 'right';
    verticalAlign: 'top' | 'middle' | 'bottom';
  };
  style: {
    backgroundColor: Color;
    textColor: Color;
    borderColor?: Color;
    borderWidth?: number;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
    borderRadius?: number;
    opacity?: number;
    shadow?: boolean;
  };
  connectionPoints: ConnectionPoint[];
}

/** Connector element that links other elements */
export interface Connector extends BaseElement {
  type: ElementType.CONNECTOR;
  startElement: {
    elementId: ID;
    connectionPointId: ID;
    position: Point;
  };
  endElement: {
    elementId: ID;
    connectionPointId: ID;
    position: Point;
  };
  points: Point[]; // Control points for bezier curves
  style: {
    strokeColor: Color;
    strokeWidth: number;
    strokeStyle: 'solid' | 'dashed' | 'dotted';
    opacity?: number;
    arrowStart?: ArrowStyle;
    arrowEnd?: ArrowStyle;
  };
  label?: {
    text: string;
    position: Point;
    fontSize: number;
    textColor: Color;
    backgroundColor?: Color;
  };
}

/** Arrow style configuration */
export interface ArrowStyle {
  type: 'triangle' | 'circle' | 'diamond' | 'none';
  size: number;
  filled: boolean;
}

/** Union type for all diagram elements */
export type DiagramElement = StickyNote | Connector;

/** Element creation parameters (without computed fields) */
export type CreateElementParams<T extends DiagramElement> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt' | 'zIndex'
> & {
  id?: ID;
};

/** Element update parameters (partial updates) */
export type UpdateElementParams<T extends DiagramElement> = Partial<
  Omit<T, 'id' | 'type' | 'createdAt'>
> & {
  id: ID;
  updatedAt?: Timestamp;
};

/** Element selection state */
export interface ElementSelection {
  elementId: ID;
  selected: boolean;
  highlighted?: boolean;
  handles?: SelectionHandle[];
}

/** Selection handle for resizing/rotating elements */
export interface SelectionHandle {
  id: string;
  position: Point;
  type: 'resize' | 'rotate' | 'move';
  cursor: string;
}