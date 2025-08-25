/**
 * Central export file for all type definitions
 */

// Common types
export type * from './common';

// Element types
export type * from './elements';

// Canvas types
export type * from './canvas';

// Diagram types
export type * from './diagram';

// UI types
export type * from './ui';

// Storage types
export type * from './storage';

// Re-export commonly used types for convenience
export type { ID, Point, Rectangle, Size, Color, Timestamp, Tool, LoadingState } from './common';

export type {
  DiagramElement,
  StickyNote,
  Connector,
  ElementType,
  CreateElementParams,
  UpdateElementParams,
} from './elements';

export type { Viewport, CanvasPointerEvent, CanvasKeyboardEvent, InteractionMode } from './canvas';

export type { Diagram, DiagramState, DiagramSnapshot, DiagramOperation } from './diagram';

export type { UIState, DialogType, SidebarTab, Notification, UserPreferences } from './ui';

export type { StorageAdapter, SaveOptions, LoadOptions, StorageConfig } from './storage';
