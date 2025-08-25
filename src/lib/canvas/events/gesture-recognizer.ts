/**
 * Gesture recognition system for touch interactions
 * Recognizes pan, pinch, rotate and other multi-touch gestures
 */

import type { Point } from '@/types/common';
import type {
  TouchGesture,
  TouchPointer,
  GestureType,
  GestureState,
  ProcessedCanvasEvent,
} from './types';

/**
 * Gesture recognition configuration
 */
export interface GestureRecognizerConfig {
  /** Minimum movement to start a pan gesture */
  panThreshold?: number;
  /** Minimum scale change to detect pinch */
  pinchThreshold?: number;
  /** Minimum rotation to detect rotation gesture */
  rotationThreshold?: number;
  /** Time threshold for long press */
  longPressThreshold?: number;
  /** Maximum time between taps for double tap */
  doubleTapThreshold?: number;
  /** Maximum distance for tap recognition */
  tapMaxDistance?: number;
  /** Maximum number of simultaneous pointers to track */
  maxPointers?: number;
  /** Enable velocity tracking */
  trackVelocity?: boolean;
  /** Velocity calculation window in ms */
  velocityWindow?: number;
}

/**
 * Pointer tracking data
 */
interface TrackedPointer extends TouchPointer {
  startTime: number;
  previousPosition: Point;
  previousTime: number;
  velocity: Point;
  distance: number;
}

/**
 * Gesture state tracking
 */
interface GestureTracker {
  type: GestureType;
  state: GestureState;
  startTime: number;
  pointers: TrackedPointer[];
  initialDistance?: number;
  initialAngle?: number;
  initialScale?: number;
  center: Point;
  deltaX: number;
  deltaY: number;
  scale?: number;
  rotation?: number;
}

/**
 * Multi-touch gesture recognition system
 */
export class GestureRecognizer {
  private config: Required<GestureRecognizerConfig>;
  private activePointers = new Map<number, TrackedPointer>();
  private activeGestures = new Map<GestureType, GestureTracker>();
  private gestureHistory: TouchGesture[] = [];
  private longPressTimer?: NodeJS.Timeout;
  private lastTapTime = 0;
  private lastTapPosition: Point = { x: 0, y: 0 };

  constructor(config?: Partial<GestureRecognizerConfig>) {
    this.config = {
      panThreshold: 10,
      pinchThreshold: 0.1,
      rotationThreshold: Math.PI / 12, // 15 degrees
      longPressThreshold: 500,
      doubleTapThreshold: 300,
      tapMaxDistance: 10,
      maxPointers: 5,
      trackVelocity: true,
      velocityWindow: 100,
      ...config,
    };
  }

  /**
   * Process touch events and recognize gestures
   */
  processTouch(events: ProcessedCanvasEvent[]): TouchGesture[] {
    const recognizedGestures: TouchGesture[] = [];

    for (const event of events) {
      if (!event.pointerId) continue;

      switch (event.type) {
        case 'down':
          this.handlePointerDown(event, recognizedGestures);
          break;
        case 'move':
          this.handlePointerMove(event, recognizedGestures);
          break;
        case 'up':
          this.handlePointerUp(event, recognizedGestures);
          break;
      }
    }

    // Update ongoing gestures
    this.updateActiveGestures(recognizedGestures);

    return recognizedGestures;
  }

  /**
   * Get current active gestures
   */
  getActiveGestures(): TouchGesture[] {
    return Array.from(this.activeGestures.values()).map(tracker => 
      this.createGestureFromTracker(tracker)
    );
  }

