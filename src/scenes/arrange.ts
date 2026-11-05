import Phaser from 'phaser';
import type { Point } from '../core/state';
import balance from '../data/balance.json';

const CELL = 32;
const OK_COLOR = 0x6ccf6c;
const BAD_COLOR = 0xe05a5a;
const CELL_ALPHA = 0.5;
const GRID_COLOR = 0xffffff;
const GRID_ALPHA = 0.35;
const MOVABLE_ALPHA = 0.22;
/** นิ้วต้องขยับเกินเท่านี้ (พิกเซลเกม) จึงนับว่าลาก แตะเฉย ๆ นิ้วสั่นนิดหน่อยยังเป็นการหยิบ */
const DRAG_START_PX = 6;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Item {
  id: string;
  image: Phaser.GameObjects.Image;
  blocker: Phaser.GameObjects.Zone | null;
  cols: number;
  rows: number;
  zone: Rect;
  flat: boolean;
  onMove: (feet: Point) => void;
}

export interface ArrangeState {
  active: boolean;
  selected: string | null;
  valid: boolean;
}

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (a: Rect, b: Rect): boolean => a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;

/**
 * โหมดจัดวางแบบ Stardew: แตะของเพื่อหยิบ แตะช่องเพื่อลองวาง ช่องเขียววางได้ ช่องแดงวางไม่ได้
 * ของแต่ละชิ้นวางได้เฉพาะในโซนของมัน และห้ามทับของอื่น ตัวกันเดิน หรือตัวเอก
 */
export class Arranger {
  private readonly items = new Map<string, Item>();
  private readonly overlay: Phaser.GameObjects.Graphics;
  private selected: Item | null = null;
  private preview: Point | null = null;
  private before: Point | null = null;
  private dragging: { offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean } | null = null;
  active = false;

  constructor(
    scene: Phaser.Scene,
    depth: number,
    /** ช่องนี้มีของอื่นกันอยู่ไหม (ไม่นับตัวกันเดินของชิ้นที่กำลังย้าย) */
    private readonly blocked: (rect: Rect, ignore: Phaser.GameObjects.Zone | null) => boolean,
  ) {
    this.overlay = scene.add.graphics().setDepth(depth).setVisible(false);
  }

  register(id: string, image: Phaser.GameObjects.Image, blocker: Phaser.GameObjects.Zone | null, flat: boolean, onMove: (feet: Point) => void): void {
    const rule = balance.placement.items[id as keyof typeof balance.placement.items];
    if (!rule) return;
    const zone = balance.placement.zones[rule.zone as keyof typeof balance.placement.zones];
    if (!zone) throw new Error(`placement zone ${rule.zone} is missing`);
    const zonePx = { x: zone.x * CELL, y: zone.y * CELL, width: zone.width * CELL, height: zone.height * CELL };
    this.items.set(id, { id, image, blocker, cols: rule.cols, rows: rule.rows, zone: zonePx, flat, onMove });
  }

  get movableIds(): string[] {
    return [...this.items.keys()];
  }

  zoneCenter(): Point | null {
    const first = this.items.values().next().value as Item | undefined;
    return first ? { x: first.zone.x + first.zone.width / 2, y: first.zone.y + first.zone.height / 2 } : null;
  }

  positionOf(id: string): Point | null {
    const item = this.items.get(id);
    return item ? { x: item.image.x, y: item.image.y } : null;
  }

  private footprint(item: Item, feet: Point): Rect {
    return { x: feet.x - (item.cols * CELL) / 2, y: feet.y - item.rows * CELL, width: item.cols * CELL, height: item.rows * CELL };
  }

  /** ช่องที่แตะเป็นช่องซ้าย (หรือช่องกลางถ้ากว้างเป็นเลขคี่) ของฐาน ฐานชิดตาราง เท้าอยู่กลางขอบล่างของฐาน */
  private snap(item: Item, worldX: number, worldY: number): Point {
    const left = (Math.floor(worldX / CELL) - Math.floor((item.cols - 1) / 2)) * CELL;
    const top = Math.floor(worldY / CELL) * CELL - (item.rows - 1) * CELL;
    return { x: left + (item.cols * CELL) / 2, y: top + item.rows * CELL };
  }

