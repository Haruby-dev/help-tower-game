import Phaser from 'phaser';
import type { Tray } from '../core/state';
import balance from '../data/balance.json';
import { parseDish, recipes } from '../systems/cooking';
import { setArtKey } from './monsterArt';
import { platePoints, trayArt } from '../systems/tray';
import { foodArtKey } from './monsterArt';

type Point = { x: number; y: number };
/** อาหารจิ๋ววางกลางจาน ฐานต่ำกว่ากลางจาน 2 พิกเซล */
const MOUND_DROP_PX = 2;

/** อาหารจิ๋วบนจานถาด เมนูเดิมซ้อนสูงขึ้นตามจำนวน อ่านจาก GameState อย่างเดียว */
export class TrayView {
  private piles: Phaser.GameObjects.Image[] = [];
  private shown: Tray | null = null;
  private corner = { x: Number.NaN, y: Number.NaN };

  constructor(
    private readonly scene: Phaser.Scene,
    readonly image: Phaser.GameObjects.Image,
  ) {}

  /** กลางจานใบนี้บนแผนที่ */
  platePoint(level: number, index: number): Point {
    const corner = this.image.getTopLeft();
    const [x, y] = platePoints(level)[index] ?? [0, 0];
    return { x: Math.round(corner.x + x), y: Math.round(corner.y + y) };
  }

  /** ขอบล่างของถาด (ระดับเท้า) และซ้ายขวา ใช้วางทางเดินของมอนสเตอร์ */
  get bounds(): { left: number; right: number; bottom: number; centerX: number } {
    const corner = this.image.getTopLeft();
    return { left: corner.x, right: corner.x + this.image.width, bottom: this.image.y, centerX: this.image.x };
  }

  sync(tray: Tray): void {
    const corner = this.image.getTopLeft();
    if (tray === this.shown && corner.x === this.corner.x && corner.y === this.corner.y) return;
    this.shown = tray;
    this.corner = { x: corner.x, y: corner.y };
    const art = trayArt(tray.level);
    if (this.image.texture.key !== art && this.scene.textures.exists(art)) this.image.setTexture(art);
    for (const pile of this.piles) pile.destroy();
    this.piles = [];
    const { stackStepPx, stackShownMax } = balance.tray;
    tray.plates.forEach((plate, index) => {
      if (!plate) return;
      // ชุดถาดเล็กบนจานใช้ไอคอนถาดสานเล็กขนาดจริง (ผู้ใช้เลือก 9 พ.ย. 2026 แทนการย่อภาพชุด)
      const key = setArtKey(plate.item) ?? foodArtKey(this.scene, parseDish(plate.item).recipe, recipes[parseDish(plate.item).recipe]?.icon);
      const center = this.platePoint(tray.level, index);
      for (let layer = 0; layer < Math.min(plate.count, stackShownMax); layer += 1) {
        const pile = this.scene.add
          .image(center.x, center.y + MOUND_DROP_PX - layer * stackStepPx, key)
          .setOrigin(0.5, 1)
          .setDepth(this.image.depth + 0.1 + layer * 0.01)
          .setName(`tray_pile_${index}`);
        this.piles.push(pile);
      }
    });
  }
}
