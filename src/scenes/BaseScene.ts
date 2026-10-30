import Phaser from 'phaser';
import { eventBus } from '../core/events';
import { gameState } from '../core/state';
import type { Viewport } from '../core/viewport';
import display from '../data/display.json';

export class BaseScene extends Phaser.Scene {
  constructor() {
    super('Base');
  }

  create(): void {
    const centerX = display.baseWidth / 2;
    const centerY = display.baseHeight / 2;

    this.add.sprite(centerX, centerY, 'gio_idle').setName('gio').play('gio_idle');

    this.applyViewport(gameState.viewport);
    const stopListening = eventBus.on('viewport-changed', (viewport) => this.applyViewport(viewport));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopListening);
  }

  private applyViewport(viewport: Viewport): void {
    const camera = this.cameras.main;
    camera.setSize(viewport.canvasWidth, viewport.canvasHeight);
    camera.setZoom(viewport.zoom);
    camera.centerOn(display.baseWidth / 2, display.baseHeight / 2);
  }
}
