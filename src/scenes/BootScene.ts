import Phaser from 'phaser';
import { animationKey, assetUrl, directionsOf, registry } from '../core/assets';
import { atlasGroupOf, idsInGroup, loadAtlasGroup, registerAtlasGroup } from '../core/atlas';
import type { AssetEntry } from '../data/schema';
import balance from '../data/balance.json';
import { createPlaceholderTexture } from './sceneArt';
import { prepareTreeSway } from './treeSway';
import { preloadInterfaceArt } from '../ui/preload';

const LABEL_FONT = '700 8px Mali';
const PRELOAD_LIMIT_MS = 8000;
const CURSOR_FPS = 2;
const COOK_INTRO_END = 3;
const COOK_LAST_FRAME = 8;
const ZZZ_FPS = 3;
const SPARKLE_FPS = 10;
const READY_SPARKLE_PAUSE_MS = 1400;
const WATER_HEIGHT = 5;
const WASH_LOOP_FROM = 2;
const WATER_FRAMES: [string, number, number][] = [
  ['drop', 0, 3],
  ['splash_0', 5, 7],
  ['splash_1', 12, 7],
];

export class BootScene extends Phaser.Scene {
  /** แผ่นรวมภาพที่ใช้ตั้งแต่เปิดเกม เริ่มโหลดพร้อมไฟล์อื่นใน preload */
  private bootArt: Promise<void> = Promise.resolve();

  constructor() {
    super('Boot');
  }

  preload(): void {
    // ภาพที่อยู่ในแผ่นรวมไม่โหลดทีละไฟล์ (มอนสเตอร์โหลดตอนจะมาเยี่ยม หน้าจอโหลดตอนหน้าจอโหลด)
    for (const [id, entry] of Object.entries(registry)) if (atlasGroupOf(id) === null) this.queue(id, entry);
    this.load.tilemapTiledJSON('base_map', assetUrl('maps/base.json'));
    this.bootArt = loadAtlasGroup('boot');
  }

  /** โหลดไฟล์เดี่ยวของภาพนี้ด้วยตัวโหลดของ Phaser */
  private queue(id: string, entry: AssetEntry): void {
    {
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

  /** ย่อตัวครั้งเดียว วนท่าทำระหว่างรอ แล้วลุกขึ้นตอนเสร็จ */
  private createCookAnimations(id: string): void {
    const frameRate = balance.cooking.animationFps;
    const frames = (start: number, end: number): Phaser.Types.Animations.AnimationFrame[] =>
      this.anims.generateFrameNumbers(id, { start, end });
    this.anims.create({ key: `${id}_intro`, frames: frames(0, COOK_INTRO_END), frameRate });
    this.anims.create({ key: `${id}_loop`, frames: frames(COOK_INTRO_END + 1, COOK_LAST_FRAME), frameRate, repeat: -1 });
    this.anims.create({ key: `${id}_outro`, frames: frames(COOK_INTRO_END, 0), frameRate });
  }

  /** ท่าตกปลาเหวี่ยงครั้งเดียวแล้ววนเฟรม 7–8 ช้า ๆ ระหว่างรอ ท่าอาบน้ำเล่น 0–8 แล้ววน 2–8 */
  private createPondAnimations(id: string, entry: { play_from?: number; frames?: number }): void {
    const last = (entry.frames ?? 1) - 1;
    const frames = (start: number, end: number): Phaser.Types.Animations.AnimationFrame[] => this.anims.generateFrameNumbers(id, { start, end });
    const { fishing, bath } = balance;
    if (id.startsWith('anim_fish_')) {
      this.anims.create({ key: `${id}_intro`, frames: frames(entry.play_from ?? 0, last), frameRate: fishing.castFps });
      this.anims.create({ key: `${id}_loop`, frames: frames(last - 1, last), frameRate: fishing.waitFps, repeat: -1 });
    } else {
      this.anims.create({ key: `${id}_intro`, frames: frames(0, last), frameRate: bath.fps });
      this.anims.create({ key: `${id}_loop`, frames: frames(WASH_LOOP_FROM, last), frameRate: bath.fps, repeat: -1 });
    }
  }

  private createBobberAnimations(): void {
    const { fishing } = balance;
    const frames = (key: string): Phaser.Types.Animations.AnimationFrame[] => this.anims.generateFrameNumbers(key);
    this.anims.create({ key: 'fx_bobber_idle_loop', frames: frames('fx_bobber_idle'), frameRate: fishing.bobberIdleFps, repeat: -1 });
    this.anims.create({ key: 'fx_bobber_nibble_once', frames: frames('fx_bobber_nibble'), frameRate: fishing.bobberNibbleFps });
    this.anims.create({ key: 'fx_bobber_bite_once', frames: frames('fx_bobber_bite'), frameRate: fishing.bobberBiteFps });
  }

  create(): void {
    void this.bootArt
      .then(() => registerAtlasGroup(this.textures, 'boot'))
      .then(
        () => this.setup(),
        () => {
          // โหลดแผ่นรวมไม่ได้ (เน็ตหลุด) ลองโหลดไฟล์เดี่ยวเหมือนเดิม เกมจะได้ไม่ค้าง
          for (const id of idsInGroup('boot')) this.queue(id, registry[id]!);
          this.load.once(Phaser.Loader.Events.COMPLETE, () => this.setup());
          this.load.start();
        },
      );
  }

  private setup(): void {
    this.createFarmEffects();
    this.createBobberAnimations();
    prepareTreeSway(this);
    for (const [id, entry] of Object.entries(registry)) {
      if (entry.type === 'local' && id.startsWith('anim_cook_')) {
        this.createCookAnimations(id);
      } else if (entry.type === 'local' && (id.startsWith('anim_fish_') || id.startsWith('anim_wash_'))) {
        this.createPondAnimations(id, entry);
      } else if (entry.type === 'local' && id === 'anim_eat_south') {
        // ท่ากินค้างต้นและท้ายนานกว่า (docs/girl_eat_faint_art_2026-11-07.md)
        const frames = this.anims.generateFrameNumbers(id).map((frame, index) => ({ ...frame, duration: balance.player.eatFrameMs[index] }));
        this.anims.create({ key: id, frames, frameRate: 1, repeat: 0 });
      } else if (entry.type === 'local' && id === 'anim_faint_south') {
        this.anims.create({ key: id, frames: this.anims.generateFrameNumbers(id), frameRate: 1000 / balance.player.faintFrameMs, repeat: 0 });
      } else if (entry.type === 'local' && id.startsWith('anim_')) {
        this.anims.create({
          key: id,
          frames: this.anims.generateFrameNumbers(id, { start: entry.play_from ?? 0 }),
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
    // ภาพหน้าจอโหลดให้ครบก่อนเข้าเกม แต่ไม่รอเกิน PRELOAD_LIMIT_MS ถ้าเน็ตช้า
    const fonts = document.fonts.load(LABEL_FONT).catch(() => undefined);
    const art = Promise.race([preloadInterfaceArt(), new Promise((resolve) => window.setTimeout(resolve, PRELOAD_LIMIT_MS))]);
    void Promise.all([fonts, art]).finally(() => this.scene.start('Base'));
  }
}