  canPlace(id: string, feet: Point, player: Rect): boolean {
    const item = this.items.get(id);
    if (!item) return false;
    const rect = this.footprint(item, feet);
    if (!inside(rect, item.zone)) return false;
    if (overlaps(rect, player)) return false;
    for (const other of this.items.values()) {
      if (other !== item && overlaps(rect, this.footprint(other, { x: other.image.x, y: other.image.y }))) return false;
    }
    return !this.blocked(rect, item.blocker);
  }

  /** ย้ายของไปที่เท้าใหม่ทันที ใช้ทั้งตอนวางและตอนโหลดเซฟ */
  apply(id: string, feet: Point): void {
    const item = this.items.get(id);
    if (!item) return;
    item.image.setPosition(feet.x, feet.y);
    if (!item.flat) item.image.setDepth(feet.y);
    if (item.blocker) {
      item.blocker.setPosition(feet.x, feet.y - item.blocker.height / 2);
      (item.blocker.body as Phaser.Physics.Arcade.StaticBody | null)?.updateFromGameObject();
    }
    item.onMove(feet);
  }

  enter(): void {
    this.active = true;
    this.selected = null;
    this.preview = null;
    this.overlay.setVisible(true);
  }

  exit(): void {
    this.cancel();
    this.active = false;
    this.overlay.setVisible(false).clear();
  }

  /** ของที่อยู่ใต้จุดนี้ (ภาพหรือฐาน) */
  private itemAt(worldX: number, worldY: number): Item | undefined {
    return [...this.items.values()].find((item) => {
      const rect = this.footprint(item, { x: item.image.x, y: item.image.y });
      const art = item.image.getBounds();
      return Phaser.Geom.Rectangle.Contains(art, worldX, worldY) || (worldX >= rect.x && worldX < rect.x + rect.width && worldY >= rect.y && worldY < rect.y + rect.height);
    });
  }

  private showAt(item: Item, feet: Point): void {
    item.image.setPosition(feet.x, feet.y);
    if (!item.flat) item.image.setDepth(feet.y);
  }

  /**
   * กดที่ของ: หยิบแล้วลากได้ (ผู้ใช้ขอ 5 พ.ย. 2026) · กดที่อื่นตอนหยิบของอยู่: ลองวางที่ช่องนั้น
   * ปล่อยนิ้วหลังลาก ถ้าวางได้วางเลย ถ้าวางไม่ได้ของกลับที่เดิม
   */
  press(worldX: number, worldY: number): void {
    const hit = this.itemAt(worldX, worldY);
    if (hit && (!this.selected || this.selected === hit || this.preview === null)) {
      if (this.selected && this.selected !== hit) this.cancel();
      if (!this.selected) {
        this.selected = hit;
        this.before = { x: hit.image.x, y: hit.image.y };
        this.preview = null;
      }
      this.dragging = { offsetX: hit.image.x - worldX, offsetY: hit.image.y - worldY, startX: worldX, startY: worldY, moved: false };
      return;
    }
    if (!this.selected) return;
    this.preview = this.snap(this.selected, worldX, worldY);
    this.showAt(this.selected, this.preview);
  }

  /** ลาก: ฐานชิดตารางตามนิ้ว โดยจุดที่จับของยังอยู่ใต้นิ้ว */
  drag(worldX: number, worldY: number): void {
    const item = this.selected;
    if (!item || !this.dragging) return;
    if (!this.dragging.moved && Math.hypot(worldX - this.dragging.startX, worldY - this.dragging.startY) < DRAG_START_PX) return;
    const feetX = worldX + this.dragging.offsetX;
    const feetY = worldY + this.dragging.offsetY;
    const left = Math.round((feetX - (item.cols * CELL) / 2) / CELL) * CELL;
    const bottom = Math.round(feetY / CELL) * CELL;
    const next = { x: left + (item.cols * CELL) / 2, y: bottom };
    if (next.x === item.image.x && next.y === item.image.y) return;
    this.dragging.moved = true;
    this.preview = next;
    this.showAt(item, next);
  }

