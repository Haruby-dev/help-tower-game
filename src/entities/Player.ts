import Phaser from 'phaser';
import { animationKey, characterEntry, directionsOf, footY } from '../core/assets';
import { direction8From, velocityFrom, type Direction4, type Direction8, type Vector } from '../core/movement';
import balance from '../data/balance.json';

const WALK_ID = 'player_girl_walk';
const STAND_ID = 'player_girl_stand';
const BODY_WIDTH = 16;
const BODY_HEIGHT = 10;

export type GardenMove = 'till' | 'plant' | 'water' | 'harvest';

export class Player {
  readonly body: Phaser.GameObjects.Zone;
  readonly sprite: Phaser.GameObjects.Sprite;
  private facing: Direction8 = 'south';
  private acting = false;
  private cooking = false;
  private posing = false;
  /** ท่าเก่าที่ถูกยกเลิกไปแล้วจะไม่เรียกท่ารอต่อ */
  private poseToken = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.body = scene.add.zone(x, y, BODY_WIDTH, BODY_HEIGHT).setName('player_body');
    scene.physics.add.existing(this.body);
    this.physicsBody.setCollideWorldBounds(true);

    this.sprite = scene.add.sprite(x, y, STAND_ID).setName('player');
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
    const update = (_animation: unknown, frame: Phaser.Animations.AnimationFrame): void => onFrame(Number(frame.textureFrame));
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, update);
    this.sprite.once(`${Phaser.Animations.Events.ANIMATION_COMPLETE_KEY}${key}`, () => {
      this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, update);
      this.sprite.setFlipX(false);
      this.acting = false;
      onDone();
    });
    this.sprite.play(key);
  }

  /** ท่าตกปลาหรืออาบน้ำ เล่นท่าเริ่มครั้งเดียวแล้ววนท่ารอจนกว่าจะเรียก endPose · ทิศตะวันตกกลับด้านจากตะวันออก */
  startPose(facing: Direction4, base: string, onLoop?: () => void): void {
    this.cooking = false;
    this.posing = true;
    this.facing = facing;
    const sheet = facing === 'west' ? 'east' : facing;
    this.sprite.setFlipX(facing === 'west');
    this.sprite.setOrigin(0.5, footY(WALK_ID, sheet) / characterEntry(WALK_ID).frameHeight);
    this.sprite.anims.timeScale = 1;
    const intro = `${base}_${sheet}_intro`;
    const token = ++this.poseToken;
    this.sprite.play(intro);
    this.sprite.once(`${Phaser.Animations.Events.ANIMATION_COMPLETE_KEY}${intro}`, () => {
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

  /** หันหน้าเข้ากองไฟ ย่อตัวแล้ววนท่าทำอาหาร เดินออกเมื่อไหร่ก็ได้ */
  startCooking(toward: { x: number; y: number }): void {
    if (this.acting) return;
    const sheet = this.faceToward(toward);
    this.cooking = true;
    this.sprite.anims.timeScale = 1;
    this.sprite.play(`anim_cook_${sheet}_intro`);
    this.sprite.once(`${Phaser.Animations.Events.ANIMATION_COMPLETE_KEY}anim_cook_${sheet}_intro`, () => {
      if (this.cooking) this.sprite.play(`anim_cook_${sheet}_loop`);
    });
  }

  finishCooking(): void {
    if (!this.cooking) return;
    const key = this.sprite.anims.currentAnim?.key ?? '';
    this.cooking = false;
    if (!key.startsWith('anim_cook_')) return;
    const sheet = key.split('_')[2];
    this.acting = true;
    this.sprite.play(`anim_cook_${sheet}_outro`);
    this.sprite.once(`${Phaser.Animations.Events.ANIMATION_COMPLETE_KEY}anim_cook_${sheet}_outro`, () => {
      this.acting = false;
      this.sprite.setFlipX(false);
      this.showStanding();
    });
  }

  update(input: Vector, running = false): void {
    if (this.cooking && direction8From(input)) {
      this.cooking = false;
      this.sprite.setFlipX(false);
    }
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