  /**
   * Clear all active gestures
   */
  clearGestures(): void {
    this.activePointers.clear();
    this.activeGestures.clear();
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      delete this.longPressTimer;
    }
  }

  /**
   * Get gesture history
   */
  getGestureHistory(maxAge?: number): TouchGesture[] {
    if (!maxAge) return [...this.gestureHistory];

    const cutoff = performance.now() - maxAge;
    return this.gestureHistory.filter(gesture => 
      gesture.pointers.every(p => p.startPosition.x >= cutoff)
    );
  }

  /**
   * Handle pointer down event
   */
  private handlePointerDown(
    event: ProcessedCanvasEvent,
    gestures: TouchGesture[]
  ): void {
    const pointerId = event.pointerId!;
    const now = performance.now();

    // Create tracked pointer
    const pointer: TrackedPointer = {
      id: pointerId,
      position: { ...event.position },
      startPosition: { ...event.position },
      startTime: now,
      previousPosition: { ...event.position },
      previousTime: now,
      velocity: { x: 0, y: 0 },
      distance: 0,
      force: event.pressure,
    };

    this.activePointers.set(pointerId, pointer);

    // Check for tap gestures
    this.checkTapGestures(event.position, now, gestures);

    // Start long press timer for single touch
    if (this.activePointers.size === 1) {
      this.startLongPressTimer(pointer, gestures);
    }

    // Initialize multi-touch gestures
    if (this.activePointers.size === 2) {
      this.initializePinchRotateGestures();
    }
  }

  /**
   * Handle pointer move event
   */
  private handlePointerMove(
    event: ProcessedCanvasEvent,
    gestures: TouchGesture[]
  ): void {
    const pointerId = event.pointerId!;
    const pointer = this.activePointers.get(pointerId);
    if (!pointer) return;

    const now = performance.now();
    const previousPosition = { ...pointer.position };

    // Update pointer tracking data
    this.updatePointerTracking(pointer, event.position, now);

    // Check if movement exceeds pan threshold
    if (this.activePointers.size === 1) {
      this.checkPanGesture(pointer, gestures);
    }

    // Update multi-touch gestures
    if (this.activePointers.size >= 2) {
      this.updateMultiTouchGestures(gestures);
    }

    // Cancel long press if moved too far
    if (pointer.distance > this.config.tapMaxDistance && this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      delete this.longPressTimer;
    }
  }

  /**
   * Handle pointer up event
   */
  private handlePointerUp(
    event: ProcessedCanvasEvent,
    gestures: TouchGesture[]
  ): void {
    const pointerId = event.pointerId!;
    const pointer = this.activePointers.get(pointerId);
    if (!pointer) return;

    // End gestures that include this pointer
    this.endGesturesWithPointer(pointerId, gestures);

    // Remove pointer
    this.activePointers.delete(pointerId);

    // Clean up timers
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      delete this.longPressTimer;
    }

    // Reinitialize remaining gestures
    if (this.activePointers.size >= 2) {
      this.initializePinchRotateGestures();
    }
  }

  /**
   * Update pointer tracking data
   */
  private updatePointerTracking(
    pointer: TrackedPointer,
    newPosition: Point,
    timestamp: number
  ): void {
    pointer.previousPosition = { ...pointer.position };
    pointer.previousTime = timestamp;
    pointer.position = { ...newPosition };

    // Update distance from start
    pointer.distance = this.getDistance(pointer.startPosition, newPosition);

    // Update velocity if tracking enabled
    if (this.config.trackVelocity) {
      const deltaTime = Math.max(timestamp - pointer.previousTime, 1);
      pointer.velocity = {
        x: (newPosition.x - pointer.previousPosition.x) / deltaTime,
        y: (newPosition.y - pointer.previousPosition.y) / deltaTime,
      };
    }
  }

  /**
   * Check for tap gestures (single, double, two-finger)
   */
  private checkTapGestures(
    position: Point,
    timestamp: number,
    gestures: TouchGesture[]
  ): void {
    // Two-finger tap
    if (this.activePointers.size === 2) {
      const pointers = Array.from(this.activePointers.values());
      gestures.push({
        type: GestureType.TWO_FINGER_TAP,
        state: GestureState.BEGAN,
        center: this.getCenterPoint(pointers.map(p => p.position)),
        deltaX: 0,
        deltaY: 0,
        pointers: pointers.map(p => ({ ...p })),
      });
      return;
    }

    // Single tap / double tap detection
    const timeSinceLastTap = timestamp - this.lastTapTime;
    const distanceFromLastTap = this.getDistance(position, this.lastTapPosition);

    if (
      timeSinceLastTap < this.config.doubleTapThreshold &&
      distanceFromLastTap < this.config.tapMaxDistance
    ) {
      // Double tap detected
      gestures.push({
        type: GestureType.PAN, // Use pan type for double tap for now
        state: GestureState.BEGAN,
        center: position,
        deltaX: 0,
        deltaY: 0,
        pointers: [{ ...this.activePointers.values().next().value }],
      });
    }

    this.lastTapTime = timestamp;
    this.lastTapPosition = { ...position };
  }

  /**
   * Start long press timer
   */
  private startLongPressTimer(
    pointer: TrackedPointer,
    gestures: TouchGesture[]
  ): void {
    this.longPressTimer = setTimeout(() => {
      if (pointer.distance <= this.config.tapMaxDistance) {
        gestures.push({
          type: GestureType.LONG_PRESS,
          state: GestureState.BEGAN,
          center: pointer.position,
          deltaX: 0,
          deltaY: 0,
          pointers: [{ ...pointer }],
        });
      }
      delete this.longPressTimer;
    }, this.config.longPressThreshold);
  }

  /**
   * Check for pan gesture
   */
  private checkPanGesture(
    pointer: TrackedPointer,
    gestures: TouchGesture[]
  ): void {
    if (pointer.distance > this.config.panThreshold) {
      const existingGesture = this.activeGestures.get(GestureType.PAN);
      
      if (!existingGesture) {
        // Start new pan gesture
        const tracker: GestureTracker = {
          type: GestureType.PAN,
          state: GestureState.BEGAN,
          startTime: pointer.startTime,
          pointers: [pointer],
          center: pointer.position,
          deltaX: pointer.position.x - pointer.startPosition.x,
          deltaY: pointer.position.y - pointer.startPosition.y,
        };

        this.activeGestures.set(GestureType.PAN, tracker);
        gestures.push(this.createGestureFromTracker(tracker));
      }
    }
  }

  /**
   * Initialize pinch and rotate gestures
   */
  private initializePinchRotateGestures(): void {
    const pointers = Array.from(this.activePointers.values());
    if (pointers.length < 2) return;

    const p1 = pointers[0];
    const p2 = pointers[1];
    const center = this.getCenterPoint([p1.position, p2.position]);
    const distance = this.getDistance(p1.position, p2.position);
    const angle = this.getAngle(p1.position, p2.position);

    // Initialize pinch tracker
    const pinchTracker: GestureTracker = {
      type: GestureType.PINCH,
      state: GestureState.POSSIBLE,
      startTime: Math.max(p1.startTime, p2.startTime),
      pointers: [...pointers],
      initialDistance: distance,
      initialScale: 1.0,
      center,
      deltaX: 0,
      deltaY: 0,
      scale: 1.0,
    };

    this.activeGestures.set(GestureType.PINCH, pinchTracker);

    // Initialize rotation tracker
    const rotateTracker: GestureTracker = {
      type: GestureType.ROTATE,
      state: GestureState.POSSIBLE,
      startTime: Math.max(p1.startTime, p2.startTime),
      pointers: [...pointers],
      initialAngle: angle,
      center,
      deltaX: 0,
      deltaY: 0,
      rotation: 0,
    };

    this.activeGestures.set(GestureType.ROTATE, rotateTracker);
  }

  /**
   * Update multi-touch gestures
   */
  private updateMultiTouchGestures(gestures: TouchGesture[]): void {
    const pointers = Array.from(this.activePointers.values());
    if (pointers.length < 2) return;

    // Update pinch gesture
    this.updatePinchGesture(pointers, gestures);

    // Update rotation gesture
    this.updateRotationGesture(pointers, gestures);
  }

  /**
   * Update pinch gesture
   */
  private updatePinchGesture(
    pointers: TrackedPointer[],
    gestures: TouchGesture[]
  ): void {
    const pinchTracker = this.activeGestures.get(GestureType.PINCH);
    if (!pinchTracker || !pinchTracker.initialDistance) return;

    const currentDistance = this.getDistance(pointers[0].position, pointers[1].position);
    const scale = currentDistance / pinchTracker.initialDistance;
    const scaleChange = Math.abs(scale - 1.0);

    pinchTracker.pointers = [...pointers];
    pinchTracker.center = this.getCenterPoint(pointers.map(p => p.position));
    pinchTracker.scale = scale;

    if (scaleChange > this.config.pinchThreshold) {
      if (pinchTracker.state === GestureState.POSSIBLE) {
        pinchTracker.state = GestureState.BEGAN;
      } else {
        pinchTracker.state = GestureState.CHANGED;
      }

      gestures.push(this.createGestureFromTracker(pinchTracker));
    }
  }

  /**
   * Update rotation gesture
   */
  private updateRotationGesture(
    pointers: TrackedPointer[],
    gestures: TouchGesture[]
  ): void {
    const rotateTracker = this.activeGestures.get(GestureType.ROTATE);
    if (!rotateTracker || rotateTracker.initialAngle === undefined) return;

    const currentAngle = this.getAngle(pointers[0].position, pointers[1].position);
    const rotation = currentAngle - rotateTracker.initialAngle;
    const rotationAbs = Math.abs(rotation);

    rotateTracker.pointers = [...pointers];
    rotateTracker.center = this.getCenterPoint(pointers.map(p => p.position));
    rotateTracker.rotation = rotation;

    if (rotationAbs > this.config.rotationThreshold) {
      if (rotateTracker.state === GestureState.POSSIBLE) {
        rotateTracker.state = GestureState.BEGAN;
      } else {
        rotateTracker.state = GestureState.CHANGED;
      }

      gestures.push(this.createGestureFromTracker(rotateTracker));
    }
  }

  /**
   * End gestures that include a specific pointer
   */
  private endGesturesWithPointer(
    pointerId: number,
    gestures: TouchGesture[]
  ): void {
    for (const [type, tracker] of this.activeGestures) {
      if (tracker.pointers.some(p => p.id === pointerId)) {
        tracker.state = GestureState.ENDED;
        gestures.push(this.createGestureFromTracker(tracker));
        this.activeGestures.delete(type);
      }
    }
  }

  /**
   * Update ongoing gesture states
   */
  private updateActiveGestures(gestures: TouchGesture[]): void {
    for (const [type, tracker] of this.activeGestures) {
      if (tracker.state === GestureState.BEGAN || tracker.state === GestureState.CHANGED) {
        // Update pan gesture
        if (type === GestureType.PAN && tracker.pointers.length > 0) {
          const pointer = tracker.pointers[0];
          tracker.center = pointer.position;
          tracker.deltaX = pointer.position.x - pointer.startPosition.x;
          tracker.deltaY = pointer.position.y - pointer.startPosition.y;
          tracker.state = GestureState.CHANGED;
        }
      }
    }
  }

  /**
   * Create gesture from tracker
   */
  private createGestureFromTracker(tracker: GestureTracker): TouchGesture {
    const gesture: TouchGesture = {
      type: tracker.type,
      state: tracker.state,
      center: { ...tracker.center },
      deltaX: tracker.deltaX,
      deltaY: tracker.deltaY,
      pointers: tracker.pointers.map(p => ({ ...p })),
    };

    if (tracker.scale !== undefined) {
      gesture.scale = tracker.scale;
    }

    if (tracker.rotation !== undefined) {
      gesture.rotation = tracker.rotation;
    }

    // Calculate velocity if available
    if (this.config.trackVelocity && tracker.pointers.length > 0) {
      gesture.velocity = this.calculateGestureVelocity(tracker.pointers);
    }

    return gesture;
  }

  /**
   * Calculate gesture velocity from pointers
   */
  private calculateGestureVelocity(pointers: TrackedPointer[]): Point {
    const velocities = pointers.map(p => p.velocity);
    const avgVelocity = {
      x: velocities.reduce((sum, v) => sum + v.x, 0) / velocities.length,
      y: velocities.reduce((sum, v) => sum + v.y, 0) / velocities.length,
    };

    return avgVelocity;
  }

  /**
   * Get distance between two points
   */
  private getDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get angle between two points
   */
  private getAngle(p1: Point, p2: Point): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
  }

  /**
   * Get center point of multiple points
   */
  private getCenterPoint(points: Point[]): Point {
    if (points.length === 0) return { x: 0, y: 0 };

    const sum = points.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );

    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GestureRecognizerConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): GestureRecognizerConfig {
    return { ...this.config };
  }
}

