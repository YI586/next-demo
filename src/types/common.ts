/**
 * Common type definitions shared across the application
 */

/** Unique identifier type */
export type ID = string;

/** 2D Point coordinates */
export interface Point {
  x: number;
  y: number;
}

/** Rectangle dimensions and position */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Size dimensions */
export interface Size {
  width: number;
  height: number;
}

/** Color representation */
export type Color = string;

/** Timestamp for tracking creation/modification times */
export type Timestamp = number;

/** Generic error type for application errors */
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** Loading state enum */
export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
}

/** Tool types available in the application */
export enum Tool {
  SELECT = 'select',
  STICKY_NOTE = 'sticky_note',
  CONNECTOR = 'connector',
  PAN = 'pan',
  ZOOM = 'zoom',
}

/** Connection point for elements */
export interface ConnectionPoint {
  id: ID;
  elementId: ID;
  position: Point;
  type: 'input' | 'output';
}
