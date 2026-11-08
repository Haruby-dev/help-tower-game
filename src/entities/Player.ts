import Phaser from 'phaser';
import { animationKey, characterEntry, directionsOf, footY } from '../core/assets';
import { direction8From, velocityFrom, type Direction4, type Direction8, type Vector } from '../core/movement';
import balance from '../data/balance.json';

const WALK_ID = 'player_girl_walk';
const STAND_ID = 'player_girl_stand';
const BODY_WIDTH = 16;
const BODY_HEIGHT = 10;

/** ท่าทำอาหารเดิม (ผัด) ใช้เมื่อไม่รู้วิธี */
const DEFAULT_COOK_POSE = 'stir_fry' as const;

export type GardenMove = 'till' | 'plant' | 'water' | 'harvest';

export class Player {
  readonly body: Phaser.GameObjects.Zone;
  readonly sprite: Phaser.GameObjects.Sprite;
  private facing: Direction8 = 'south';
  private acting = false;
  private cooking = false;
  /** แผ่นท่าทำอาหารที่เล่นอยู่ */
  private cookSheet: string | null = null;
  private posing = false;
  /** ท่าเก่าที่ถูกยกเลิกไปแล้วจะไม่เรียกท่ารอต่อ */
  private poseToken = 0;
  /** ตัวฟังของท่าเล่นครั้งเดียว (กิน เป็นลม) เล่นใหม่ก่อนจบต้องถอดของเก่าออก */
  private onceListeners: { update: (...args: never[]) => void; complete: () => void; key: string } | null = null;
  /** เรียกทุกครั้งที่ท่าเดินเปลี่ยนเฟรม ส่งเลขเฟรมในท่า (0–7) ใช้เล่นเสียงเท้า */
  onWalkFrame: ((index: number) => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.body = scene.add.zone(x, y, BODY_WIDTH, BODY_HEIGHT).setName('player_body');
    scene.physics.add.existing(this.body);
    this.physicsBody.setCollideWorldBounds(true);

    this.sprite = scene.add.sprite(x, y, STAND_ID).setName('player');
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (animation.key.startsWith(`${WALK_ID}_`)) this.onWalkFrame?.(animation.frames.indexOf(frame));
    });
    this.showStanding();
    this.syncSprite();
  }

  get feetX(): number {
    return this.body.x;
  }

  get feetY(): number {
    return this.body.y + BODY_HEIGHT / 2;
  }

  moveTo(point: { x: number; y: number }): void {
    this.physicsBody.reset(point.x, point.y);
    this.syncSprite();
  }

  private get physicsBody(): Phaser.Physics.Arcade.Body {
    return this.body.body as Phaser.Physics.Arcade.Body;
  }

  get busy(): boolean {
    return this.acting || this.posing;
  }

  /** ท่าทำสวนมี 3 ทิศ ทิศตะวันตกกลับด้านจากตะวันออก ระหว่างทำจะเดินไม่ได้ */
  playGardenMove(move: GardenMove, toward: { x: number; y: number }, onFrame: (frame: number) => void, onDone: () => void): void {
    this.cooking = false;
    const sheet = this.faceToward(toward);
    const key = `anim_${move}_${sheet}`;
    this.acting = true;
    this.sprite.anims.timeScale = 1;
    this.clearOnce();
    const update = (_animation: unknown, frame: Phaser.Animations.AnimationFrame): void => onFrame(Number(frame.textureFrame));
    const complete = (): void => {
      this.clearOnce();
      this.sprite.setFlipX(false);
      this.acting = false;
      onDone();
    };
    // เก็บตัวฟังไว้ที่เดียวกับท่าเล่นครั้งเดียว ถ้าเป็นลมกลางท่า ท่านี้ถูกยกเลิกและไม่เรียก onDone ทีหลัง
    this.onceListeners = { update, complete, key };
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, update);
    this.sprite.once(`${Phaser.Animations.Events.ANIMATION_COMPLETE_KEY}${key}`, complete);
    this.sprite.play(key);
  }

  /**
   * ท่าเล่นครั้งเดียวหันหน้าลง (กิน เป็นลม) ทุกทิศหันลงเหมือนท่าอาบน้ำ เดินไม่ได้ระหว่างเล่น
   * เล่นซ้ำก่อนจบได้ ท่าเริ่มใหม่และไม่เรียก onDone ของรอบก่อน · hold = ค้างเฟรมสุดท้ายไว้จนเรียก endOnce
   */
  playOnce(key: string, onFrame: (frame: number) => void, onDone: () => void, hold = false): void {
    this.clearOnce();
    this.cooking = false;
    this.posing = false;
    this.poseToken += 1;
    this.acting = true;
    this.facing = 'south';
    this.sprite.setFlipX(false);
    this.sprite.setOrigin(0.5, footY(WALK_ID, 'south') / characterEntry(WALK_ID).frameHeight);
    this.sprite.anims.timeScale = 1;
    const update = (animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void => {
      if (animation.key === key) onFrame(Number(frame.textureFrame));
    };
    const complete = (): void => {
      this.clearOnce();
      if (!hold) {
        this.acting = false;
        this.showStanding();
      }
      onDone();
    };
    this.onceListeners = { update, complete, key };
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, update);
    this.sprite.once(`${Phaser.Animations.Events.ANIMATION_COMPLETE_KEY}${key}`, complete);
    this.sprite.play(key);
    onFrame(0);
  }

  /** ลุกจากท่าที่ค้างไว้ (เป็นลมแล้วตื่นที่บ้าน) */
  endOnce(): void {
    this.clearOnce();
    if (!this.acting) return;
    this.acting = false;
    this.showStanding();
  }

  private clearOnce(): void {
    if (!this.onceListeners) return;
    const { update, complete, key } = this.onceListeners;
    this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, update);
    this.sprite.off(`${Phaser.Animations.Events.ANIMATION_COMPLETE_KEY}${key}`, complete);
    this.onceListeners = null;
  }

  /** ท่าตกปลาหรืออาบน้ำ เล่นท่าเริ่มครั้งเดียวแล้ววนท่ารอจนกว่าจะเรียก endPose · ทิศตะวันตกกลับด้านจากตะวันออก */
  startPose(facing: Direction4, base: string, onLoop?: () => void, onFrame?: (frame: number, sheet: string) => void): void {
    this.cooking = false;
    this.posing = true;
    this.facing = facing;
    const sheet = facing === 'west' ? 'east' : facing;
    this.sprite.setFlipX(facing === 'west');
    this.sprite.setOrigin(0.5, footY(WALK_ID, sheet) / characterEntry(WALK_ID).frameHeight);
    this.sprite.anims.timeScale = 1;
    const intro = `${base}_${sheet}_intro`;
    const token = ++this.poseToken;
    const update = (animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void => {
      if (animation.key === intro && token === this.poseToken) onFrame?.(Number(frame.textureFrame), sheet);
    };
    if (onFrame) this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, update);
    this.sprite.play(intro);
    this.sprite.once(`${Phaser.Animations.Events.ANIMATION_COMPLETE_KEY}${intro}`, () => {
      this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, update);
      if (!this.posing || token !== this.poseToken) return;
      this.sprite.play(`${base}_${sheet}_loop`);
      onLoop?.();
    });
  }

  endPose(): void {
    if (!this.posing) return;
    this.posing = false;
    this.poseToken += 1;
    this.sprite.setFlipX(false);
    this.showStanding();
  }

  get isPosing(): boolean {
    return this.posing;
  }

  /** เลขเฟรมในแผ่นภาพที่กำลังแสดง ใช้หาปลายคันเบ็ด */
  get poseFrame(): number {
    return Number(this.sprite.anims.currentFrame?.textureFrame ?? 0);
  }

  get flipped(): boolean {
    return this.sprite.flipX;
  }

  /** มุมซ้ายบนของเฟรมบนโลก ใช้แปลงจุดในภาพเป็นตำแหน่งจริง */
  get frameCorner(): { x: number; y: number } {
    return { x: this.feetX - this.sprite.width * this.sprite.originX, y: this.feetY - this.sprite.height * this.sprite.originY };
  }

  /** ทิศที่หันอยู่แบบ 4 ทิศ ทิศเฉียงปัดไปทางซ้ายขวา */
  get facing4(): Direction4 {
    if (this.facing.includes('east')) return 'east';
    if (this.facing.includes('west')) return 'west';
    return this.facing === 'north' ? 'north' : 'south';
  }

  get isCooking(): boolean {
    return this.cooking;
  }

  private faceToward(toward: { x: number; y: number }): string {
    const dx = toward.x - this.feetX;
    const dy = toward.y - this.feetY;
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north';
    const sheet = this.facing === 'west' ? 'east' : this.facing;
    this.sprite.setFlipX(this.facing === 'west');
    this.sprite.setOrigin(0.5, footY(WALK_ID, sheet) / characterEntry(WALK_ID).frameHeight);
    return sheet;
  }

  /** หันหน้าเข้ากองไฟ เล่นท่าทำอาหารของวิธีนั้น (เปิดตัวครั้งเดียวแล้ววน) ทิศตะวันตกกลับด้านจากตะวันออก */
  startCooking(toward: { x: number; y: number }, pose: string, hooks: { onStart?: () => void; onLoop?: () => void } = {}): void {
    if (this.acting) return;
    const facing = this.faceToward(toward) as 'south' | 'east' | 'north';
    const poses = balance.cooking.poses as Record<string, (typeof balance.cooking.poses)[typeof DEFAULT_COOK_POSE]>;
    const sheets = poses[pose] ?? poses[DEFAULT_COOK_POSE]!;
    const sheet = sheets[facing].sheet;
    this.cooking = true;
    this.cookSheet = sheet;
    this.sprite.anims.timeScale = 1;
    this.sprite.play(`${sheet}_intro`);
    hooks.onStart?.();
    this.sprite.once(`${Phaser.Animations.Events.ANIMATION_COMPLETE_KEY}${sheet}_intro`, () => {
      if (!this.cooking || this.cookSheet !== sheet) return;
      this.sprite.play(`${sheet}_loop`);
      hooks.onLoop?.();
    });
  }

  /** ลุกขึ้นจากท่าทำอาหาร (เล่นเปิดตัวย้อนกลับ) */
  finishCooking(): void {
    if (!this.cooking) return;
    const sheet = this.cookSheet;
    this.cooking = false;
    this.cookSheet = null;
    const key = this.sprite.anims.currentAnim?.key ?? '';
    if (!sheet || !key.startsWith(sheet)) return;
    this.acting = true;
    this.sprite.play(`${sheet}_outro`);
    this.sprite.once(`${Phaser.Animations.Events.ANIMATION_COMPLETE_KEY}${sheet}_outro`, () => {
      this.acting = false;
      this.sprite.setFlipX(false);
      this.showStanding();
    });
  }

  /** ระหว่างทำอาหารเดินไม่ได้ กดปุ่มกระทำอีกครั้งเพื่อลุก อาหารยังสุกต่อที่กองไฟ */
  update(input: Vector, running = false): void {
    if (this.cooking) {
      this.physicsBody.setVelocity(0, 0);
      this.syncSprite();
      return;
    }
    if (this.acting || this.posing) {
      this.physicsBody.setVelocity(0, 0);
      this.syncSprite();
      return;
    }
    const speed = balance.player.speed * (running ? balance.player.runSpeedMultiplier : 1);
    const velocity = velocityFrom(input, speed);
    this.physicsBody.setVelocity(velocity.x, velocity.y);

    const direction = direction8From(input);
    if (direction) {
      this.facing = direction;
      this.showWalking();
      this.sprite.anims.timeScale = running ? balance.player.runAnimationMultiplier : 1;
    } else {
      this.showStanding();
    }
    this.syncSprite();
  }

  private showWalking(): void {
    const key = animationKey(WALK_ID, this.facing);
    this.sprite.setOrigin(0.5, footY(WALK_ID, this.facing) / characterEntry(WALK_ID).frameHeight);
    this.sprite.play(key, true);
  }

  private showStanding(): void {
    const entry = characterEntry(STAND_ID);
    this.sprite.stop();
    this.sprite.setTexture(STAND_ID, directionsOf(entry).indexOf(this.facing));
    this.sprite.setOrigin(0.5, footY(STAND_ID, this.facing) / entry.frameHeight);
  }

  private syncSprite(): void {
    this.sprite.setPosition(this.feetX, this.feetY);
    this.sprite.setDepth(this.feetY);
  }
}