  /** ปล่อยนิ้ว: ถ้าลากมาแล้ว วางเลยเมื่อวางได้ ไม่งั้นกลับที่เดิม · แค่แตะของยังหยิบอยู่ให้แตะช่องต่อ */
  release(player: Rect): { id: string; feet: Point } | null {
    const dragging = this.dragging;
    this.dragging = null;
    if (!dragging?.moved) return null;
    const placed = this.place(player);
    if (!placed) this.cancel();
    return placed;
  }

  /** วางของที่หยิบไว้ ตอบตำแหน่งที่วางได้ ถ้าวางไม่ได้ตอบ null */
  place(player: Rect): { id: string; feet: Point } | null {
    const item = this.selected;
    if (!item || !this.preview || !this.before) return null;
    // ตรวจกับตำแหน่งเดิมของชิ้นนี้ ไม่ใช่ภาพที่ลากมาแล้ว
    item.image.setPosition(this.before.x, this.before.y);
    if (!this.canPlace(item.id, this.preview, player)) {
      item.image.setPosition(this.preview.x, this.preview.y);
      return null;
    }
    const feet = this.preview;
    this.apply(item.id, feet);
    this.selected = null;
    this.preview = null;
    this.before = null;
    return { id: item.id, feet };
  }

  cancel(): void {
    this.dragging = null;
    if (this.selected && this.before) {
      this.selected.image.setPosition(this.before.x, this.before.y);
      if (!this.selected.flat) this.selected.image.setDepth(this.before.y);
    }
    this.selected = null;
    this.preview = null;
    this.before = null;
  }

  state(player: Rect): ArrangeState {
    if (!this.active) return { active: false, selected: null, valid: false };
    const item = this.selected;
    let valid = false;
    if (item && this.preview && this.before) {
      item.image.setPosition(this.before.x, this.before.y);
      valid = this.canPlace(item.id, this.preview, player);
      item.image.setPosition(this.preview.x, this.preview.y);
    }
    return { active: true, selected: item?.id ?? null, valid };
  }

  /** ตารางในโซน ฐานของชิ้นที่ย้ายได้ และช่องเขียวแดงของชิ้นที่กำลังลองวาง */
  draw(player: Rect): void {
    if (!this.active) return;
    const g = this.overlay.clear();
    const first = this.items.values().next().value as Item | undefined;
    if (first) {
      const { zone } = first;
      g.lineStyle(1, GRID_COLOR, GRID_ALPHA);
      for (let x = zone.x; x <= zone.x + zone.width; x += CELL) g.lineBetween(x, zone.y, x, zone.y + zone.height);
      for (let y = zone.y; y <= zone.y + zone.height; y += CELL) g.lineBetween(zone.x, y, zone.x + zone.width, y);
    }
    for (const item of this.items.values()) {
      if (item === this.selected) continue;
      const rect = this.footprint(item, { x: item.image.x, y: item.image.y });
      g.fillStyle(GRID_COLOR, MOVABLE_ALPHA).fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    const item = this.selected;
    if (!item) return;
    const at = this.preview ?? { x: item.image.x, y: item.image.y };
    const ok = this.preview ? this.state(player).valid : true;
    const rect = this.footprint(item, at);
    for (let x = rect.x; x < rect.x + rect.width; x += CELL) {
      for (let y = rect.y; y < rect.y + rect.height; y += CELL) {
        g.fillStyle(ok ? OK_COLOR : BAD_COLOR, CELL_ALPHA).fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      }
    }
    g.lineStyle(1, ok ? OK_COLOR : BAD_COLOR, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
  }
}