/**
 * Gesture recognition utility functions
 */
export const gestureUtils = {
  /**
   * Check if gesture is a tap
   */
  isTapGesture(gesture: TouchGesture): boolean {
    return gesture.type === GestureType.TWO_FINGER_TAP || 
           gesture.type === GestureType.LONG_PRESS;
  },

  /**
   * Check if gesture is a manipulation (pan, pinch, rotate)
   */
  isManipulationGesture(gesture: TouchGesture): boolean {
    return [GestureType.PAN, GestureType.PINCH, GestureType.ROTATE].includes(gesture.type);
  },

  /**
   * Get gesture magnitude (useful for filtering small movements)
   */
  getGestureMagnitude(gesture: TouchGesture): number {
    const deltaDistance = Math.sqrt(gesture.deltaX ** 2 + gesture.deltaY ** 2);
    const scaleMagnitude = gesture.scale ? Math.abs(gesture.scale - 1) : 0;
    const rotationMagnitude = gesture.rotation ? Math.abs(gesture.rotation) : 0;

    return Math.max(deltaDistance, scaleMagnitude * 100, rotationMagnitude * 100);
  },

  /**
   * Combine multiple gestures (for complex interactions)
   */
  combineGestures(gestures: TouchGesture[]): TouchGesture | null {
    if (gestures.length === 0) return null;
    if (gestures.length === 1) return gestures[0];

    // Prioritize by type: pinch > rotate > pan
    const priorityOrder = [GestureType.PINCH, GestureType.ROTATE, GestureType.PAN];
    
    for (const type of priorityOrder) {
      const gesture = gestures.find(g => g.type === type);
      if (gesture) return gesture;
    }

    return gestures[0];
  },
};