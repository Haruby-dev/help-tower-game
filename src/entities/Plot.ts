import Phaser from 'phaser';
import type { PlotState } from '../core/state';
import display from '../data/display.json';
import { isAsleep, isReady, stageOf } from '../systems/farm';

const TILLED_KEY = 'plot_tilled';
const FURROW_COLOR = 'rgba(70, 40, 28, 0.35)';
const FURROW_ROWS = [6, 14, 22];
const FURROW_HEIGHT = 3;
const FURROW_MARGIN = 3;
const SLEEP_FONT_PX = 8;
const SLEEP_LIFT = 26;
const SLEEP_DRIFT = 3;
const SLEEP_MS = 1100;
const READY_BOUNCE_MS = 420;
const READY_BOUNCE_PX = 1;
const POP_MS = 260;
const POP_LIFT_PX = 6;
const WAKE_STRETCH = 1.3;
const WAKE_MS = 320;

function ensureTilledTexture(scene: Phaser.Scene, size: number): void {
  if (scene.textures.exists(TILLED_KEY)) return;
  const canvas = scene.textures.createCanvas(TILLED_KEY, size, size)!;
  const context = canvas.getContext();
  context.fillStyle = FURROW_COLOR;
  for (const y of FURROW_ROWS) context.fillRect(FURROW_MARGIN, y, size - FURROW_MARGIN * 2, FURROW_HEIGHT);
  canvas.refresh();
}

const wetTint = Phaser.Display.Color.GetColor(
  Math.round(display.farm.wetSoilTint[0]! * 255),
  Math.round(display.farm.wetSoilTint[1]! * 255),
  Math.round(display.farm.wetSoilTint[2]! * 255),
);
const DRY_TINT = 0xffffff;

/** ภาพของแปลงหนึ่งช่อง อ่านจากความจริงใน GameState อย่างเดียว */
export class Plot {
  readonly centerX: number;
  readonly centerY: number;
  private readonly bottom: number;
  private readonly furrows: Phaser.GameObjects.Image;
  private readonly plant: Phaser.GameObjects.Sprite;
  private readonly sleepMark: Phaser.GameObjects.Text;
  private bounce: Phaser.Tweens.Tween | null = null;
  private shown: PlotState | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tile: Phaser.Tilemaps.Tile,
    depth: number,
  ) {
    const size = tile.width;
    this.centerX = tile.getCenterX();
    this.centerY = tile.getCenterY();
    this.bottom = tile.getBottom();
    ensureTilledTexture(scene, size);
    this.furrows = scene.add.image(this.centerX, this.centerY, TILLED_KEY).setDepth(depth).setVisible(false);
    this.plant = scene.add.sprite(this.centerX, this.bottom, '__DEFAULT').setOrigin(0.5, 1).setDepth(this.bottom).setVisible(false);
    this.sleepMark = scene.add
      .text(this.centerX, this.bottom - SLEEP_LIFT, 'Zzz', {
        fontFamily: 'Mali',
        fontSize: `${SLEEP_FONT_PX}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#5c304c',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(this.bottom + 1)
      .setVisible(false);
    scene.tweens.add({ targets: this.sleepMark, y: this.sleepMark.y - SLEEP_DRIFT, duration: SLEEP_MS, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  get label(): Phaser.GameObjects.Text {
    return this.sleepMark;
  }

  sync(state: PlotState): void {
    if (state === this.shown) return;
    this.shown = state;
    this.furrows.setVisible(state.tilled);
    this.tile.tint = state.watered ? wetTint : DRY_TINT;
    this.sleepMark.setVisible(isAsleep(state));
    if (state.crop) {
      this.plant.setTexture(`crop_${state.crop.id}`, stageOf(state)).setVisible(true);
    } else {
      this.plant.setVisible(false);
    }
    this.setReadyBounce(isReady(state));
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
