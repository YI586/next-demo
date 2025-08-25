/**
 * React hook for canvas event handling integration
 * Connects the canvas event system with UI state management
 */

import { useEffect, useRef, useCallback } from 'react';
import type { DiagramElement } from '@/types/elements';
import type { InteractionMode } from '@/types/canvas';
import type { Tool } from '@/types/common';
import { useUIStore } from '@/stores/ui-store';
import { 
  CanvasEventManager,
  type EventManagerConfig,
  type EventManagerCallbacks,
  InteractionState,
} from '@/lib/canvas/events';
import { ViewportManager } from '@/lib/canvas';

/**
 * Canvas events hook configuration
 */
export interface UseCanvasEventsConfig {
  /** Canvas element reference */
  canvas: HTMLCanvasElement | null;
  /** Viewport manager instance */
  viewportManager: ViewportManager;
  /** Current diagram elements */
  elements: DiagramElement[];
  /** Event manager configuration */
  eventConfig?: Partial<Omit<EventManagerConfig, 'canvas'>>;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Canvas events hook return value
 */
export interface UseCanvasEventsResult {
  /** Event manager instance */
  eventManager: CanvasEventManager | null;
  /** Register custom event handler */
  registerHandler: (
    eventType: string,
    handler: Function,
    options?: any
  ) => string | null;
  /** Unregister event handler */
  unregisterHandler: (handlerId: string) => boolean;
  /** Enable/disable event system */
  setEnabled: (enabled: boolean) => void;
  /** Get performance metrics */
  getMetrics: () => any;
}

/**
 * Hook for managing canvas events with UI store integration
 */
export function useCanvasEvents(config: UseCanvasEventsConfig): UseCanvasEventsResult {
  const eventManagerRef = useRef<CanvasEventManager | null>(null);
  
  // UI store actions
  const {
    currentTool,
    selectedElements,
    hoveredElement,
    editingElement,
    setHoveredElement,
    selectElements,
    setEditingElement,
    setCurrentTool,
  } = useUIStore();

  /**
   * Create event manager callbacks that integrate with UI store
   */
  const createCallbacks = useCallback((): EventManagerCallbacks => ({
    onElementHover: (elementId: string | null) => {
      setHoveredElement(elementId);
    },

    onElementSelect: (elementIds: string[]) => {
      selectElements(elementIds);
    },

    onElementEdit: (elementId: string | null) => {
      setEditingElement(elementId);
    },

    onElementDrag: (elements: DiagramElement[], delta: { x: number; y: number }) => {
      // This would typically trigger diagram store updates
      if (config.debug) {
        console.log('Elements dragged:', elements, 'Delta:', delta);
      }
    },

    onViewportChange: (viewport: any) => {
      // Viewport changes are handled by the viewport manager
      if (config.debug) {
        console.log('Viewport changed:', viewport);
      }
    },

    onInteractionStateChange: (state: InteractionState) => {
      // Map interaction state to tool changes if needed
      if (state === InteractionState.EDITING && currentTool !== 'select') {
        // Ensure we're in select mode when editing
        setCurrentTool('select' as Tool);
      }
      
      if (config.debug) {
        console.log('Interaction state changed:', state);
      }
    },
  }), [
    setHoveredElement,
    selectElements,
    setEditingElement,
    setCurrentTool,
    currentTool,
    config.debug,
  ]);

  /**
   * Initialize event manager
   */
  useEffect(() => {
    if (!config.canvas || !config.viewportManager) {
      return;
    }

    const eventConfig: EventManagerConfig = {
      canvas: config.canvas,
      gestures: true,
      keyboard: true,
      debug: config.debug ?? false,
      ...config.eventConfig,
    };

    const callbacks = createCallbacks();
    eventManagerRef.current = new CanvasEventManager(eventConfig, callbacks);

    // Set initial state
    eventManagerRef.current.updateElements(config.elements);
    eventManagerRef.current.updateSelectedElements(selectedElements);
    eventManagerRef.current.updateHoveredElement(hoveredElement);
    eventManagerRef.current.updateEditingElement(editingElement);
    eventManagerRef.current.setInteractionMode(mapToolToInteractionMode(currentTool));

    return () => {
      if (eventManagerRef.current) {
        eventManagerRef.current.destroy();
        eventManagerRef.current = null;
      }
    };
  }, [
    config.canvas,
    config.viewportManager,
    config.eventConfig,
    config.debug,
    createCallbacks,
  ]);

  /**
   * Update elements when they change
   */
  useEffect(() => {
    if (eventManagerRef.current) {
      eventManagerRef.current.updateElements(config.elements);
    }
  }, [config.elements]);

  /**
   * Update viewport manager when it changes
   */
  useEffect(() => {
    if (eventManagerRef.current) {
      eventManagerRef.current.updateViewportManager(config.viewportManager);
    }
  }, [config.viewportManager]);

  /**
   * Update selected elements when selection changes
   */
  useEffect(() => {
    if (eventManagerRef.current) {
      eventManagerRef.current.updateSelectedElements(selectedElements);
    }
  }, [selectedElements]);

  /**
   * Update hovered element when hover changes
   */
  useEffect(() => {
    if (eventManagerRef.current) {
      eventManagerRef.current.updateHoveredElement(hoveredElement);
    }
  }, [hoveredElement]);

  /**
   * Update editing element when editing state changes
   */
  useEffect(() => {
    if (eventManagerRef.current) {
      eventManagerRef.current.updateEditingElement(editingElement);
    }
  }, [editingElement]);

  /**
   * Update interaction mode when tool changes
   */
  useEffect(() => {
    if (eventManagerRef.current) {
      eventManagerRef.current.setInteractionMode(mapToolToInteractionMode(currentTool));
    }
  }, [currentTool]);

  /**
   * Register custom event handler
   */
  const registerHandler = useCallback((
    eventType: string,
    handler: Function,
    options?: any
  ): string | null => {
    if (!eventManagerRef.current) return null;
    
    try {
      return eventManagerRef.current.registerHandler(
        eventType as any,
        handler as any,
        options
      );
    } catch (error) {
      console.error('Failed to register event handler:', error);
      return null;
    }
  }, []);

  /**
   * Unregister event handler
   */
  const unregisterHandler = useCallback((handlerId: string): boolean => {
    if (!eventManagerRef.current) return false;
    
    try {
      return eventManagerRef.current.unregisterHandler(handlerId);
    } catch (error) {
      console.error('Failed to unregister event handler:', error);
      return false;
    }
  }, []);

  /**
   * Enable/disable event system
   */
  const setEnabled = useCallback((enabled: boolean): void => {
    if (eventManagerRef.current) {
      eventManagerRef.current.setEnabled(enabled);
    }
  }, []);

  /**
   * Get performance metrics
   */
  const getMetrics = useCallback(() => {
    if (!eventManagerRef.current) return {};
    return eventManagerRef.current.getMetrics();
  }, []);

  return {
    eventManager: eventManagerRef.current,
    registerHandler,
    unregisterHandler,
    setEnabled,
    getMetrics,
  };
}

/**
 * Map UI tool to canvas interaction mode
 */
function mapToolToInteractionMode(tool: Tool): InteractionMode {
  switch (tool) {
    case 'select':
      return 'normal';
    case 'sticky_note':
    case 'connector':
      return 'drawing';
    case 'pan':
      return 'panning';
    default:
      return 'normal';
  }
}

/**
 * Hook for canvas event metrics monitoring
 */
export function useCanvasEventMetrics(eventManager: CanvasEventManager | null) {
  const metricsRef = useRef<any>({});

  useEffect(() => {
    if (!eventManager) return;

    const interval = setInterval(() => {
      metricsRef.current = eventManager.getMetrics();
    }, 1000);

    return () => clearInterval(interval);
  }, [eventManager]);

  return metricsRef.current;
}

/**
 * Hook for registering temporary event handlers
 */
export function useTemporaryEventHandler(
  eventManager: CanvasEventManager | null,
  eventType: string,
  handler: Function,
  options?: any,
  dependencies: any[] = []
) {
  const handlerIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!eventManager) return;

