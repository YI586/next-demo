/**
 * UI state and interaction type definitions
 */

import type { ID, Point, Tool, LoadingState } from './common';
import type { DiagramElement } from './elements';

/** UI state for the application */
export interface UIState {
  /** Currently active tool */
  currentTool: Tool;
  /** Selected element IDs */
  selectedElements: Set<ID>;
  /** Currently hovered element */
  hoveredElement: ID | null;
  /** Element being edited */
  editingElement: ID | null;
  /** Multi-selection state */
  multiSelection: {
    active: boolean;
    startPoint: Point;
    currentPoint: Point;
    elements: Set<ID>;
  };
  /** Context menu state */
  contextMenu: {
    visible: boolean;
    position: Point;
    target?: DiagramElement;
    items: ContextMenuItem[];
  };
  /** Modal dialog state */
  dialog: {
    open: boolean;
    type: DialogType;
    data?: unknown;
  };
  /** Loading states for various operations */
  loading: Record<string, LoadingState>;
  /** Toast notifications */
  notifications: Notification[];
  /** Sidebar state */
  sidebar: {
    visible: boolean;
    activeTab: SidebarTab;
    width: number;
  };
  /** Toolbar state */
  toolbar: {
    visible: boolean;
    position: 'top' | 'left' | 'right' | 'bottom';
  };
  /** Keyboard shortcuts state */
  shortcuts: {
    enabled: boolean;
    customBindings: Record<string, string>;
  };
}

/** Available sidebar tabs */
export enum SidebarTab {
  LAYERS = 'layers',
  PROPERTIES = 'properties',
  LIBRARY = 'library',
  HISTORY = 'history',
}

/** Dialog types */
export enum DialogType {
  NEW_DIAGRAM = 'new_diagram',
  OPEN_DIAGRAM = 'open_diagram',
  SAVE_DIAGRAM = 'save_diagram',
  EXPORT_DIAGRAM = 'export_diagram',
  SETTINGS = 'settings',
  ABOUT = 'about',
  CONFIRM = 'confirm',
}

/** Context menu item */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  shortcut?: string;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  action?: () => void;
}

/** Notification types */
export interface Notification {
  id: ID;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  actions?: NotificationAction[];
  createdAt: number;
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary';
}

/** Keyboard shortcut configuration */
export interface KeyboardShortcut {
  key: string;
  modifiers: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
  action: string;
  description: string;
  category: string;
}

/** Theme configuration */
export interface Theme {
  name: string;
  mode: 'light' | 'dark';
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    border: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
    };
  };
}

/** Application preferences */
export interface UserPreferences {
  theme: string;
  language: string;
  autoSave: boolean;
  autoSaveInterval: number;
  gridVisible: boolean;
  snapToGrid: boolean;
  gridSize: number;
  showRulers: boolean;
  showMinimap: boolean;
  shortcuts: Record<string, KeyboardShortcut>;
  recentFiles: string[];
  maxRecentFiles: number;
}