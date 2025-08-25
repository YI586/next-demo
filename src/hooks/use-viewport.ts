/**
 * Custom hook for viewport management in React components
 * Provides access to viewport state and operations with performance optimizations
 */

import { useCallback, useMemo, useRef } from 'react';

import { useDiagramStore, diagramSelectors } from '@/stores/diagram-store';
import { type ViewportManager, createViewportManager, viewportUtils } from '@/lib/canvas/viewport';
import type { Viewport, ScreenCoordinates, WorldCoordinates } from '@/types/canvas';
import type { Point } from '@/types/common';
import type { DiagramElement } from '@/types/elements';

/**
 * Viewport hook return type
 */
export interface UseViewportReturn {
  // State
  viewport: Viewport;
  manager: ViewportManager;

  // Coordinate transformations
  screenToWorld: (screenPoint: ScreenCoordinates) => WorldCoordinates;
  worldToScreen: (worldPoint: WorldCoordinates) => ScreenCoordinates;

  // Zoom operations
  zoomIn: (factor?: number, centerPoint?: ScreenCoordinates) => void;
  zoomOut: (factor?: number, centerPoint?: ScreenCoordinates) => void;
  zoomAtPoint: (zoom: number, centerPoint: ScreenCoordinates) => void;
  zoomToFit: (elements?: DiagramElement[], padding?: number) => void;
  resetZoom: () => void;

  // Pan operations
  panBy: (delta: Point) => void;
  panTo: (offset: Point) => void;
  panToWorldPoint: (worldPoint: WorldCoordinates) => void;

  // Viewport operations
  setViewport: (changes: Partial<Viewport>) => void;
  resetViewport: () => void;

  // Utility functions
  isPointVisible: (worldPoint: WorldCoordinates) => boolean;
  isRectVisible: (worldRect: { x: number; y: number; width: number; height: number }) => boolean;
  getVisibleElements: (elements: DiagramElement[]) => DiagramElement[];
}

/**
 * Hook for viewport management
 */
export function useViewport(): UseViewportReturn {
  const viewport = useDiagramStore(diagramSelectors.getViewport);
  const {
    setViewport: storeSetViewport,
    resetViewport: storeResetViewport,
    zoomIn: storeZoomIn,
    zoomOut: storeZoomOut,
    zoomAtPoint: storeZoomAtPoint,
    zoomToFit: storeZoomToFit,
    panBy: storePanBy,
    panTo: storePanTo,
    panToWorldPoint: storePanToWorldPoint,
  } = useDiagramStore();

  // Create a stable reference to the viewport manager
  const managerRef = useRef<ViewportManager>();
  const manager = useMemo(() => {
    // Only create new manager if viewport has changed significantly
    if (
      !managerRef.current ||
      !viewportUtils.areViewportsEqual(managerRef.current.getViewport(), viewport)
    ) {
      managerRef.current = createViewportManager(viewport);
    }
    return managerRef.current;
  }, [viewport]);

  // Coordinate transformation functions
  const screenToWorld = useCallback(
    (screenPoint: ScreenCoordinates): WorldCoordinates => {
      return manager.screenToWorld(screenPoint);
    },
    [manager]
  );

  const worldToScreen = useCallback(
    (worldPoint: WorldCoordinates): ScreenCoordinates => {
      return manager.worldToScreen(worldPoint);
    },
    [manager]
  );

  // Zoom operations
  const zoomIn = useCallback(
    (factor?: number, centerPoint?: ScreenCoordinates) => {
      storeZoomIn(factor, centerPoint);
    },
    [storeZoomIn]
  );

  const zoomOut = useCallback(
    (factor?: number, centerPoint?: ScreenCoordinates) => {
      storeZoomOut(factor, centerPoint);
    },
    [storeZoomOut]
  );

  const zoomAtPoint = useCallback(
    (zoom: number, centerPoint: ScreenCoordinates) => {
      storeZoomAtPoint(zoom, centerPoint);
    },
    [storeZoomAtPoint]
  );

  const zoomToFit = useCallback(
    (elements?: DiagramElement[], padding = 50) => {
      if (elements) {
        const bounds = manager.calculateElementsBounds(elements);
        const result = manager.zoomToFitBounds(bounds, padding);
        storeSetViewport({ zoom: result.zoom, offset: result.offset });
      } else {
        storeZoomToFit(padding);
      }
    },
    [manager, storeSetViewport, storeZoomToFit]
  );

  const resetZoom = useCallback(() => {
    const center = {
      x: viewport.size.width / 2,
      y: viewport.size.height / 2,
    };
    storeZoomAtPoint(1.0, center);
  }, [storeZoomAtPoint, viewport.size]);

  // Pan operations
  const panBy = useCallback(
    (delta: Point) => {
      storePanBy(delta);
    },
    [storePanBy]
  );

  const panTo = useCallback(
    (offset: Point) => {
      storePanTo(offset);
    },
    [storePanTo]
  );

  const panToWorldPoint = useCallback(
    (worldPoint: WorldCoordinates) => {
      storePanToWorldPoint(worldPoint);
    },
    [storePanToWorldPoint]
  );

  // Viewport operations
  const setViewport = useCallback(
    (changes: Partial<Viewport>) => {
      storeSetViewport(changes);
    },
    [storeSetViewport]
  );

  const resetViewport = useCallback(() => {
    storeResetViewport();
  }, [storeResetViewport]);

  // Utility functions
  const isPointVisible = useCallback(
    (worldPoint: WorldCoordinates) => {
      return manager.isPointVisible(worldPoint);
    },
    [manager]
  );

  const isRectVisible = useCallback(
    (worldRect: { x: number; y: number; width: number; height: number }) => {
      return manager.isRectVisible(worldRect);
    },
    [manager]
  );

  const getVisibleElements = useCallback(
    (elements: DiagramElement[]) => {
      return manager.getVisibleElements(elements);
    },
    [manager]
  );

  return {
    // State
    viewport,
    manager,

    // Coordinate transformations
    screenToWorld,
    worldToScreen,

    // Zoom operations
    zoomIn,
    zoomOut,
    zoomAtPoint,
    zoomToFit,
    resetZoom,

    // Pan operations
    panBy,
    panTo,
    panToWorldPoint,

    // Viewport operations
    setViewport,
    resetViewport,

    // Utility functions
    isPointVisible,
    isRectVisible,
    getVisibleElements,
  };
}

