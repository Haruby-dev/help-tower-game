import Phaser from 'phaser';
import { footY } from '../core/assets';
import { registerSlice } from '../core/atlas';
import type { Rng } from '../core/rng';
import type { Point, World } from '../core/state';
import balance from '../data/balance.json';
import { carePets, petInfo } from '../systems/pets';

const rules = balance.pets;
const TILE = 32;
/** ตัวที่บาดเจ็บสั่นเบา ๆ 1 พิกเซล ตัวที่หายแล้วลอยขึ้นลง 1 พิกเซล (ภาพท่าเดินยังไม่มา ใช้ภาพหันหน้านิ่ง) */
const SHIVER_MS = 700;

interface PetSprite {
  id: string;
  image: Phaser.GameObjects.Image;
  /** จุดของตัวนี้ (เท้า) เดินเล่นรอบ ๆ จุดนี้ */
  anchor: Point;
  stage: string;
  target: Point | null;
  restUntil: number;
  feetX: number;
  feetY: number;
}

export interface PetSpot {
  id: string;
  x: number;
  y: number;
  /** หัว (ใช้วางฟองคำพูด) */
  headY: number;
}

const tile = ([x, y]: readonly [number, number]): Point => ({ x: x * TILE, y: y * TILE });

/**
 * สัตว์เลี้ยงในลานบ้าน (M8b): ตัวที่รักษาอยู่นอนหน้าบ้านที่ sickSpots · ตัวที่อยู่ด้วยแล้วอยู่ข้างบ้านของตัวเอง
 * (หนึบหนับริมบ่อ บับเบิ้ลในบ่อ) เดินเล่นช้า ๆ รอบจุดของตัวเอง ไม่มีตัวชน
 */
export class PetsView {
  private readonly sprites = new Map<string, PetSprite>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rng: Rng,
    /** เท้าของบ้านหลังนี้ตอนนี้ (บ้านย้ายได้ในโหมดจัดวาง) */
    private readonly homeFeet: (home: string) => Point | null,
  ) {}

  /** สร้าง ลบ และย้ายจุดของสัตว์ให้ตรงกับโลก */
  sync(world: World): void {
    for (const [id, sprite] of this.sprites) {
      if (!world.pets[id]) {
        sprite.image.destroy();
        this.sprites.delete(id);
      }
    }
    carePets().forEach((pet, index) => {
      const state = world.pets[pet.id];
      if (!state) return;
      const anchor = this.anchorOf(pet.id, state.stage, index);
      if (!anchor) return;
      let sprite = this.sprites.get(pet.id);
      if (!sprite) {
        const key = `pet_${pet.id}_south`;
        if (!registerSlice(this.scene.textures, key) && !this.scene.textures.exists(key)) return;
        const image = this.scene.add.image(anchor.x, anchor.y, key).setOrigin(0.5, footY(key) / this.scene.textures.get(key).getSourceImage().height);
        sprite = { id: pet.id, image, anchor, stage: '', target: null, restUntil: 0, feetX: anchor.x, feetY: anchor.y };
        this.sprites.set(pet.id, sprite);
      }
      if (sprite.stage !== state.stage || Math.hypot(sprite.anchor.x - anchor.x, sprite.anchor.y - anchor.y) > 1) {
        sprite.stage = state.stage;
        sprite.anchor = anchor;
        sprite.feetX = anchor.x;
        sprite.feetY = anchor.y;
        sprite.target = null;
      }
    });
  }

  private anchorOf(id: string, stage: string, index: number): Point | null {
    if (stage === 'treating' || stage === 'needs_home') {
      const spot = rules.sickSpots[index % rules.sickSpots.length];
      return spot ? tile(spot as [number, number]) : null;
    }
    const pond = (rules.pondSpots as Record<string, number[]>)[id];
    if (pond) return tile(pond as [number, number]);
    const home = petInfo(id)?.care?.home;
    const feet = home ? this.homeFeet(home) : null;
    return feet ? { x: feet.x + rules.beside[0], y: feet.y + rules.beside[1] } : null;
  }

  /** เดินเล่นช้า ๆ รอบจุดของตัวเอง (ตัวที่รักษาอยู่นอนนิ่ง สั่นเบา ๆ) */
  update(deltaMs: number, time: number, paused: boolean): void {
    for (const sprite of this.sprites.values()) {
      const resting = sprite.stage === 'treating';
      if (!paused && !resting) this.wander(sprite, deltaMs, time);
      const shiver = resting ? (Math.floor(time / SHIVER_MS) % 2) : 0;
      const bob = resting ? 0 : Math.floor(time / rules.bobMs) % 2;
      sprite.image.setPosition(Math.round(sprite.feetX) + shiver, Math.round(sprite.feetY) - bob).setDepth(sprite.feetY);
    }
  }

  private wander(sprite: PetSprite, deltaMs: number, time: number): void {
    if (!sprite.target) {
      if (time < sprite.restUntil) return;
      const angle = this.rng.next() * Math.PI * 2;
      const distance = this.rng.next() * rules.wanderPx;
      sprite.target = { x: sprite.anchor.x + Math.cos(angle) * distance, y: sprite.anchor.y + Math.sin(angle) * distance * 0.5 };
      return;
    }
    const dx = sprite.target.x - sprite.feetX;
    const dy = sprite.target.y - sprite.feetY;
    const length = Math.hypot(dx, dy);
    const step = (rules.speedPx * deltaMs) / 1000;
    if (length <= step) {
      sprite.feetX = sprite.target.x;
      sprite.feetY = sprite.target.y;
      sprite.target = null;
      const [low, high] = rules.wanderMs;
      sprite.restUntil = time + low + this.rng.next() * (high - low);
      return;
    }
    sprite.feetX += (dx / length) * step;
    sprite.feetY += (dy / length) * step;
    // ภาพหันหน้าลงตัวเดียว เดินไปทางซ้ายกลับด้านภาพ
    if (Math.abs(dx) > 0.5) sprite.image.setFlipX(dx < 0);
  }

  /** สัตว์ที่ใกล้จุดนี้ที่สุดในระยะเอื้อม */
  nearest(x: number, y: number): PetSpot | null {
    let best: PetSpot | null = null;
    let bestDistance = rules.reachPx;
    for (const sprite of this.sprites.values()) {
      const distance = Math.hypot(sprite.feetX - x, sprite.feetY - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = this.spotOf(sprite);
      }
    }
    return best;
  }

  spot(id: string): PetSpot | null {
    const sprite = this.sprites.get(id);
    return sprite ? this.spotOf(sprite) : null;
  }

  private spotOf(sprite: PetSprite): PetSpot {
    const { image } = sprite;
    return { id: sprite.id, x: sprite.feetX, y: sprite.feetY, headY: sprite.feetY - image.displayHeight * image.originY + 4 };
  }

  /** แตะโดนตัวสัตว์ไหม */
  hit(id: string, worldX: number, worldY: number): boolean {
    return this.sprites.get(id)?.image.getBounds().contains(worldX, worldY) ?? false;
  }

  destroy(): void {
    for (const sprite of this.sprites.values()) sprite.image.destroy();
    this.sprites.clear();
  }
}
