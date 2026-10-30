import { eventBus } from './events';
import type { Viewport } from './viewport';

class GameState {
  private currentViewport: Viewport | null = null;
  private currentRotationRequired = false;

  get viewport(): Viewport {
    if (!this.currentViewport) throw new Error('viewport has not been set');
    return this.currentViewport;
  }

  get rotationRequired(): boolean {
    return this.currentRotationRequired;
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
}

export const gameState = new GameState();
