import Phaser from 'phaser';
import type { World } from '../core/state';
import { isDryingReady, stationTable, trapSet } from '../systems/stations';
import { footY } from '../core/assets';

/**
 * ภาพถาดตากกับลอบในฉาก (งานอาหารโซน 1 ขั้นที่ 5)
 * ถาดตาก: อยู่ลานหน้าบ้าน ย้ายได้ในโหมดจัดวาง วาดของที่ตากเป็นภาพจิ๋ว (ไม่ย่อภาพ) แห้งแล้วเปลี่ยนเป็นของแห้งพร้อมประกาย
 * ลอบ: อยู่บนฝั่งริมบ่อ วางแล้วย้ายลงน้ำ ระลอกรอบลอบวาดใน Pond.ts
 */
const TILE = 32;
/** ที่วางภาพจิ๋วบนถาด (พิกเซลจากเท้าถาด) 1–3 ชิ้นตามจำนวนของ */
const TRAY_MINIS = [
  { x: -7, y: -30 },
  { x: 7, y: -30 },
  { x: 0, y: -26 },
];
const MINI_STEPS = [1, 4, 7];
const SPARKLE_LIFT = { x: 12, y: -40 };

export interface Station {
  kind: 'drying' | 'trap';
  index: number;
  /** ภาพที่มองเห็น ใช้ตรวจการแตะ */
  image: Phaser.GameObjects.Image;
  /** จุดที่ตัวเอกยืนใช้ ลอบใช้ที่บนฝั่งเสมอ (ลอบในน้ำเอื้อมจากฝั่ง) */
  x: number;
  y: number;
}

interface TraySprites {
  image: Phaser.GameObjects.Image;
  minis: Phaser.GameObjects.Image[];
  sparkle: Phaser.GameObjects.Sprite;
  shown: string;
}

export class StationsView {
  readonly trays: TraySprites[] = [];
  private readonly traps: { land: Phaser.GameObjects.Image; water: Phaser.GameObjects.Image }[] = [];
  private trapKey = '';

  constructor(
    private readonly scene: Phaser.Scene,
    /** ถาดใบใหม่: ให้ฉากลงทะเบียนกับโหมดจัดวางและหาที่วาง */
    private readonly onNewTray: (index: number, image: Phaser.GameObjects.Image) => void,
    /** ลอบในน้ำเปลี่ยน: ส่งจุดระลอกให้บ่อ (พิกเซลแผนที่) */
    private readonly onTrapsInWater: (points: { x: number; y: number }[]) => void,
  ) {}

  /** ตามจำนวนถาดกับลอบที่มีและสถานะในเซฟ เรียกทุกเฟรม เปลี่ยนภาพเฉพาะตอนสถานะเปลี่ยน */
  sync(world: World): void {
    while (this.trays.length < world.crafting.stations.drying_tray) this.addTray(this.trays.length);
    this.trays.forEach((tray, index) => this.syncTray(world, tray, index));
    while (this.traps.length < Math.min(world.crafting.stations.trap, stationTable.trap.spots.length)) this.addTrap(this.traps.length);
    const key = this.traps.map((_, index) => (trapSet(world, index) ? 'w' : 'l')).join('');
    if (key !== this.trapKey) {
      this.trapKey = key;
      const inWater: { x: number; y: number }[] = [];
      this.traps.forEach((trap, index) => {
        const wet = trapSet(world, index) !== null;
        trap.land.setVisible(!wet);
        trap.water.setVisible(wet);
        if (wet) inWater.push({ x: trap.water.x, y: trap.water.y });
      });
      this.onTrapsInWater(inWater);
    }
  }

  /** ถาดตากหรือลอบที่ภาพมองเห็นอยู่ ใช้หาที่ใกล้ตัวเอกและที่แตะ */
  stations(world: World): Station[] {
    const list: Station[] = this.trays.map((tray, index) => ({ kind: 'drying', index, image: tray.image, x: tray.image.x, y: tray.image.y }));
    this.traps.forEach((trap, index) => list.push({ kind: 'trap', index, image: trapSet(world, index) ? trap.water : trap.land, x: trap.land.x, y: trap.land.y }));
    return list;
  }

  private addTray(index: number): void {
    const image = this.scene.add.image(0, 0, 'drying_tray').setOrigin(0.5, footY('drying_tray') / 48);
    const minis = TRAY_MINIS.map(() => this.scene.add.image(0, 0, 'drying_tray').setVisible(false));
    const sparkle = this.scene.add.sprite(0, 0, 'fx_sparkle').setVisible(false);
    const tray: TraySprites = { image, minis, sparkle, shown: '' };
    this.trays.push(tray);
    const prefer = stationTable.drying.prefer[index] ?? stationTable.drying.prefer[0]!;
    image.setPosition((prefer.x + 0.5) * TILE, (prefer.y + 1) * TILE).setDepth(image.y);
    this.onNewTray(index, image);
  }

  private syncTray(world: World, tray: TraySprites, index: number): void {
    const slot = world.crafting.drying[index] ?? null;
    const ready = isDryingReady(world, index);
    const shows = slot ? (ready ? stationTable.drying.recipes[slot.recipe]!.out : slot.shows) : '';
    const key = `${shows}:${slot?.count ?? 0}:${tray.image.x},${tray.image.y}`;
    if (key === tray.shown) return;
    tray.shown = key;
    const mini = shows ? `ing_mini_${shows.toLowerCase()}` : '';
    const usable = mini !== '' && this.scene.textures.exists(mini);
    const pieces = slot && usable ? MINI_STEPS.filter((from) => slot.count >= from).length : 0;
    tray.minis.forEach((image, at) => {
      const spot = TRAY_MINIS[at]!;
      image.setVisible(at < pieces);
      if (at >= pieces) return;
      image.setTexture(mini).setPosition(Math.round(tray.image.x + spot.x), Math.round(tray.image.y + spot.y)).setDepth(tray.image.depth + 0.01 + at * 0.001);
    });
    tray.sparkle.setVisible(ready);
    if (ready) {
      tray.sparkle.setPosition(tray.image.x + SPARKLE_LIFT.x, tray.image.y + SPARKLE_LIFT.y).setDepth(tray.image.depth + 0.02);
      if (!tray.sparkle.anims.isPlaying) tray.sparkle.play('fx_sparkle_idle');
    } else tray.sparkle.stop();
  }

  private addTrap(index: number): void {
    const spot = stationTable.trap.spots[index]!;
    const land = this.scene.add.image((spot.land.x + 0.5) * TILE, (spot.land.y + 1) * TILE, 'trap').setOrigin(0.5, footY('trap') / 32);
    land.setDepth(land.y);
    const water = this.scene.add.image((spot.water.x + 0.5) * TILE, (spot.water.y + 1) * TILE, 'trap_water').setOrigin(0.5, 1).setVisible(false);
    water.setDepth(water.y);
    this.traps.push({ land, water });
    this.trapKey = '';
  }
}
