import Phaser from 'phaser';
import { registry } from '../core/assets';
import type { Point } from '../core/state';
import balance from '../data/balance.json';
import { linePoints } from '../scenes/pondMath';

type BobberKind = 'idle' | 'nibble' | 'bite';

const LINE_COLOR = 0xf4f0e6;
const LINE_ALPHA = 1;
/** สายเบ็ดหย่อนลงกลางเส้นเล็กน้อย */
const LINE_SAG_PX = 3;
const LINE_STEPS = 24;
const MARK_KEY = 'fx_bite_mark';
const MARK_LIFT_PX = 74;
const MARK_HOP_PX = 2;
const MARK_HOP_MS = 120;
const OUTLINE = 0x5c304c;
const MARK_RED = 0xe0475e;
const DEPTH_ABOVE = 0.5;

function anchorsOf(id: string): { anchors: Record<string, [number, number]>; pivot: [number, number] } {
  const entry = registry[id];
  if (entry?.type !== 'local' || !entry.anchors || !entry.pivot) throw new Error(`${id} has no anchors in the registry`);
  return { anchors: entry.anchors, pivot: entry.pivot };
}

/** เครื่องหมาย "!" วาดด้วยโค้ดทีละพิกเซล กรอบสีเดียวกับ UI */
function createMarkTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(MARK_KEY)) return;
  const g = scene.make.graphics({}, false);
  g.fillStyle(OUTLINE).fillRect(1, 0, 7, 13).fillRect(0, 1, 9, 11);
  g.fillStyle(0xffffff).fillRect(1, 1, 7, 11);
  g.fillStyle(MARK_RED).fillRect(3, 2, 3, 6).fillRect(4, 8, 1, 1).fillRect(3, 9, 3, 2);
  g.generateTexture(MARK_KEY, 9, 13);
  g.destroy();
}

/** ทุ่นกับสายเบ็ด สายลากจากปลายคันในเฟรมของตัวละครไปถึงปลายเสาทุ่นของเฟรมนั้น */
export class FishingRig {
  private readonly bobber: Phaser.GameObjects.Sprite;
  private readonly line: Phaser.GameObjects.Graphics;
  private readonly mark: Phaser.GameObjects.Image;
  private kind: BobberKind = 'idle';
  private spot: Point = { x: 0, y: 0 };
  /** 1 คือสายยาวถึงทุ่น ตอนม้วนสายค่อย ๆ ลดเป็น 0 */
  private reach = 1;
  private reelEnd: Point | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    createMarkTexture(scene);
    const { pivot } = anchorsOf('fx_bobber_idle');
    this.bobber = scene.add.sprite(0, 0, 'fx_bobber_idle').setOrigin(pivot[0] / 16, pivot[1] / 16).setVisible(false);
    this.line = scene.add.graphics().setVisible(false);
    this.mark = scene.add.image(0, 0, MARK_KEY).setOrigin(0.5, 1).setVisible(false);
  }

  show(spot: Point): void {
    this.spot = spot;
    this.reach = 1;
    this.reelEnd = null;
    this.bobber.setPosition(spot.x, spot.y).setDepth(spot.y).setVisible(true);
    this.play('idle', 'fx_bobber_idle_loop');
    this.line.setVisible(true);
  }

  private play(kind: BobberKind, key: string): void {
    this.kind = kind;
    this.bobber.play(key);
  }

  /** ปลาตอด 1–2 ครั้งก่อนขึ้น "!" จังหวะเท่ากันทุกครั้ง: ตอด · พัก · ตอด · พัก แล้วทุ่นจม */
  nibble(times: number, gapMs: number, leadMs: number, onDone: () => void, onEach?: () => void): void {
    let left = times;
    const once = (): void => {
      this.play('nibble', 'fx_bobber_nibble_once');
      onEach?.();
      this.bobber.once(`${Phaser.Animations.Events.ANIMATION_COMPLETE_KEY}fx_bobber_nibble_once`, () => {
        left -= 1;
        this.play('idle', 'fx_bobber_idle_loop');
        this.scene.time.delayedCall(left > 0 ? gapMs : leadMs, () => {
          if (!this.bobber.visible) return;
          if (left > 0) once();
          else onDone();
        });
      });
    };
    once();
  }

  /** ทุ่นจมเล่นครั้งเดียวแล้วค้างเฟรมสุดท้ายจนกว่าจะดึงหรือหมดเวลา */
  bite(): void {
    this.play('bite', 'fx_bobber_bite_once');
  }

  showMark(x: number, feetY: number): void {
    this.mark.setPosition(Math.round(x), Math.round(feetY - MARK_LIFT_PX)).setDepth(feetY + DEPTH_ABOVE).setVisible(true);
    this.scene.tweens.add({ targets: this.mark, y: this.mark.y - MARK_HOP_PX, duration: MARK_HOP_MS, yoyo: true, repeat: 2 });
  }

  hideMark(): void {
    this.scene.tweens.killTweensOf(this.mark);
    this.mark.setVisible(false);
  }

  /** ซ่อนทุ่นแล้วม้วนสายกลับเข้าปลายคัน */
  reel(onDone: () => void): void {
    this.hideMark();
    this.reelEnd = this.antennaTip();
    this.bobber.setVisible(false).stop();
    this.scene.tweens.addCounter({
      from: 1,
      to: 0,
      duration: balance.fishing.reelMs,
      onUpdate: (tween) => {
        this.reach = tween.getValue() ?? 0;
      },
      onComplete: () => {
        this.hide();
        onDone();
      },
    });
  }

  hide(): void {
    this.hideMark();
    this.bobber.setVisible(false).stop();
    this.line.clear().setVisible(false);
    this.reelEnd = null;
  }

  private antennaTip(): Point {
    const { anchors, pivot } = anchorsOf(`fx_bobber_${this.kind}`);
    const frame = Number(this.bobber.frame.name) || 0;
    const tip = anchors[String(frame)] ?? pivot;
    return { x: this.spot.x - pivot[0] + tip[0], y: this.spot.y - pivot[1] + tip[1] };
  }

  /** วาดสายทีละพิกเซลเต็มทุกเฟรม rod คือปลายคันบนโลก สายอยู่หน้าตัวละครเสมอ */
  drawLine(rod: Point, feetY: number): void {
    if (!this.line.visible) return;
    const end = this.reelEnd ?? this.antennaTip();
    const toX = rod.x + (end.x - rod.x) * this.reach;
    const toY = rod.y + (end.y - rod.y) * this.reach;
    const g = this.line.clear().setDepth(Math.max(feetY, toY) + DEPTH_ABOVE);
    g.fillStyle(LINE_COLOR, LINE_ALPHA);
    let last: Point = { x: Math.round(rod.x), y: Math.round(rod.y) };
    for (let step = 1; step <= LINE_STEPS; step += 1) {
      const t = step / LINE_STEPS;
      const sag = LINE_SAG_PX * this.reach * 4 * t * (1 - t);
      const next = { x: Math.round(rod.x + (toX - rod.x) * t), y: Math.round(rod.y + (toY - rod.y) * t + sag) };
      for (const [x, y] of linePoints(last.x, last.y, next.x, next.y)) g.fillRect(x, y, 1, 1);
      last = next;
    }
  }
}
