/**
 * Diagram-related type definitions for document structure and operations
 */

import type { ID, Timestamp, AppError, LoadingState } from './common';
import type { DiagramElement } from './elements';
import type { Viewport } from './canvas';

/** Complete diagram document */
export interface Diagram {
  /** Unique identifier for the diagram */
  id: ID;
  /** Display name for the diagram */
  name: string;
  /** Optional description */
  description?: string;
  /** All elements in the diagram */
  elements: DiagramElement[];
  /** Viewport state */
  viewport: Viewport;
  /** Metadata */
  metadata: DiagramMetadata;
  /** Version for optimistic updates */
  version: number;
}

/** Diagram metadata */
export interface DiagramMetadata {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  lastModifiedBy?: string;
  tags?: string[];
  thumbnail?: string;
  fileSize?: number;
}

/** Diagram state for the store */
export interface DiagramState {
  /** Currently active diagram */
  currentDiagram: Diagram | null;
  /** Loading state for diagram operations */
  loading: LoadingState;
  /** Current error if any */
  error: AppError | null;
  /** Whether the diagram has unsaved changes */
  isDirty: boolean;
  /** Undo/redo history */
  history: {
    past: DiagramSnapshot[];
    present: DiagramSnapshot;
    future: DiagramSnapshot[];
    maxHistorySize: number;
  };
  /** Recently opened diagrams */
  recentDiagrams: DiagramInfo[];
}

/** Lightweight diagram information for lists */
export interface DiagramInfo {
  id: ID;
  name: string;
  thumbnail?: string;
  lastModified: Timestamp;
  fileSize?: number;
}

/** Diagram snapshot for undo/redo */
export interface DiagramSnapshot {
  elements: DiagramElement[];
  viewport: Viewport;
  timestamp: Timestamp;
  description?: string;
}

/** Diagram operations for undo/redo system */
export type DiagramOperation = 
  | AddElementOperation
  | UpdateElementOperation
  | DeleteElementOperation
  | MoveElementsOperation
  | ViewportChangeOperation
  | BatchOperation;

export interface AddElementOperation {
  type: 'add_element';
  element: DiagramElement;
}

export interface UpdateElementOperation {
  type: 'update_element';
  elementId: ID;
  changes: Partial<DiagramElement>;
  previousState: Partial<DiagramElement>;
}

export interface DeleteElementOperation {
  type: 'delete_element';
  element: DiagramElement;
}

export interface MoveElementsOperation {
  type: 'move_elements';
  elementIds: ID[];
  delta: { x: number; y: number };
}

export interface ViewportChangeOperation {
  type: 'viewport_change';
  previousViewport: Viewport;
  newViewport: Viewport;
}

export interface BatchOperation {
  type: 'batch';
  operations: DiagramOperation[];
  description?: string;
}

/** File format versions */
export enum FileFormatVersion {
  V1 = '1.0.0',
}

/** Exported diagram file structure */
export interface DiagramFile {
  version: FileFormatVersion;
  diagram: Diagram;
  exportedAt: Timestamp;
  exportedBy?: string;
}