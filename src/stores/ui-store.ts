/**
 * UI state store using Zustand with Immer for immutable updates
 * Handles all UI interactions, states, and user interface management
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';

import {
  type ID,
  type Point,
  type Tool,
  type LoadingState,
  type UIState,
  type ContextMenuItem,
  type Notification,
  type NotificationAction,
  type DiagramElement,
  DialogType,
  SidebarTab,
} from '@/types';
import { LoadingState as LoadingStates, Tool as Tools } from '@/types/common';

/** Actions available on the UI store */
export interface UIActions {
  // Tool management
  setCurrentTool: (tool: Tool) => void;
  resetToSelectTool: () => void;

  // Element selection
  selectElement: (elementId: ID) => void;
  selectElements: (elementIds: ID[]) => void;
  deselectElement: (elementId: ID) => void;
  deselectAllElements: () => void;
  toggleElementSelection: (elementId: ID) => void;
  isElementSelected: (elementId: ID) => boolean;
  getSelectedElementIds: () => ID[];
  getSelectedElementCount: () => number;

  // Hover state
  setHoveredElement: (elementId: ID | null) => void;
  clearHoveredElement: () => void;

  // Editing state
  setEditingElement: (elementId: ID | null) => void;
  clearEditingElement: () => void;
  isElementEditing: (elementId: ID) => boolean;

  // Multi-selection
  startMultiSelection: (startPoint: Point) => void;
  updateMultiSelection: (currentPoint: Point, elements: Set<ID>) => void;
  endMultiSelection: () => void;
  isMultiSelecting: () => boolean;

  // Context menu
  showContextMenu: (position: Point, target?: DiagramElement, items?: ContextMenuItem[]) => void;
  hideContextMenu: () => void;
  updateContextMenuItems: (items: ContextMenuItem[]) => void;

  // Dialog management
  openDialog: (type: DialogType, data?: unknown) => void;
  closeDialog: () => void;
  isDialogOpen: (type?: DialogType) => boolean;

  // Loading states
  setLoadingState: (operation: string, state: LoadingState) => void;
  clearLoadingState: (operation: string) => void;
  isLoading: (operation: string) => boolean;
  getLoadingState: (operation: string) => LoadingState;

  // Toast notifications
  addNotification: (
    type: Notification['type'],
    title: string,
    message: string,
    options?: {
      duration?: number;
      persistent?: boolean;
      actions?: NotificationAction[];
    }
  ) => ID;
  removeNotification: (notificationId: ID) => void;
  clearAllNotifications: () => void;
  markNotificationRead: (notificationId: ID) => void;

  // Sidebar management
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;
  setSidebarWidth: (width: number) => void;

  // Toolbar management
  toggleToolbar: () => void;
  setToolbarVisible: (visible: boolean) => void;
  setToolbarPosition: (position: 'top' | 'left' | 'right' | 'bottom') => void;

  // Keyboard shortcuts
  toggleShortcuts: () => void;
  setShortcutsEnabled: (enabled: boolean) => void;
  updateCustomBinding: (action: string, binding: string) => void;
  removeCustomBinding: (action: string) => void;
  getShortcutBinding: (action: string) => string | undefined;

  // Batch operations
  performUIBatch: (operations: () => void) => void;

  // Reset store
  resetUIStore: () => void;
}

export type UIStore = UIState & UIActions;

/** Default context menu items */
const DEFAULT_CONTEXT_MENU_ITEMS: ContextMenuItem[] = [
  {
    id: 'copy',
    label: 'Copy',
    icon: 'copy',
    shortcut: 'Ctrl+C',
    action: () => {},
  },
  {
    id: 'paste',
    label: 'Paste',
    icon: 'clipboard',
    shortcut: 'Ctrl+V',
    action: () => {},
  },
  {
    id: 'separator-1',
    label: '',
    separator: true,
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: 'trash',
    shortcut: 'Delete',
    action: () => {},
  },
];

