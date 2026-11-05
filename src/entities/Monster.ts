import Phaser from 'phaser';
import { footY } from '../core/assets';
import { direction4From } from '../core/movement';
import type { Rng } from '../core/rng';
import balance from '../data/balance.json';
import { eyeLevel, miniPlateKey, moteKey, prepareMonsterArt, sheetKey, DIRECTIONS, type Facing, type MonsterArt, type SheetKind } from '../scenes/monsterArt';

type Point = { x: number; y: number };

const ARRIVE_PX = 1.5;
const FX_DEPTH_LIFT = 100;
/** หอคอยอาหารเหนือหัว: จานแล้วอาหารสลับกัน แต่ละชั้นสูงตามภาพอาหารจริง ขอบจานกับอาหารซ้อนกัน 1 พิกเซล */
const PLATE_HEIGHT_PX = 4;
const LAYER_OVERLAP_PX = 1;
const TOWER_GAP_PX = 2;
/** ฟองความคิด: มุมซ้ายของฟองห่างกลางตัวเท่านี้ จุดลากซ้ายล่างอยู่เหนือหัว ไอคอนอาหารกลางที่ (13, 13) ของฟอง */
const THOUGHT_LEFT_PX = -3;
const THOUGHT_GAP_PX = 2;
const THOUGHT_ICON = { x: 13, y: 13 };
const THOUGHT_BOB_MS = 600;
/** เส้นเลือดงอนอยู่เหนือหัวค่อนขวา ลอยขึ้นแล้วจางเหมือนหัวใจ */
const SULK_RIGHT_PX = 7;
const SULK_RISE_PX = 6;
const SULK_MS = 500;
const TOWER_WOBBLE_MS = 170;
const TOWER_WOBBLE_MAX = 2;
const HEART_RISE_PX = 18;
const HEART_RISE_MS = 600;
const HEART_STAGGER_MS = 200;
const SPARKLE_BLINK_MS = 120;
const SPARKLE_LIFE_MS = 1400;
const SHAKE_STEPS = [1, -1, 1, -1, 0];
const SHAKE_STEP_MS = 70;
const MOTE_RISE_PX = 10;
const MOTE_LIFE_MS = 900;
const MOTE_SPREAD_PX = 11;
const BIG_MOTE_SHARE = 0.35;
/** ประกายรอบตัวตอนได้เมนูโปรด เมนูประจำใจ หรือครบ 100% */
const SPARKLE_SPOTS: [number, number][] = [
  [-13, -30],
  [12, -26],
  [-15, -12],
  [14, -8],
  [0, -38],
];

/**
 * มอนสเตอร์หนึ่งตัวบนแผนที่ (ภาพ 1:1 ไม่ย่อขยาย) เดินตามจุด ยืน กิน และถือหอคอยอาหารเหนือหัว
 * ระดับความชอบเปลี่ยนภาพ: ตาแดงค่อย ๆ เป็นตาหวาน ละอองหิวสีม่วงลดลง ครบ 100% เปลี่ยนเป็นภาพหวาน
 */
