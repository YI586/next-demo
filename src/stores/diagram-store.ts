/**
 * Diagram state store using Zustand with Immer for immutable updates
 * Handles diagram elements, viewport, undo/redo, loading states, and error management
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';

import {
  type ID,
  type AppError,
  type LoadingState,
  type Diagram,
  type DiagramState,
  type DiagramSnapshot,
  type DiagramInfo,
  type DiagramElement,
  type CreateElementParams,
  type Viewport,
  type Point,
} from '@/types';
import { LoadingState as LoadingStates } from '@/types/common';
import { ElementType } from '@/types/elements';

/** Actions available on the diagram store */
export interface DiagramActions {
  // Diagram management
  createNewDiagram: (name?: string, description?: string) => void;
  loadDiagram: (diagram: Diagram) => void;
  setDiagramName: (name: string) => void;
  setDiagramDescription: (description: string) => void;

  // Element operations
  addElement: (element: CreateElementParams<DiagramElement>) => ID;
  updateElement: (elementId: ID, changes: Partial<DiagramElement>) => void;
  deleteElement: (elementId: ID) => void;
  deleteElements: (elementIds: ID[]) => void;
  moveElements: (elementIds: ID[], delta: Point) => void;
  duplicateElement: (elementId: ID) => ID | null;
  duplicateElements: (elementIds: ID[]) => ID[];

  // Viewport operations
  setViewport: (viewport: Partial<Viewport>) => void;
  resetViewport: () => void;
  zoomIn: (factor?: number) => void;
  zoomOut: (factor?: number) => void;
  zoomToFit: () => void;
  panTo: (position: Point) => void;

  // Undo/Redo operations
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  pushSnapshot: (description?: string) => void;

  // Loading and error states
  setLoading: (loading: LoadingState) => void;
  setError: (error: AppError | null) => void;
  clearError: () => void;

  // Dirty state management
  markDirty: () => void;
  markClean: () => void;

  // Recent diagrams management
  addRecentDiagram: (diagramInfo: DiagramInfo) => void;
  removeRecentDiagram: (diagramId: ID) => void;
  clearRecentDiagrams: () => void;

  // Batch operations
  performBatch: (operations: () => void, description?: string) => void;

  // Reset store
  resetStore: () => void;
}

export type DiagramStore = DiagramState & DiagramActions;

/** Default viewport configuration */
const DEFAULT_VIEWPORT: Viewport = {
  zoom: 1.0,
  minZoom: 0.1,
  maxZoom: 5.0,
  offset: { x: 0, y: 0 },
  size: { width: 800, height: 600 },
  visibleArea: { x: 0, y: 0, width: 800, height: 600 },
};

/** Default diagram snapshot */
const DEFAULT_SNAPSHOT: DiagramSnapshot = {
  elements: [],
  viewport: DEFAULT_VIEWPORT,
  timestamp: Date.now(),
};

/** Initial state for the diagram store */
const initialState: DiagramState = {
  currentDiagram: null,
  loading: LoadingStates.IDLE,
  error: null,
  isDirty: false,
  history: {
    past: [],
    present: DEFAULT_SNAPSHOT,
    future: [],
    maxHistorySize: 50,
  },
  recentDiagrams: [],
};

/**
 * Create diagram store with Zustand and Immer
 */
