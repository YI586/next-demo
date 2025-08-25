/**
 * Demo/test file for canvas event handling system
 * This file demonstrates how to use the event handling components
 */

import type { DiagramElement } from '@/types/elements';
import { CanvasEventManager } from './event-manager';
import { EventType } from './types';
import { ViewportManager, DEFAULT_VIEWPORT } from '../viewport';

/**
 * Create a simple demo element for testing
 */
function createDemoElement(id: string, x: number, y: number): DiagramElement {
  return {
    id,
    type: 'sticky_note',
    position: { x, y },
    size: { width: 100, height: 80 },
    zIndex: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    content: {
      text: `Note ${id}`,
      fontSize: 14,
      fontFamily: 'Arial',
      textAlign: 'center',
      verticalAlign: 'middle',
    },
    style: {
      backgroundColor: '#fff3cd',
      textColor: '#856404',
      borderRadius: 4,
      shadow: true,
    },
    connectionPoints: [],
  } as DiagramElement;
}

/**
 * Demo function that sets up the event system
 */
export function setupEventSystemDemo(canvas: HTMLCanvasElement) {
  console.log('🎯 Setting up Canvas Event System Demo');

  // Create viewport manager
  const viewport = {
    ...DEFAULT_VIEWPORT,
    size: { width: canvas.width, height: canvas.height },
  };
  const viewportManager = new ViewportManager(viewport);

  // Create demo elements
  const elements: DiagramElement[] = [
    createDemoElement('note-1', 50, 50),
    createDemoElement('note-2', 200, 100),
    createDemoElement('note-3', 100, 200),
  ];

  // Event manager callbacks
  const callbacks = {
    onElementHover: (elementId: string | null) => {
      console.log('📍 Element hovered:', elementId);
    },

    onElementSelect: (elementIds: string[]) => {
      console.log('✅ Elements selected:', elementIds);
    },

    onElementEdit: (elementId: string | null) => {
      console.log('✏️ Element editing:', elementId);
    },

    onElementDrag: (draggedElements: DiagramElement[], delta: { x: number; y: number }) => {
      console.log('🖱️ Elements dragged:', draggedElements.length, 'Delta:', delta);
    },

    onViewportChange: (newViewport: any) => {
      console.log('🔍 Viewport changed:', {
        zoom: newViewport.zoom.toFixed(2),
        offset: newViewport.offset,
      });
    },

    onInteractionStateChange: (state: string) => {
      console.log('🎮 Interaction state:', state);
    },
  };

  // Create event manager
  const eventManager = new CanvasEventManager(
    {
      canvas,
      gestures: true,
      keyboard: true,
      debug: true,
      drag: {
        threshold: 5,
        snapToGrid: false,
      },
      selection: {
        multiSelect: true,
      },
      hitTest: {
        tolerance: 5,
      },
    },
    callbacks
  );

  // Update event manager with elements
  eventManager.updateElements(elements);

  // Register custom event handlers for demo
  setupCustomHandlers(eventManager);

  console.log('✨ Event system demo ready!');
  console.log('Try the following interactions:');
  console.log('- Click elements to select them');
  console.log('- Hold Ctrl/Cmd and click to multi-select');
  console.log('- Double-click to edit elements');
  console.log('- Drag elements to move them');
  console.log('- Use mouse wheel to zoom');
  console.log('- Hold Ctrl/Cmd + wheel to zoom');
  console.log('- Use keyboard shortcuts (Delete, Escape, Ctrl+A)');
  console.log('- Touch gestures on mobile devices');

  return {
    eventManager,
    viewportManager,
    elements,
    cleanup: () => {
      eventManager.destroy();
      console.log('🧹 Event system demo cleaned up');
    },
  };
}

/**
 * Setup custom event handlers for demo
 */
