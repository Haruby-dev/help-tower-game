import Phaser from 'phaser';
import { registry } from '../core/assets';
import type { TextKey } from '../core/i18n';
import { t } from '../core/i18n';
import type { Rng } from '../core/rng';
import type { CookingSlot } from '../core/state';
import balance from '../data/balance.json';
import { MYSTERY, isCooked, minutesFor, recipes } from '../systems/cooking';

const OVERHEAD_LIFT = 60;
const RING_RADIUS = 7;
const RING_WIDTH = 2;
const STEAM_EVERY_MS = 420;
const WORD_EVERY_MS = 2400;
const WORD_FONT_PX = 8;
const DONE_BOUNCE_PX = 3;
const DONE_BOUNCE_MS = 360;
const PLACEHOLDER_SIZE = 20;
const PLACEHOLDER_COLOR = 0xf8b4cc;
const DEPTH = 8200;
const WORDS: TextKey[] = ['cook.word_chop', 'cook.word_stir', 'cook.word_top'];

/** ภาพบนกองไฟ วาดด้วยโค้ดทั้งหมด อ่านจากช่องทำอาหารใน GameState อย่างเดียว */
export class Campfire {
  private readonly ring: Phaser.GameObjects.Graphics;
  private done: Phaser.GameObjects.GameObject | null = null;
  private shownRecipe: string | null = null;
  private nextSteam = 0;
  private nextWord = 0;
  private wordIndex = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    private readonly rng: Rng,
    private readonly resolution: () => number,
  ) {
    this.ring = scene.add.graphics().setDepth(DEPTH);
  }

  sync(slot: CookingSlot | null, time: number): void {
    this.ring.clear();
    if (!isCooked(slot)) this.clearDone();
    if (!slot) return;
    if (isCooked(slot)) {
      this.showDone(slot.recipe);
      return;
    }
    this.drawRing(slot);
    if (time >= this.nextSteam) {
      this.nextSteam = time + STEAM_EVERY_MS;
      this.puffSteam();
    }
    if (time >= this.nextWord) {
      this.nextWord = time + WORD_EVERY_MS;
      this.popWord();
    }
  }

  private drawRing(slot: CookingSlot): void {
    const recipe = recipes[slot.recipe];
    const total = recipe ? minutesFor(recipe) : Math.max(slot.minutesLeft, 1);
    const share = Phaser.Math.Clamp(1 - slot.minutesLeft / total, 0, 1);
    const centerY = this.y - OVERHEAD_LIFT;
    const start = -Math.PI / 2;
    this.ring.lineStyle(RING_WIDTH, 0x5c304c, 0.85);
    this.ring.strokeCircle(this.x, centerY, RING_RADIUS);
    this.ring.lineStyle(RING_WIDTH, 0xffffff, 1);
    this.ring.beginPath();
    this.ring.arc(this.x, centerY, RING_RADIUS, start, start + share * Math.PI * 2);
    this.ring.strokePath();
  }

  private puffSteam(): void {
    const dot = this.scene.add
      .rectangle(this.x + this.rng.between(-6, 6), this.y - 24, 2, 2, 0xffffff, 0.8)
      .setDepth(DEPTH);
    this.scene.tweens.add({ targets: dot, y: dot.y - 14, alpha: 0, duration: 900, onComplete: () => dot.destroy() });
  }

  private popWord(): void {
    const key = WORDS[this.wordIndex % WORDS.length]!;
    this.wordIndex += 1;
    const word = this.scene.add
      .text(this.x + this.rng.between(-14, 14), this.y - OVERHEAD_LIFT - 12, t(key), {
        fontFamily: 'Mali',
        fontSize: `${WORD_FONT_PX}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#5c304c',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH + 1)
      .setResolution(this.resolution());
    this.scene.tweens.add({ targets: word, y: word.y - 8, alpha: 0, delay: 500, duration: 500, onComplete: () => word.destroy() });
  }

  private showDone(id: string): void {
    if (this.shownRecipe === id && this.done) return;
    this.clearDone();
    this.shownRecipe = id;
    const icon = id === MYSTERY ? balance.cooking.mystery.icon : recipes[id]?.icon;
    const y = this.y - OVERHEAD_LIFT;
    // ไอคอนอาหารที่ยังไม่มาใช้กล่องสีแทน สลับเป็นภาพจริงด้วยการแก้ทะเบียนและข้อมูลสูตร
    const shown =
      icon && registry[icon]
        ? this.scene.add.image(this.x, y, icon).setDepth(DEPTH)
        : this.scene.add.rectangle(this.x, y, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE, PLACEHOLDER_COLOR).setStrokeStyle(1, 0x5c304c).setDepth(DEPTH);
    this.scene.tweens.add({ targets: shown, y: y - DONE_BOUNCE_PX, duration: DONE_BOUNCE_MS, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.done = shown;
  }

  private clearDone(): void {
    if (!this.done) return;
    this.scene.tweens.killTweensOf(this.done);
    this.done.destroy();
    this.done = null;
    this.shownRecipe = null;
  }
}