export const useDiagramStore = create<DiagramStore>()(
  immer((set, get) => ({
    ...initialState,

    // Diagram management actions
    createNewDiagram: (name = 'Untitled Diagram', description = '') => {
      set((state) => {
        const now = Date.now();
        const newDiagram: Diagram = {
          id: uuidv4(),
          name,
          description,
          elements: [],
          viewport: { ...DEFAULT_VIEWPORT },
          metadata: {
            createdAt: now,
            updatedAt: now,
          },
          version: 1,
        };

        state.currentDiagram = newDiagram;
        state.isDirty = false;
        state.error = null;
        state.history = {
          past: [],
          present: {
            elements: [],
            viewport: { ...DEFAULT_VIEWPORT },
            timestamp: now,
          },
          future: [],
          maxHistorySize: 50,
        };
      });
    },

    loadDiagram: (diagram) => {
      set((state) => {
        state.currentDiagram = { ...diagram };
        state.isDirty = false;
        state.error = null;
        state.history = {
          past: [],
          present: {
            elements: [...diagram.elements],
            viewport: { ...diagram.viewport },
            timestamp: Date.now(),
          },
          future: [],
          maxHistorySize: 50,
        };
      });
    },

    setDiagramName: (name) => {
      set((state) => {
        if (state.currentDiagram) {
          state.currentDiagram.name = name;
          state.currentDiagram.metadata.updatedAt = Date.now();
          state.isDirty = true;
        }
      });
    },

    setDiagramDescription: (description) => {
      set((state) => {
        if (state.currentDiagram) {
          state.currentDiagram.description = description;
          state.currentDiagram.metadata.updatedAt = Date.now();
          state.isDirty = true;
        }
      });
    },

    // Element operations
    addElement: (elementParams) => {
      const id = elementParams.id || uuidv4();
      const now = Date.now();

      set((state) => {
        if (!state.currentDiagram) {
          return;
        }

        // Get the highest z-index
        const maxZIndex = Math.max(0, ...state.currentDiagram.elements.map((el) => el.zIndex || 0));

        const newElement: DiagramElement = {
          ...elementParams,
          id,
          createdAt: now,
          updatedAt: now,
          zIndex: maxZIndex + 1,
        } as DiagramElement;

        state.currentDiagram.elements.push(newElement);
        state.currentDiagram.metadata.updatedAt = now;
        state.currentDiagram.version += 1;
        state.isDirty = true;

        // Update history present
        state.history.present.elements = [...state.currentDiagram.elements];
        state.history.present.timestamp = now;
      });

      return id;
    },

    updateElement: (elementId, changes) => {
      set((state) => {
        if (!state.currentDiagram) {
          return;
        }

        const elementIndex = state.currentDiagram.elements.findIndex((el) => el.id === elementId);
        if (elementIndex === -1) {
          return;
        }

        const now = Date.now();
        const element = state.currentDiagram.elements[elementIndex];

        if (element) {
          // Apply changes
          Object.assign(element, changes, { updatedAt: now });
        }

        state.currentDiagram.metadata.updatedAt = now;
        state.currentDiagram.version += 1;
        state.isDirty = true;

        // Update history present
        state.history.present.elements = [...state.currentDiagram.elements];
        state.history.present.timestamp = now;
      });
    },

    deleteElement: (elementId) => {
      set((state) => {
        if (!state.currentDiagram) {
          return;
        }

        const elementIndex = state.currentDiagram.elements.findIndex((el) => el.id === elementId);
        if (elementIndex === -1) {
          return;
        }

        // Remove the element
        state.currentDiagram.elements.splice(elementIndex, 1);

        // Remove any connectors that reference this element
        state.currentDiagram.elements = state.currentDiagram.elements.filter((el) => {
          if (el.type === ElementType.CONNECTOR) {
            return el.startElement.elementId !== elementId && el.endElement.elementId !== elementId;
          }
          return true;
        });

        const now = Date.now();
        state.currentDiagram.metadata.updatedAt = now;
        state.currentDiagram.version += 1;
        state.isDirty = true;

        // Update history present
        state.history.present.elements = [...state.currentDiagram.elements];
        state.history.present.timestamp = now;
      });
    },

    deleteElements: (elementIds) => {
      set((state) => {
        if (!state.currentDiagram) {
          return;
        }

        const elementIdSet = new Set(elementIds);

        // Remove elements and any connectors that reference them
        state.currentDiagram.elements = state.currentDiagram.elements.filter((el) => {
          if (elementIdSet.has(el.id)) {
            return false; // Remove the element itself
          }
          if (el.type === ElementType.CONNECTOR) {
            return (
              !elementIdSet.has(el.startElement.elementId) &&
              !elementIdSet.has(el.endElement.elementId)
            );
          }
          return true;
        });

        const now = Date.now();
        state.currentDiagram.metadata.updatedAt = now;
        state.currentDiagram.version += 1;
        state.isDirty = true;

        // Update history present
        state.history.present.elements = [...state.currentDiagram.elements];
        state.history.present.timestamp = now;
      });
    },

    moveElements: (elementIds, delta) => {
      set((state) => {
        if (!state.currentDiagram) {
          return;
        }

        const elementIdSet = new Set(elementIds);
        const now = Date.now();

        state.currentDiagram.elements.forEach((element) => {
          if (elementIdSet.has(element.id)) {
            element.position.x += delta.x;
            element.position.y += delta.y;
            element.updatedAt = now;
          }
        });

        state.currentDiagram.metadata.updatedAt = now;
        state.currentDiagram.version += 1;
        state.isDirty = true;

        // Update history present
        state.history.present.elements = [...state.currentDiagram.elements];
        state.history.present.timestamp = now;
      });
    },

    duplicateElement: (elementId) => {
      const state = get();
      if (!state.currentDiagram) {
        return null;
      }

      const element = state.currentDiagram.elements.find((el) => el.id === elementId);
      if (!element) {
        return null;
      }

      const newId = uuidv4();
      const now = Date.now();

      const duplicatedElement: DiagramElement = {
        ...element,
        id: newId,
        position: {
          x: element.position.x + 20,
          y: element.position.y + 20,
        },
        createdAt: now,
        updatedAt: now,
        zIndex: element.zIndex + 1,
      };

      // Remove connections for connectors since we can't duplicate those easily
      if (duplicatedElement.type === ElementType.STICKY_NOTE) {
        duplicatedElement.connectionPoints = duplicatedElement.connectionPoints.map((cp) => ({
          ...cp,
          id: uuidv4(),
          elementId: newId,
        }));
      }

      set((state) => {
        if (!state.currentDiagram) {
          return;
        }

        state.currentDiagram.elements.push(duplicatedElement);
        state.currentDiagram.metadata.updatedAt = now;
        state.currentDiagram.version += 1;
        state.isDirty = true;

        // Update history present
        state.history.present.elements = [...state.currentDiagram.elements];
        state.history.present.timestamp = now;
      });

      return newId;
    },

    duplicateElements: (elementIds) => {
      const duplicatedIds: ID[] = [];

      elementIds.forEach((elementId) => {
        const newId = get().duplicateElement(elementId);
        if (newId) {
          duplicatedIds.push(newId);
        }
      });

      return duplicatedIds;
    },

    // Viewport operations
    setViewport: (viewportChanges) => {
      set((state) => {
        if (!state.currentDiagram) {
          return;
        }

        Object.assign(state.currentDiagram.viewport, viewportChanges);

        const now = Date.now();
        state.currentDiagram.metadata.updatedAt = now;
        state.isDirty = true;

        // Update history present viewport
        state.history.present.viewport = { ...state.currentDiagram.viewport };
        state.history.present.timestamp = now;
      });
    },

    resetViewport: () => {
      set((state) => {
        if (!state.currentDiagram) {
          return;
        }

        state.currentDiagram.viewport = { ...DEFAULT_VIEWPORT };

        const now = Date.now();
        state.currentDiagram.metadata.updatedAt = now;
        state.isDirty = true;

        // Update history present viewport
        state.history.present.viewport = { ...state.currentDiagram.viewport };
        state.history.present.timestamp = now;
      });
    },

    zoomIn: (factor = 1.2) => {
      const { setViewport } = get();
      const state = get();

      if (!state.currentDiagram) {
        return;
      }

      const newZoom = Math.min(
        state.currentDiagram.viewport.maxZoom,
        state.currentDiagram.viewport.zoom * factor
      );

      setViewport({ zoom: newZoom });
    },

    zoomOut: (factor = 1.2) => {
      const { setViewport } = get();
      const state = get();

      if (!state.currentDiagram) {
        return;
      }

      const newZoom = Math.max(
        state.currentDiagram.viewport.minZoom,
        state.currentDiagram.viewport.zoom / factor
      );

      setViewport({ zoom: newZoom });
    },

    zoomToFit: () => {
      const state = get();
      if (!state.currentDiagram || state.currentDiagram.elements.length === 0) {
        return;
      }

      // Calculate bounds of all elements
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      state.currentDiagram.elements.forEach((element) => {
        const { position, size } = element;
        minX = Math.min(minX, position.x);
        minY = Math.min(minY, position.y);
        maxX = Math.max(maxX, position.x + size.width);
        maxY = Math.max(maxY, position.y + size.height);
      });

      const elementsBounds = {
        width: maxX - minX,
        height: maxY - minY,
      };

      const { viewport } = state.currentDiagram;
      const padding = 50; // Add some padding

      const scaleX = (viewport.size.width - padding * 2) / elementsBounds.width;
      const scaleY = (viewport.size.height - padding * 2) / elementsBounds.height;
      const scale = Math.min(scaleX, scaleY, viewport.maxZoom);

      const centerX = minX + elementsBounds.width / 2;
      const centerY = minY + elementsBounds.height / 2;

      const { setViewport } = get();
      setViewport({
        zoom: Math.max(scale, viewport.minZoom),
        offset: {
          x: viewport.size.width / 2 - centerX * scale,
          y: viewport.size.height / 2 - centerY * scale,
        },
      });
    },

    panTo: (position) => {
      const { setViewport } = get();
      const state = get();

      if (!state.currentDiagram) {
        return;
      }

      const { viewport } = state.currentDiagram;
      setViewport({
        offset: {
          x: viewport.size.width / 2 - position.x * viewport.zoom,
          y: viewport.size.height / 2 - position.y * viewport.zoom,
        },
      });
    },

    // Undo/Redo operations
    pushSnapshot: (description) => {
      set((state) => {
        if (!state.currentDiagram) {
          return;
        }

        const snapshot: DiagramSnapshot = {
          elements: [...state.currentDiagram.elements],
          viewport: { ...state.currentDiagram.viewport },
          timestamp: Date.now(),
          ...(description && { description }),
        };

        // Add current present to past
        state.history.past.push(state.history.present);

        // Limit history size
        if (state.history.past.length > state.history.maxHistorySize) {
          state.history.past.shift();
        }

        // Update present
        state.history.present = snapshot;

        // Clear future
        state.history.future = [];
      });
    },

    undo: () => {
      set((state) => {
        if (!state.currentDiagram || state.history.past.length === 0) {
          return;
        }

        // Move present to future
        state.history.future.unshift(state.history.present);

        // Get last state from past
        const previousState = state.history.past.pop();
        if (!previousState) {
          return;
        }

        state.history.present = previousState;

        // Apply the previous state
        state.currentDiagram.elements = [...previousState.elements];
        state.currentDiagram.viewport = { ...previousState.viewport };
        state.currentDiagram.metadata.updatedAt = Date.now();
        state.currentDiagram.version += 1;
        state.isDirty = true;
      });
    },

    redo: () => {
      set((state) => {
        if (!state.currentDiagram || state.history.future.length === 0) {
          return;
        }

        // Move present to past
        state.history.past.push(state.history.present);

        // Get next state from future
        const nextState = state.history.future.shift();
        if (!nextState) {
          return;
        }

        state.history.present = nextState;

        // Apply the next state
        state.currentDiagram.elements = [...nextState.elements];
        state.currentDiagram.viewport = { ...nextState.viewport };
        state.currentDiagram.metadata.updatedAt = Date.now();
        state.currentDiagram.version += 1;
        state.isDirty = true;
      });
    },

    clearHistory: () => {
      set((state) => {
        state.history.past = [];
        state.history.future = [];
      });
    },

    // Loading and error states
    setLoading: (loading) => {
      set((state) => {
        state.loading = loading;
      });
    },

    setError: (error) => {
      set((state) => {
        state.error = error;
        if (error) {
          state.loading = LoadingStates.ERROR;
        }
      });
    },

    clearError: () => {
      set((state) => {
        state.error = null;
        if (state.loading === LoadingStates.ERROR) {
          state.loading = LoadingStates.IDLE;
        }
      });
    },

    // Dirty state management
    markDirty: () => {
      set((state) => {
        state.isDirty = true;
      });
    },

    markClean: () => {
      set((state) => {
        state.isDirty = false;
      });
    },

    // Recent diagrams management
    addRecentDiagram: (diagramInfo) => {
      set((state) => {
        // Remove if already exists
        state.recentDiagrams = state.recentDiagrams.filter((d) => d.id !== diagramInfo.id);

        // Add to beginning
        state.recentDiagrams.unshift(diagramInfo);

        // Limit to 10 recent diagrams
        if (state.recentDiagrams.length > 10) {
          state.recentDiagrams = state.recentDiagrams.slice(0, 10);
        }
      });
    },

    removeRecentDiagram: (diagramId) => {
      set((state) => {
        state.recentDiagrams = state.recentDiagrams.filter((d) => d.id !== diagramId);
      });
    },

    clearRecentDiagrams: () => {
      set((state) => {
        state.recentDiagrams = [];
      });
    },

    // Batch operations
    performBatch: (operations, description) => {
      const { pushSnapshot } = get();

      // Take snapshot before batch
      pushSnapshot(description);

      // Perform all operations
      operations();
    },

    // Reset store
    resetStore: () => {
      set(() => ({ ...initialState }));
    },
  }))
);