function setupCustomHandlers(eventManager: CanvasEventManager) {
  const handlers: string[] = [];

  // Custom click handler with logging
  const clickHandler = eventManager.registerHandler(
    EventType.CLICK,
    (event: any, context: any) => {
      console.log('🖱️ Custom click handler:', {
        screenPos: event.position,
        worldPos: event.worldPosition,
        modifiers: event.modifiers,
        hitElement: context.hitTest?.element?.id,
      });
    },
    { priority: -1 } // Lower priority so it runs after main handlers
  );
  handlers.push(clickHandler);

  // Custom keyboard handler for demo shortcuts
  const keyHandler = eventManager.registerHandler(
    EventType.KEY_DOWN,
    (event: any) => {
      const key = event.key.toLowerCase();
      
      switch (key) {
        case 'h':
          console.log('💡 Help: This is a demo of the canvas event system');
          break;
        case 'r':
          console.log('🔄 Resetting viewport');
          // Could trigger viewport reset here
          break;
        case 'm':
          console.log('📊 Event metrics:', eventManager.getMetrics());
          break;
        default:
          console.log('⌨️ Key pressed:', key, 'with modifiers:', event.modifiers);
      }
    }
  );
  handlers.push(keyHandler);

  // Custom gesture handler for demo
  const gestureHandler = eventManager.registerHandler(
    EventType.GESTURE,
    (event: any) => {
      const gesture = event.gesture;
      console.log('👆 Gesture detected:', {
        type: gesture.type,
        state: gesture.state,
        center: gesture.center,
        scale: gesture.scale,
        rotation: gesture.rotation,
        velocity: gesture.velocity,
      });
    }
  );
  handlers.push(gestureHandler);

  // Performance monitoring handler
  let lastMetricsLog = 0;
  const perfHandler = eventManager.registerHandler(
    EventType.POINTER_MOVE,
    () => {
      const now = Date.now();
      if (now - lastMetricsLog > 5000) { // Log every 5 seconds
        const metrics = eventManager.getMetrics();
        console.log('📈 Performance metrics:', {
          eventsPerSecond: metrics.eventsPerSecond,
          avgProcessingTime: metrics.avgProcessingTime.toFixed(2) + 'ms',
          hitTestTime: metrics.hitTestTime.toFixed(2) + 'ms',
          activeListeners: metrics.activeListeners,
        });
        lastMetricsLog = now;
      }
    },
    { priority: -10, passive: true }
  );
  handlers.push(perfHandler);

  return handlers;
}

/**
 * Simple HTML demo page generator
 */
export function generateDemoHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Canvas Event System Demo</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: #f5f5f5;
        }
        .demo-container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .demo-header {
            text-align: center;
            margin-bottom: 20px;
        }
        .demo-canvas {
            border: 2px solid #ddd;
            border-radius: 8px;
            background: white;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            display: block;
            margin: 0 auto;
            touch-action: none; /* Prevent default touch behaviors */
        }
        .demo-info {
            margin-top: 20px;
            padding: 15px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .demo-shortcuts {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 15px;
        }
        .shortcut-item {
            padding: 8px 12px;
            background: #f8f9fa;
            border-radius: 4px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="demo-container">
        <div class="demo-header">
            <h1>🎯 Canvas Event System Demo</h1>
            <p>Interactive demonstration of the canvas event handling system</p>
        </div>
        
        <canvas
            id="demoCanvas"
            class="demo-canvas"
            width="800"
            height="600">
            Your browser does not support the HTML5 canvas element.
        </canvas>
        
        <div class="demo-info">
            <h3>🎮 Try these interactions:</h3>
            <div class="demo-shortcuts">
                <div class="shortcut-item">Click - Select elements</div>
                <div class="shortcut-item">Ctrl+Click - Multi-select</div>
                <div class="shortcut-item">Double-click - Edit element</div>
                <div class="shortcut-item">Drag - Move elements</div>
                <div class="shortcut-item">Mouse wheel - Pan canvas</div>
                <div class="shortcut-item">Ctrl+Wheel - Zoom canvas</div>
                <div class="shortcut-item">Delete - Delete selected</div>
                <div class="shortcut-item">Escape - Cancel operation</div>
                <div class="shortcut-item">Ctrl+A - Select all</div>
                <div class="shortcut-item">H - Show help</div>
                <div class="shortcut-item">M - Show metrics</div>
                <div class="shortcut-item">R - Reset viewport</div>
            </div>
            <p><strong>📱 Mobile:</strong> Touch gestures supported - pinch to zoom, pan to move</p>
            <p><strong>🔧 Debug:</strong> Open browser console to see event system logs</p>
        </div>
    </div>

    <script type="module">
        // In a real application, you would import the actual modules
        console.log('🚀 Canvas Event System Demo Loaded');
        console.log('To see the demo in action, integrate this with the actual event system components.');
        
        // Placeholder for demo initialization
        const canvas = document.getElementById('demoCanvas');
        
        // Mock setup to show the concept
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            console.log('Demo click at:', { x, y });
        });
        
        console.log('📋 To fully activate this demo:');
        console.log('1. Build the project: pnpm build');
        console.log('2. Import and call setupEventSystemDemo(canvas)');
        console.log('3. The event system will handle all interactions');
    </script>
</body>
</html>
  `;
}

/**
 * Export demo utilities
 */
export const demoUtils = {
  createDemoElement,
  setupEventSystemDemo,
  setupCustomHandlers,
  generateDemoHTML,
};