/**
 * Hook for viewport coordinate transformations only (lightweight)
 */
export function useViewportTransforms() {
  const viewport = useDiagramStore(diagramSelectors.getViewport);

  const screenToWorld = useCallback(
    (screenPoint: ScreenCoordinates): WorldCoordinates => {
      return viewportUtils.screenToWorld(screenPoint, viewport);
    },
    [viewport]
  );

  const worldToScreen = useCallback(
    (worldPoint: WorldCoordinates): ScreenCoordinates => {
      return viewportUtils.worldToScreen(worldPoint, viewport);
    },
    [viewport]
  );

  return { screenToWorld, worldToScreen, viewport };
}

/**
 * Hook for viewport visibility checks (lightweight)
 */
export function useViewportVisibility() {
  const viewport = useDiagramStore(diagramSelectors.getViewport);

  const isPointVisible = useCallback(
    (worldPoint: WorldCoordinates): boolean => {
      const { visibleArea } = viewport;
      return (
        worldPoint.x >= visibleArea.x &&
        worldPoint.x <= visibleArea.x + visibleArea.width &&
        worldPoint.y >= visibleArea.y &&
        worldPoint.y <= visibleArea.y + visibleArea.height
      );
    },
    [viewport]
  );

  const isRectVisible = useCallback(
    (worldRect: { x: number; y: number; width: number; height: number }): boolean => {
      const { visibleArea } = viewport;
      return !(
        worldRect.x + worldRect.width < visibleArea.x ||
        worldRect.x > visibleArea.x + visibleArea.width ||
        worldRect.y + worldRect.height < visibleArea.y ||
        worldRect.y > visibleArea.y + visibleArea.height
      );
    },
    [viewport]
  );

  const getVisibleElements = useCallback(
    (elements: DiagramElement[]): DiagramElement[] => {
      return elements.filter((element) =>
        isRectVisible({
          x: element.position.x,
          y: element.position.y,
          width: element.size.width,
          height: element.size.height,
        })
      );
    },
    [isRectVisible]
  );

  return { isPointVisible, isRectVisible, getVisibleElements, viewport };
}