/** Initial state for the UI store */
const initialState: UIState = {
  currentTool: Tools.SELECT,
  selectedElements: new Set<ID>(),
  hoveredElement: null,
  editingElement: null,
  multiSelection: {
    active: false,
    startPoint: { x: 0, y: 0 },
    currentPoint: { x: 0, y: 0 },
    elements: new Set<ID>(),
  },
  contextMenu: {
    visible: false,
    position: { x: 0, y: 0 },
    items: DEFAULT_CONTEXT_MENU_ITEMS,
  },
  dialog: {
    open: false,
    type: DialogType.NEW_DIAGRAM,
  },
  loading: {},
  notifications: [],
  sidebar: {
    visible: true,
    activeTab: SidebarTab.PROPERTIES,
    width: 300,
  },
  toolbar: {
    visible: true,
    position: 'top',
  },
  shortcuts: {
    enabled: true,
    customBindings: {},
  },
};

/**
 * Create UI store with Zustand and Immer
 */
export const useUIStore = create<UIStore>()(
  immer((set, get) => ({
    ...initialState,

    // Tool management actions
    setCurrentTool: (tool) => {
      set((state) => {
        state.currentTool = tool;

        // Clear editing state when changing tools
        if (tool !== Tools.SELECT) {
          state.editingElement = null;
        }

        // Clear multi-selection when changing tools
        if (state.multiSelection.active) {
          state.multiSelection.active = false;
          state.multiSelection.elements.clear();
        }
      });
    },

    resetToSelectTool: () => {
      const { setCurrentTool } = get();
      setCurrentTool(Tools.SELECT);
    },

    // Element selection actions
    selectElement: (elementId) => {
      set((state) => {
        state.selectedElements.clear();
        state.selectedElements.add(elementId);
      });
    },

    selectElements: (elementIds) => {
      set((state) => {
        state.selectedElements.clear();
        elementIds.forEach((id) => state.selectedElements.add(id));
      });
    },

    deselectElement: (elementId) => {
      set((state) => {
        state.selectedElements.delete(elementId);
      });
    },

    deselectAllElements: () => {
      set((state) => {
        state.selectedElements.clear();
        state.editingElement = null;
      });
    },

    toggleElementSelection: (elementId) => {
      set((state) => {
        if (state.selectedElements.has(elementId)) {
          state.selectedElements.delete(elementId);
        } else {
          state.selectedElements.add(elementId);
        }
      });
    },

    isElementSelected: (elementId) => {
      return get().selectedElements.has(elementId);
    },

    getSelectedElementIds: () => {
      return Array.from(get().selectedElements);
    },

    getSelectedElementCount: () => {
      return get().selectedElements.size;
    },

    // Hover state actions
    setHoveredElement: (elementId) => {
      set((state) => {
        state.hoveredElement = elementId;
      });
    },

    clearHoveredElement: () => {
      set((state) => {
        state.hoveredElement = null;
      });
    },

    // Editing state actions
    setEditingElement: (elementId) => {
      set((state) => {
        state.editingElement = elementId;

        // Ensure the editing element is selected
        if (elementId) {
          state.selectedElements.clear();
          state.selectedElements.add(elementId);
        }
      });
    },

    clearEditingElement: () => {
      set((state) => {
        state.editingElement = null;
      });
    },

    isElementEditing: (elementId) => {
      return get().editingElement === elementId;
    },

    // Multi-selection actions
    startMultiSelection: (startPoint) => {
      set((state) => {
        state.multiSelection.active = true;
        state.multiSelection.startPoint = { ...startPoint };
        state.multiSelection.currentPoint = { ...startPoint };
        state.multiSelection.elements.clear();
      });
    },

    updateMultiSelection: (currentPoint, elements) => {
      set((state) => {
        if (state.multiSelection.active) {
          state.multiSelection.currentPoint = { ...currentPoint };
          state.multiSelection.elements.clear();
          elements.forEach((id) => state.multiSelection.elements.add(id));
        }
      });
    },

    endMultiSelection: () => {
      set((state) => {
        if (state.multiSelection.active) {
          // Transfer multi-selected elements to main selection
          state.selectedElements.clear();
          state.multiSelection.elements.forEach((id) => state.selectedElements.add(id));

          // Reset multi-selection state
          state.multiSelection.active = false;
          state.multiSelection.elements.clear();
        }
      });
    },

    isMultiSelecting: () => {
      return get().multiSelection.active;
    },

    // Context menu actions
    showContextMenu: (position, target, items) => {
      set((state) => {
        state.contextMenu.visible = true;
        state.contextMenu.position = { ...position };
        state.contextMenu.target = target;

        if (items) {
          state.contextMenu.items = items;
        } else {
          state.contextMenu.items = DEFAULT_CONTEXT_MENU_ITEMS;
        }
      });
    },

    hideContextMenu: () => {
      set((state) => {
        state.contextMenu.visible = false;
        state.contextMenu.target = undefined;
      });
    },

    updateContextMenuItems: (items) => {
      set((state) => {
        state.contextMenu.items = items;
      });
    },

    // Dialog management actions
    openDialog: (type, data) => {
      set((state) => {
        state.dialog.open = true;
        state.dialog.type = type;
        state.dialog.data = data;
      });
    },

    closeDialog: () => {
      set((state) => {
        state.dialog.open = false;
        state.dialog.data = undefined;
      });
    },

    isDialogOpen: (type) => {
      const state = get();
      if (type) {
        return state.dialog.open && state.dialog.type === type;
      }
      return state.dialog.open;
    },

    // Loading states actions
    setLoadingState: (operation, loadingState) => {
      set((state) => {
        state.loading[operation] = loadingState;
      });
    },

    clearLoadingState: (operation) => {
      set((state) => {
        delete state.loading[operation];
      });
    },

    isLoading: (operation) => {
      const state = get();
      return state.loading[operation] === LoadingStates.LOADING;
    },

    getLoadingState: (operation) => {
      const state = get();
      return state.loading[operation] || LoadingStates.IDLE;
    },

    // Toast notifications actions
    addNotification: (type, title, message, options = {}) => {
      const id = uuidv4();
      const now = Date.now();

      set((state) => {
        const notification: Notification = {
          id,
          type,
          title,
          message,
          duration: options.duration,
          persistent: options.persistent || false,
          actions: options.actions,
          createdAt: now,
        };

        state.notifications.push(notification);

        // Auto-remove non-persistent notifications
        if (!notification.persistent && notification.duration !== 0) {
          setTimeout(() => {
            get().removeNotification(id);
          }, notification.duration || 5000);
        }
      });

      return id;
    },

    removeNotification: (notificationId) => {
      set((state) => {
        const index = state.notifications.findIndex((n) => n.id === notificationId);
        if (index !== -1) {
          state.notifications.splice(index, 1);
        }
      });
    },

    clearAllNotifications: () => {
      set((state) => {
        state.notifications.length = 0;
      });
    },

    markNotificationRead: (notificationId) => {
      set((state) => {
        const notification = state.notifications.find((n) => n.id === notificationId);
        if (notification) {
          // Add a read property to track read state
          (notification as Notification & { read?: boolean }).read = true;
        }
      });
    },

    // Sidebar management actions
    toggleSidebar: () => {
      set((state) => {
        state.sidebar.visible = !state.sidebar.visible;
      });
    },

    setSidebarVisible: (visible) => {
      set((state) => {
        state.sidebar.visible = visible;
      });
    },

    setActiveSidebarTab: (tab) => {
      set((state) => {
        state.sidebar.activeTab = tab;
      });
    },

    setSidebarWidth: (width) => {
      set((state) => {
        state.sidebar.width = Math.max(200, Math.min(600, width)); // Constrain between 200-600px
      });
    },

    // Toolbar management actions
    toggleToolbar: () => {
      set((state) => {
        state.toolbar.visible = !state.toolbar.visible;
      });
    },

    setToolbarVisible: (visible) => {
      set((state) => {
        state.toolbar.visible = visible;
      });
    },

    setToolbarPosition: (position) => {
      set((state) => {
        state.toolbar.position = position;
      });
    },

    // Keyboard shortcuts actions
    toggleShortcuts: () => {
      set((state) => {
        state.shortcuts.enabled = !state.shortcuts.enabled;
      });
    },

    setShortcutsEnabled: (enabled) => {
      set((state) => {
        state.shortcuts.enabled = enabled;
      });
    },

    updateCustomBinding: (action, binding) => {
      set((state) => {
        state.shortcuts.customBindings[action] = binding;
      });
    },

    removeCustomBinding: (action) => {
      set((state) => {
        delete state.shortcuts.customBindings[action];
      });
    },

    getShortcutBinding: (action) => {
      return get().shortcuts.customBindings[action];
    },

    // Batch operations
    performUIBatch: (operations) => {
      // Execute all operations in a single state update
      set(() => {
        // Execute operations
        operations();
      });
    },

    // Reset store
    resetUIStore: () => {
      set(() => ({ ...initialState }));
    },
  }))
);