    // Register handler
    const handlerId = eventManager.registerHandler(
      eventType as any,
      handler as any,
      options
    );
    handlerIdRef.current = handlerId;

    return () => {
      // Cleanup handler
      if (handlerIdRef.current) {
        eventManager.unregisterHandler(handlerIdRef.current);
        handlerIdRef.current = null;
      }
    };
  }, [eventManager, eventType, ...dependencies]);

  return handlerIdRef.current;
}

/**
 * Hook for handling canvas keyboard shortcuts
 */
export function useCanvasKeyboardShortcuts(
  eventManager: CanvasEventManager | null,
  shortcuts: Record<string, () => void>
) {
  useEffect(() => {
    if (!eventManager) return;

    const handleKeyDown = (event: any) => {
      const key = event.key.toLowerCase();
      const modifiers = [];
      
      if (event.modifiers.ctrl) modifiers.push('ctrl');
      if (event.modifiers.meta) modifiers.push('cmd');
      if (event.modifiers.shift) modifiers.push('shift');
      if (event.modifiers.alt) modifiers.push('alt');
      
      const shortcut = modifiers.length > 0 
        ? `${modifiers.join('+')}+${key}`
        : key;

      const handler = shortcuts[shortcut];
      if (handler) {
        handler();
        return false; // Prevent default
      }
      return true;
    };

    const handlerId = eventManager.registerHandler('key-down' as any, handleKeyDown);

    return () => {
      if (handlerId) {
        eventManager.unregisterHandler(handlerId);
      }
    };
  }, [eventManager, shortcuts]);
}

/**
 * Default canvas event configuration
 */
export const DEFAULT_CANVAS_EVENT_CONFIG: Partial<EventManagerConfig> = {
  gestures: true,
  keyboard: true,
  debug: false,
  drag: {
    threshold: 5,
    snapToGrid: false,
    gridSize: 20,
  },
  selection: {
    multiSelect: true,
    selectionStyle: {
      fillColor: 'rgba(0, 123, 255, 0.1)',
      strokeColor: '#007bff',
      strokeWidth: 1,
      strokeDashArray: '3,3',
    },
  },
  hitTest: {
    tolerance: 3,
    includeInvisible: false,
    includeLocked: false,
  },
};