import Phaser from 'phaser';
import type { PlotState } from '../core/state';
import { isAsleep, isReady, isWithered, stageOf } from '../systems/farm';

const SLEEP_LIFT = 34;
const READY_BOUNCE_MS = 420;
const READY_BOUNCE_PX = 1;
const READY_SPARKLE_LIFT = 26;
const POP_MS = 260;
const POP_LIFT_PX = 6;
const WAKE_STRETCH = 1.3;
const WAKE_MS = 320;
/** ประกายปุ๋ยตามภาพตัวอย่าง: 1 จังหวะ 110 ms · ระดับ 2 เฟรมละ 3 จังหวะ วน 8 ช่อง (4 เฟรมแล้วพักเท่ากัน) · ระดับ 3 เฟรมละ 2 จังหวะ วน 7 ช่อง (5 เฟรมแล้วพัก) */
const TWINKLE_TICK_MS = 110;
const TWINKLES: Record<number, { key: string; frames: number; ticksPerFrame: number; slots: number; spots: [number, number][] }> = {
  2: { key: 'fx_fert2_twinkle', frames: 4, ticksPerFrame: 3, slots: 8, spots: [[4, 14], [24, 4]] },
  3: { key: 'fx_fert3_twinkle', frames: 5, ticksPerFrame: 2, slots: 7, spots: [[2, 8], [22, 18], [14, 0], [21, 10]] },
};

/** แปลงว่างเห็นแปลงพรวน ต้นที่รดน้ำแล้วมีรอยดินชื้นใต้ต้น ต้นอื่นเห็นแค่กองดินของตัวเอง */
function bedTexture(state: PlotState): string | null {
  if (state.crop) return state.watered ? 'soil_damp' : null;
  if (!state.tilled) return null;
  return state.watered ? 'soil_tilled_wet' : 'soil_tilled';
}

/** ภาพของแปลงหนึ่งช่อง อ่านจากความจริงใน GameState อย่างเดียว */
export class Plot {
  readonly centerX: number;
  readonly centerY: number;
  private readonly bottom: number;
  private readonly bed: Phaser.GameObjects.Image;
  private readonly plant: Phaser.GameObjects.Sprite;
  private readonly sleepMark: Phaser.GameObjects.Sprite;
  private readonly readyMark: Phaser.GameObjects.Sprite;
  private bounce: Phaser.Tweens.Tween | null = null;
  private shown: PlotState | null = null;
  private readonly left: number;
  private readonly top: number;
  /** ประกายบนแปลงที่ใส่ปุ๋ย จนกว่าจะเก็บเกี่ยว แต่ละจุดเริ่มคนละจังหวะ จึงไม่กะพริบพร้อมกัน */
  private twinkles: { sprite: Phaser.GameObjects.Sprite; offset: number }[] = [];
  private twinkleTier = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    tile: Phaser.Tilemaps.Tile,
    depth: number,
  ) {
    this.centerX = tile.getCenterX();
    this.centerY = tile.getCenterY();
    this.bottom = tile.getBottom();
    this.left = tile.getLeft();
    this.top = tile.getTop();
    this.bed = scene.add.image(this.centerX, this.centerY, 'soil_tilled').setDepth(depth).setVisible(false);
    this.plant = scene.add.sprite(this.centerX, this.bottom, '__DEFAULT').setOrigin(0.5, 1).setDepth(this.bottom).setVisible(false);
    this.sleepMark = scene.add
      .sprite(this.centerX, this.bottom - SLEEP_LIFT, 'fx_zzz')
      .setDepth(this.bottom + 1)
      .setVisible(false)
      .play('fx_zzz_loop');
    this.readyMark = scene.add
      .sprite(this.centerX, this.bottom - READY_SPARKLE_LIFT, 'fx_sparkle')
      .setDepth(this.bottom + 1)
      .setVisible(false)
      .play('fx_sparkle_idle');
  }

  /** ตอบ true เมื่อต้นนี้เพิ่งพร้อมเก็บ (ประกายเพิ่งขึ้น) ไม่นับตอนสร้างแปลงครั้งแรก */
  sync(state: PlotState): boolean {
    if (state === this.shown) return false;
    const wasReady = this.shown === null ? null : isReady(this.shown);
    this.shown = state;
    const bed = bedTexture(state);
    this.bed.setVisible(bed !== null);
    if (bed) this.bed.setTexture(bed);
    this.sleepMark.setVisible(isAsleep(state));
    this.readyMark.setVisible(isReady(state));
    if (state.crop && isWithered(state)) {
      this.plant.setTexture(`withered_${state.crop.id}`).setVisible(true);
    } else if (state.crop) {
      this.plant.setTexture(`crop_${state.crop.id}`, stageOf(state)).setVisible(true);
    } else {
      this.plant.setVisible(false);
    }
    this.setReadyBounce(isReady(state));
    this.setTwinkles(state.fertilizer ?? 0);
    return wasReady === false && isReady(state);
  }

  private setReadyBounce(ready: boolean): void {
    if (ready === (this.bounce !== null)) return;
    this.bounce?.remove();
    this.bounce = null;
    this.plant.setY(this.bottom);
    if (!ready) return;
    this.bounce = this.scene.tweens.add({
      targets: this.plant,
      y: this.bottom - READY_BOUNCE_PX,
      duration: READY_BOUNCE_MS,
      yoyo: true,
      repeat: -1,
      ease: 'Stepped',
    });
  }

  private setTwinkles(tier: number): void {
    if (tier === this.twinkleTier) return;
    this.twinkleTier = tier;
    for (const twinkle of this.twinkles) twinkle.sprite.destroy();
    const kind = TWINKLES[tier];
    this.twinkles = (kind?.spots ?? []).map(([x, y]) => ({
      sprite: this.scene.add.sprite(this.left + x, this.top + y, kind!.key, 0).setOrigin(0).setDepth(this.bottom + 0.5).setVisible(false),
      offset: Math.floor(Math.random() * kind!.slots * kind!.ticksPerFrame),
    }));
  }

  /** ฉากเรียกทุกเฟรม เปลี่ยนเฟรมประกายตามจังหวะ */
  tick(time: number): void {
    const kind = TWINKLES[this.twinkleTier];
    if (!kind) return;
    const tick = Math.floor(time / TWINKLE_TICK_MS);
    for (const { sprite, offset } of this.twinkles) {
      const slot = Math.floor((tick + offset) / kind.ticksPerFrame) % kind.slots;
      sprite.setVisible(slot < kind.frames);
      if (slot < kind.frames) sprite.setFrame(slot);
    }
  }

  /** ต้นอ่อนเด้งขึ้นมาตอนปลูกเสร็จ */
  pop(): void {
    this.scene.tweens.add({ targets: this.plant, y: this.bottom - POP_LIFT_PX, duration: POP_MS / 2, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** ได้น้ำแล้วยืดตัวตื่น ตามแบบที่ผู้ใช้อนุมัติ ไม่ได้ย่อขยายภาพถาวร */
  wake(): void {
    this.plant.setScale(1, WAKE_STRETCH);
    this.scene.tweens.add({ targets: this.plant, scaleY: 1, duration: WAKE_MS, ease: 'Back.easeOut' });
  }
}