// Selectors for common UI queries
export const uiSelectors = {
  // Tool selectors
  getCurrentTool: (state: UIStore) => state.currentTool,
  isSelectTool: (state: UIStore) => state.currentTool === Tools.SELECT,
  isDrawingTool: (state: UIStore) =>
    state.currentTool === Tools.STICKY_NOTE || state.currentTool === Tools.CONNECTOR,

  // Selection selectors
  getSelectedElements: (state: UIStore) => state.selectedElements,
  hasSelection: (state: UIStore) => state.selectedElements.size > 0,
  hasMultipleSelection: (state: UIStore) => state.selectedElements.size > 1,
  getSelectionArray: (state: UIStore) => Array.from(state.selectedElements),

  // Hover selectors
  getHoveredElement: (state: UIStore) => state.hoveredElement,
  hasHoveredElement: (state: UIStore) => state.hoveredElement !== null,

  // Editing selectors
  getEditingElement: (state: UIStore) => state.editingElement,
  isEditing: (state: UIStore) => state.editingElement !== null,

  // Multi-selection selectors
  getMultiSelection: (state: UIStore) => state.multiSelection,
  isMultiSelecting: (state: UIStore) => state.multiSelection.active,
  getMultiSelectionBounds: (state: UIStore) => {
    if (!state.multiSelection.active) {
      return null;
    }

    const { startPoint, currentPoint } = state.multiSelection;
    return {
      x: Math.min(startPoint.x, currentPoint.x),
      y: Math.min(startPoint.y, currentPoint.y),
      width: Math.abs(currentPoint.x - startPoint.x),
      height: Math.abs(currentPoint.y - startPoint.y),
    };
  },

  // Context menu selectors
  getContextMenu: (state: UIStore) => state.contextMenu,
  isContextMenuVisible: (state: UIStore) => state.contextMenu.visible,

  // Dialog selectors
  getDialog: (state: UIStore) => state.dialog,
  isAnyDialogOpen: (state: UIStore) => state.dialog.open,

  // Loading selectors
  getAllLoadingStates: (state: UIStore) => state.loading,
  isAnyLoading: (state: UIStore) =>
    Object.values(state.loading).some((state) => state === LoadingStates.LOADING),

  // Notification selectors
  getNotifications: (state: UIStore) => state.notifications,
  getUnreadNotifications: (state: UIStore) =>
    state.notifications.filter((n) => !(n as Notification & { read?: boolean }).read),
  hasNotifications: (state: UIStore) => state.notifications.length > 0,

  // Sidebar selectors
  getSidebar: (state: UIStore) => state.sidebar,
  isSidebarVisible: (state: UIStore) => state.sidebar.visible,

  // Toolbar selectors
  getToolbar: (state: UIStore) => state.toolbar,
  isToolbarVisible: (state: UIStore) => state.toolbar.visible,

  // Shortcuts selectors
  getShortcuts: (state: UIStore) => state.shortcuts,
  areShortcutsEnabled: (state: UIStore) => state.shortcuts.enabled,
};

// Export the store hook and selectors
export default useUIStore;
