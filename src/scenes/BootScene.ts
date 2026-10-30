import Phaser from 'phaser';
import registry from '../../assets-src/registry.json';

const gio = registry.gio_idle;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.spritesheet('gio_idle', `${import.meta.env.BASE_URL}assets/${gio.file}`, {
      frameWidth: gio.frameWidth,
      frameHeight: gio.frameHeight,
    });
  }

  create(): void {
    this.anims.create({
      key: 'gio_idle',
      frames: this.anims.generateFrameNumbers('gio_idle', { start: 0, end: gio.frameCount - 1 }),
      frameRate: gio.frameRate,
      repeat: -1,
    });
    this.scene.start('Base');
  }
}
