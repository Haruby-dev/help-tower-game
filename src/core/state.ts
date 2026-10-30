import { eventBus } from './events';
import type { Vector } from './movement';
import type { Viewport } from './viewport';

class GameState {
  private currentViewport: Viewport | null = null;
  private currentRotationRequired = false;
  private currentJoystick: Vector = { x: 0, y: 0 };

  get viewport(): Viewport {
    if (!this.currentViewport) throw new Error('viewport has not been set');
    return this.currentViewport;
  }

  get rotationRequired(): boolean {
    return this.currentRotationRequired;
  }

  get joystick(): Vector {
    return this.currentJoystick;
  }

  setViewport(viewport: Viewport): void {
    this.currentViewport = viewport;
    eventBus.emit('viewport-changed', viewport);
  }

  setRotationRequired(required: boolean): void {
    if (required === this.currentRotationRequired) return;
    this.currentRotationRequired = required;
    eventBus.emit('rotation-required-changed', required);
  }

  setJoystick(vector: Vector): void {
    this.currentJoystick = vector;
  }
}

export const gameState = new GameState();