// Selectors for common queries
export const diagramSelectors = {
  // Get current diagram
  getCurrentDiagram: (state: DiagramStore) => state.currentDiagram,

  // Get elements
  getElements: (state: DiagramStore) => state.currentDiagram?.elements || [],
  getElementById: (state: DiagramStore, id: ID) =>
    state.currentDiagram?.elements.find((el) => el.id === id),
  getElementsByType: (state: DiagramStore, type: ElementType) =>
    state.currentDiagram?.elements.filter((el) => el.type === type) || [],

  // Get viewport
  getViewport: (state: DiagramStore) => state.currentDiagram?.viewport || DEFAULT_VIEWPORT,

  // Get history info
  canUndo: (state: DiagramStore) => state.history.past.length > 0,
  canRedo: (state: DiagramStore) => state.history.future.length > 0,
  getHistoryInfo: (state: DiagramStore) => ({
    pastCount: state.history.past.length,
    futureCount: state.history.future.length,
    maxSize: state.history.maxHistorySize,
  }),

  // Get state flags
  isLoading: (state: DiagramStore) => state.loading === LoadingStates.LOADING,
  hasError: (state: DiagramStore) => state.error !== null,
  isDirty: (state: DiagramStore) => state.isDirty,

  // Get recent diagrams
  getRecentDiagrams: (state: DiagramStore) => state.recentDiagrams,
};

// Export the store hook and selectors
export default useDiagramStore;
