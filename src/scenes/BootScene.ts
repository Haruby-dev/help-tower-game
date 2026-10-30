import Phaser from 'phaser';
import { animationKey, assetUrl, directionsOf, registry } from '../core/assets';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const [id, entry] of Object.entries(registry)) {
      if (entry.type === 'character') {
        this.load.spritesheet(id, assetUrl(entry.file), {
          frameWidth: entry.frameWidth,
          frameHeight: entry.frameHeight,
        });
      } else {
        this.load.image(id, assetUrl(entry.file));
      }
    }
    this.load.tilemapTiledJSON('base_map', assetUrl('maps/base.json'));
  }

  create(): void {
    for (const [id, entry] of Object.entries(registry)) {
      if (entry.type !== 'character' || !entry.frameRate) continue;
      const hops = entry.animation === 'hop-v2';
      directionsOf(entry).forEach((direction, row) => {
        this.anims.create({
          key: animationKey(id, direction),
          frames: this.anims.generateFrameNumbers(id, {
            start: row * entry.frameCount,
            end: row * entry.frameCount + entry.frameCount - 1,
          }),
          frameRate: entry.frameRate,
          repeat: hops ? 0 : -1,
        });
      });
    }
    this.scene.start('Base');
  }
}
