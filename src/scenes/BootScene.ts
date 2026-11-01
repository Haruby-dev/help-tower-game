import Phaser from 'phaser';
import { animationKey, assetUrl, directionsOf, registry } from '../core/assets';
import { createPlaceholderTexture } from './sceneArt';

const LABEL_FONT = '700 8px Mali';

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
      } else if (
        entry.type === 'object' ||
        entry.type === 'tileset' ||
        ((entry.type === 'local' || entry.type === 'local_tileset') && !entry.lazy)
      ) {
        this.load.image(id, assetUrl(entry.file));
      }
    }
    this.load.tilemapTiledJSON('base_map', assetUrl('maps/base.json'));
  }

  create(): void {
    for (const [id, entry] of Object.entries(registry)) {
      if (entry.type === 'placeholder') createPlaceholderTexture(this, id, entry);
      if (entry.type !== 'character' || !entry.frameRate) continue;
      const hops = entry.animation === 'gio_hop';
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
    // ชื่อบนกล่องแทนภาพใช้ฟอนต์ Mali ถ้าโหลดฟอนต์ไม่ได้ก็ยังเข้าเกมได้
    void document.fonts
      .load(LABEL_FONT)
      .catch(() => undefined)
      .finally(() => this.scene.start('Base'));
  }
}