export class Monster {
  readonly sprite: Phaser.GameObjects.Sprite;
  /** วิ่งกลับโพรงใช้ท่าเดินเร่งความเร็ว (ฉากตั้งค่า) */
  speedMultiplier = 1;
  private route: Point[] = [];
  private facing: Facing = 'south';
  private kind: SheetKind = 'stand';
  private level: number | 'sweet';
  private percent: number;
  private eatingNow = false;
  private tower: { plate: Phaser.GameObjects.Image; food: Phaser.GameObjects.Image }[] = [];
  private fx: Phaser.GameObjects.GameObject[] = [];
  private shake: { step: number; ms: number } | null = null;
  /** ฟองความคิด "อยากกิน" (ฟองกับไอคอนอาหาร) ตามหัวไปจนหมดเวลา */
  private thought: { bubble: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; until: number } | null = null;
  /** ความสูงหอคอยตอนนี้ (พิกเซล) ใช้วางฟองเหนือหอคอย */
  private towerHeight = 0;
  private moteMs = 0;
  private position: Point;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly id: string,
    readonly art: MonsterArt,
    at: Point,
    percent: number,
    cleared: boolean,
    private readonly rng: Rng,
  ) {
    prepareMonsterArt(scene, art);
    this.position = { ...at };
    this.percent = percent;
    this.level = eyeLevel(percent, cleared);
    this.sprite = scene.add.sprite(at.x, at.y, sheetKey(art, this.level, 'stand'), 0).setName(`monster_${id}`);
    this.placeFeet('stand');
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (animation: Phaser.Animations.Animation) => {
      if (animation.key.endsWith('_once')) {
        this.eatingNow = false;
        this.showStand();
      }
    });
    this.showStand();
    this.sync(0);
  }

  get feetX(): number {
    return this.position.x;
  }

  get feetY(): number {
    return this.position.y;
  }

  /** เหนือหัวพอดี ใช้วางฟองคำพูด (เหนือหอคอยถ้าถืออยู่) */
  get headY(): number {
    return this.position.y - this.art.height - (this.tower.length > 0 ? TOWER_GAP_PX + this.towerHeight : 0);
  }

  get arrived(): boolean {
    return this.route.length === 0;
  }

  get eating(): boolean {
    return this.eatingNow;
  }

  get towerSize(): number {
    return this.tower.length;
  }

  walkTo(points: Point[]): void {
    this.route = points.map((point) => ({ ...point }));
    if (this.route.length === 0) return;
    this.kind = 'walk';
    this.headToward(this.route[0]!);
  }

  stand(facing?: Facing): void {
    this.route = [];
    if (facing) this.facing = facing;
    this.showStand();
  }

  /** เล่นท่ากินทิศใต้หนึ่งรอบ */
  eat(): void {
    this.route = [];
    this.facing = 'south';
    this.kind = 'eat';
    this.eatingNow = true;
    this.sprite.setFlipX(false);
    this.placeFeet('eat');
    this.sprite.play(`${sheetKey(this.art, this.level, 'eat')}_once`);
  }

  /** เปลี่ยนภาพตามความชอบ ท่าที่เล่นอยู่เล่นต่อจากเฟรมเดิม */
  setAffection(percent: number, cleared: boolean): void {
    this.percent = percent;
    const level = eyeLevel(percent, cleared);
    if (level === this.level) return;
    this.level = level;
    if (this.kind === 'walk') this.playWalk(true);
    else if (this.kind === 'eat') {
      const progress = this.sprite.anims.getProgress();
      this.sprite.play(`${sheetKey(this.art, this.level, 'eat')}_once`);
      this.sprite.anims.setProgress(progress);
    } else this.showStand();
  }

  /** วางอาหารบนหอคอยเหนือหัว ชั้นละ 1 ที่ */
  addToTower(foodKey: string, count: number): void {
    for (let serving = 0; serving < count; serving += 1) {
      const plate = this.scene.add.image(0, 0, miniPlateKey(this.scene)).setOrigin(0.5, 1);
      const food = this.scene.add.image(0, 0, foodKey).setOrigin(0.5, 1);
      this.tower.push({ plate, food });
    }
    this.sync(this.scene.time.now);
  }

  removeFromTower(): void {
    const top = this.tower.pop();
    top?.plate.destroy();
    top?.food.destroy();
  }

  /** หัวใจลอยขึ้นจากเหนือหัว */
  hearts(count: number): void {
    const headY = this.position.y - this.art.height;
    for (let index = 0; index < count; index += 1) {
      const offsetX = count > 1 ? (index - (count - 1) / 2) * 6 : 0;
      const heart = this.scene.add.image(Math.round(this.position.x + offsetX), Math.round(headY), 'fx_heart_5').setDepth(this.position.y + FX_DEPTH_LIFT).setVisible(false);
      this.fx.push(heart);
      this.scene.time.delayedCall(index * HEART_STAGGER_MS, () => {
        if (!heart.active) return;
        heart.setVisible(true);
        const startX = heart.x;
        this.scene.tweens.add({
          targets: heart,
          y: headY - HEART_RISE_PX,
          duration: HEART_RISE_MS,
          onUpdate: (tween) => heart.setX(startX + (Math.round(tween.progress * 4) % 2 === 0 ? 0 : 1)),
          onComplete: () => heart.destroy(),
        });
      });
    }
  }

  /** ประกายกะพริบรอบตัวครู่หนึ่ง */
  sparkles(): void {
    for (const [dx, dy] of SPARKLE_SPOTS) {
      const sparkle = this.scene.add
        .image(Math.round(this.position.x + dx), Math.round(this.position.y + dy), 'fx_sparkle_5')
        .setDepth(this.position.y + FX_DEPTH_LIFT);
      this.fx.push(sparkle);
      const timer = this.scene.time.addEvent({ delay: SPARKLE_BLINK_MS, loop: true, callback: () => sparkle.setVisible(!sparkle.visible) });
      this.scene.time.delayedCall(SPARKLE_LIFE_MS, () => {
        timer.remove();
        sparkle.destroy();
      });
    }
  }

  /** หน้างอน: ส่ายตัวซ้ายขวา 1 พิกเซล และเส้นเลือดสีชมพูลอยขึ้นเหนือหัวแล้วจาง */
  pout(): void {
    this.shake = { step: 0, ms: 0 };
    const headTop = Math.round(this.position.y - this.art.height);
    const sulk = this.scene.add.image(Math.round(this.position.x + SULK_RIGHT_PX), headTop, 'fx_sulk_7').setDepth(this.position.y + FX_DEPTH_LIFT);
    this.fx.push(sulk);
    this.scene.tweens.add({
      targets: sulk,
      y: headTop - SULK_RISE_PX,
      alpha: 0,
      duration: SULK_MS,
      ease: 'Quad.easeIn',
      onUpdate: () => sulk.setY(Math.round(sulk.y)),
      onComplete: () => sulk.destroy(),
    });
  }

  /** ฟองความคิดมีไอคอนอาหารที่อยากกิน (ไม่มีตัวหนังสือ) ค้างไว้ ms มิลลิวินาที */
  think(icon: string, ms: number): void {
    this.thought?.bubble.destroy();
    this.thought?.icon.destroy();
    const bubble = this.scene.add.image(0, 0, 'ui_thought_bubble').setOrigin(0, 1);
    const picture = this.scene.add.image(0, 0, icon);
    this.thought = { bubble, icon: picture, until: this.scene.time.now + ms };
    this.sync(this.scene.time.now);
  }

  /** paused คือนาฬิกาหยุด (เปิดหน้าต่าง) หยุดเดินแต่ท่าที่เล่นอยู่ยังเล่นต่อ */
  update(deltaMs: number, paused: boolean, time: number): void {
    if (!paused) {
      this.step(deltaMs);
      this.updateMotes(deltaMs);
    }
    if (this.shake) {
      this.shake.ms += deltaMs;
      if (this.shake.ms >= SHAKE_STEP_MS) {
        this.shake.ms = 0;
        this.shake.step += 1;
        if (this.shake.step >= SHAKE_STEPS.length) this.shake = null;
      }
    }
    this.sync(time);
  }

  destroy(): void {
    this.thought?.bubble.destroy();
    this.thought?.icon.destroy();
    this.thought = null;
    for (const piece of this.fx) {
      this.scene.tweens.killTweensOf(piece);
      piece.destroy();
    }
    for (const layer of this.tower) {
      layer.plate.destroy();
      layer.food.destroy();
    }
    this.fx = [];
    this.tower = [];
    this.sprite.destroy();
  }

  private step(deltaMs: number): void {
    const point = this.route[0];
    if (!point) return;
    const speed = balance.monsters.walkSpeed * this.speedMultiplier;
    const remaining = Math.hypot(point.x - this.position.x, point.y - this.position.y);
    const move = (speed * deltaMs) / 1000;
    if (remaining <= ARRIVE_PX || remaining <= move) {
      this.position = { ...point };
      this.route.shift();
      if (this.route.length > 0) this.headToward(this.route[0]!);
      else this.showStand();
      return;
    }
    this.position = {
      x: this.position.x + ((point.x - this.position.x) / remaining) * move,
      y: this.position.y + ((point.y - this.position.y) / remaining) * move,
    };
  }

  private headToward(point: Point): void {
    const dx = point.x - this.position.x;
    const dy = point.y - this.position.y;
    const length = Math.hypot(dx, dy);
    if (length < ARRIVE_PX) return;
    const facing = direction4From({ x: dx / length, y: dy / length });
    const changed = facing !== this.facing || this.kind !== 'walk' || !this.sprite.anims.isPlaying;
    this.facing = facing;
    this.kind = 'walk';
    if (changed) this.playWalk(false);
  }

  private playWalk(keepFrame: boolean): void {
    const key = `${sheetKey(this.art, this.level, 'walk')}_${this.facing}`;
    const progress = keepFrame ? this.sprite.anims.getProgress() : 0;
    this.sprite.setFlipX(false);
    this.placeFeet('walk');
    this.sprite.play(key, true);
    if (keepFrame) this.sprite.anims.setProgress(progress);
  }

  /**
   * วางภาพด้วยจุดเท้าของแผ่นนั้น ท่ายืนกับท่าเดินใช้เส้นเท้าของท่ายืน (ท่ากระโดดตั้งใจให้ตัวลอย) ท่ากินใช้เส้นเท้าของแผ่นกิน
   * ภาพช่วงกลางที่สร้างตอนเล่นใช้จุดเท้าของภาพหิวต้นฉบับ
   */
  private placeFeet(kind: SheetKind): void {
    const sheet = sheetKey(this.art, 0, kind === 'eat' ? 'eat' : 'stand');
    this.sprite.setOrigin(0.5, footY(sheet) / this.art.frame);
  }

  private showStand(): void {
    this.kind = 'stand';
    this.eatingNow = false;
    this.sprite.stop();
    this.sprite.setFlipX(false);
    this.placeFeet('stand');
    this.sprite.setTexture(sheetKey(this.art, this.level, 'stand'), DIRECTIONS.indexOf(this.facing));
  }

  /** ละอองหิวลอยขึ้นรอบตัว ยิ่งหิวยิ่งถี่ ครบ 100% ไม่มีเลย */
  private updateMotes(deltaMs: number): void {
    if (this.level === 'sweet') return;
    const rate = balance.monsters.motesPerSecond * (1 - this.percent / 100);
    if (rate <= 0) return;
    this.moteMs += deltaMs;
    const every = 1000 / rate;
    while (this.moteMs >= every) {
      this.moteMs -= every;
      const x = Math.round(this.position.x + this.rng.between(-MOTE_SPREAD_PX, MOTE_SPREAD_PX));
      const y = Math.round(this.position.y - this.rng.between(4, this.art.height - 4));
      const mote = this.scene.add.image(x, y, moteKey(this.scene, this.rng.next() < BIG_MOTE_SHARE)).setDepth(this.position.y + 1).setAlpha(0.85);
      this.fx.push(mote);
      this.scene.tweens.add({
        targets: mote,
        y: y - MOTE_RISE_PX,
        alpha: 0,
        duration: MOTE_LIFE_MS,
        onUpdate: () => mote.setY(Math.round(mote.y)),
        onComplete: () => {
          this.fx = this.fx.filter((piece) => piece !== mote);
          mote.destroy();
        },
      });
    }
  }

  private sync(time: number): void {
    const x = Math.round(this.position.x) + (this.shake ? SHAKE_STEPS[this.shake.step]! : 0);
    const y = Math.round(this.position.y);
    this.sprite.setPosition(x, y).setDepth(y);
    const base = y - this.art.height - TOWER_GAP_PX;
    let plateY = base;
    this.tower.forEach((layer, index) => {
      const wobble = Math.max(-TOWER_WOBBLE_MAX, Math.min(TOWER_WOBBLE_MAX, Math.round(Math.sin(time / TOWER_WOBBLE_MS + index * 0.9) * index * 0.5)));
      const foodY = plateY - PLATE_HEIGHT_PX + LAYER_OVERLAP_PX;
      layer.plate.setPosition(x + wobble, plateY).setDepth(y + 1 + index * 0.01);
      layer.food.setPosition(x + wobble, foodY).setDepth(y + 1.005 + index * 0.01);
      plateY = foodY - layer.food.height + LAYER_OVERLAP_PX;
    });
    this.towerHeight = base - plateY;
    this.syncThought(x, time);
  }

  /** ฟองอยู่เหนือหัว (หรือเหนือหอคอย) เยื้องขวา ลอยขึ้นลง 1 พิกเซล หมดเวลาแล้วหายไป */
  private syncThought(x: number, time: number): void {
    const thought = this.thought;
    if (!thought) return;
    if (time > thought.until) {
      thought.bubble.destroy();
      thought.icon.destroy();
      this.thought = null;
      return;
    }
    const bob = Math.floor(time / THOUGHT_BOB_MS) % 2;
    const left = x + THOUGHT_LEFT_PX;
    const bottom = Math.round(this.headY) - THOUGHT_GAP_PX - bob;
    const depth = this.position.y + FX_DEPTH_LIFT;
    thought.bubble.setPosition(left, bottom).setDepth(depth);
    const top = bottom - thought.bubble.height;
    // ไอคอนกลางที่ (13, 13) ปัดเป็นจำนวนเต็มให้พิกเซลตรง
    thought.icon.setPosition(left + THOUGHT_ICON.x - Math.floor(thought.icon.width / 2), top + THOUGHT_ICON.y - Math.floor(thought.icon.height / 2)).setOrigin(0).setDepth(depth + 0.01);
  }
}
