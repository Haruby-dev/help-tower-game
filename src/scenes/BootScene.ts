import Phaser from 'phaser';
import { animationKey, assetUrl, directionsOf, registry } from '../core/assets';
import balance from '../data/balance.json';
import { createPlaceholderTexture } from './sceneArt';

const LABEL_FONT = '700 8px Mali';
const CURSOR_FPS = 2;
const ZZZ_FPS = 3;
const SPARKLE_FPS = 10;
const READY_SPARKLE_PAUSE_MS = 1400;
const WATER_HEIGHT = 5;
const WATER_FRAMES: [string, number, number][] = [
  ['drop', 0, 3],
  ['splash_0', 5, 7],
  ['splash_1', 12, 7],
];

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
      } else if (entry.type === 'local' && entry.frame_width && entry.frame_height) {
        this.load.spritesheet(id, assetUrl(entry.file), { frameWidth: entry.frame_width, frameHeight: entry.frame_height });
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

  private createFarmEffects(): void {
    const water = this.textures.get('fx_water');
    for (const [name, x, width] of WATER_FRAMES) water.add(name, 0, x, 0, width, WATER_HEIGHT);
    const frames = (key: string): Phaser.Types.Animations.AnimationFrame[] => this.anims.generateFrameNumbers(key);
    this.anims.create({ key: 'plot_cursor_loop', frames: frames('plot_cursor'), frameRate: CURSOR_FPS, repeat: -1 });
    this.anims.create({ key: 'fx_zzz_loop', frames: frames('fx_zzz'), frameRate: ZZZ_FPS, repeat: -1 });
    this.anims.create({ key: 'fx_sparkle_once', frames: frames('fx_sparkle'), frameRate: SPARKLE_FPS });
    this.anims.create({ key: 'fx_sparkle_idle', frames: frames('fx_sparkle'), frameRate: SPARKLE_FPS, repeat: -1, repeatDelay: READY_SPARKLE_PAUSE_MS });
  }

  create(): void {
    this.createFarmEffects();
    for (const [id, entry] of Object.entries(registry)) {
      if (entry.type === 'local' && id.startsWith('anim_')) {
        this.anims.create({
          key: id,
          frames: this.anims.generateFrameNumbers(id),
          frameRate: 1000 / balance.farm.actionFrameMs,
          repeat: 0,
        });
      }
      if (entry.type === 'placeholder') createPlaceholderTexture(this, id, entry);
      if (entry.type !== 'character' || !entry.frameRate) continue;
      directionsOf(entry).forEach((direction, row) => {
        this.anims.create({
          key: animationKey(id, direction),
          frames: this.anims.generateFrameNumbers(id, {
            start: row * entry.frameCount,
            end: row * entry.frameCount + entry.frameCount - 1,
          }),
          frameRate: entry.frameRate,
          repeat: -1,
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
