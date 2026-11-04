import Phaser from 'phaser';
import { footY, registry } from '../core/assets';
import { direction4From, type Direction4, type Vector } from '../core/movement';
import type { Rng } from '../core/rng';
import balance from '../data/balance.json';

const SIT_ID = 'gio_sit';
const BLINK_ID = 'gio_sit_blink';
const SIT_ROWS: Direction4[] = ['south', 'east', 'north', 'west'];
const BODY_WIDTH = 26;
const BODY_HEIGHT = 10;

/** ท่าเดินมี 3 ทิศ ทิศตะวันตกกลับด้านจากตะวันออก */
const walkSheet = (facing: Direction4): string => `gio_walk_${facing === 'west' ? 'east' : facing}`;

function sheetOf(id: string): { width: number; height: number; frames: number } {
  const entry = registry[id];
  if (entry?.type !== 'local' || !entry.frame_width || !entry.frame_height) throw new Error(`${id} is not a sprite sheet`);
  return { width: entry.frame_width, height: entry.frame_height, frames: Math.floor(entry.width / entry.frame_width) };
}

/** ท่านั่งวนตามทิศที่หัน ท่ากะพริบตาเล่นครั้งเดียวแล้วกลับมานั่ง */
function createAnimations(scene: Phaser.Scene): void {
  if (scene.anims.exists(`${SIT_ID}_south`)) return;
  const { sitFps, walkFps } = balance.gio;
  for (const [id, repeat] of [
    [SIT_ID, -1],
    [BLINK_ID, 0],
  ] as const) {
    const { frames } = sheetOf(id);
    SIT_ROWS.forEach((direction, row) => {
      scene.anims.create({
        key: `${id}_${direction}`,
        frames: scene.anims.generateFrameNumbers(id, { start: row * frames, end: row * frames + frames - 1 }),
        frameRate: sitFps,
        repeat,
      });
    });
  }
  for (const id of ['gio_walk_south', 'gio_walk_north', 'gio_walk_east']) {
    scene.anims.create({ key: id, frames: scene.anims.generateFrameNumbers(id), frameRate: walkFps, repeat: -1 });
  }
}

/** จีโอ v2 นั่งกะพริบตา แล้วลุกเดินสี่ขาไปรอบ ๆ ที่นั่งของตัวเอง ไม่เข้าใกล้ตัวเอกเกินไป */
export class Gio {
  readonly body: Phaser.GameObjects.Zone;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly homeX: number;
  private readonly homeY: number;
  private walking = false;
  private sitRemainingMs = 0;
  private walkRemainingMs = 0;
  private blinkInMs = 0;
  private facing: Direction4 = 'south';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly rng: Rng,
  ) {
    createAnimations(scene);
    this.homeX = x;
    this.homeY = y;
    this.body = scene.add.zone(x, y, BODY_WIDTH, BODY_HEIGHT).setName('gio_body');
    scene.physics.add.existing(this.body);
    this.physicsBody.setCollideWorldBounds(true);
    this.physicsBody.setImmovable(true);

    this.sprite = scene.add.sprite(x, y, SIT_ID).setName('gio');
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (!this.walking) this.playSit();
    });
    this.sit();
    this.syncSprite();
  }

  private get physicsBody(): Phaser.Physics.Arcade.Body {
    return this.body.body as Phaser.Physics.Arcade.Body;
  }

  get isWalking(): boolean {
    return this.walking;
  }

  update(deltaMs: number, playerX: number, playerY: number): void {
    if (this.walking) {
      this.walkRemainingMs -= deltaMs;
      if (this.walkRemainingMs <= 0 || this.tooClose(playerX, playerY, 0)) this.sit();
    } else {
      this.sitRemainingMs -= deltaMs;
      this.blinkInMs -= deltaMs;
      if (this.blinkInMs <= 0) this.blink();
      if (this.sitRemainingMs <= 0) this.tryWalk(playerX, playerY);
    }
    this.syncSprite();
  }

  private sit(): void {
    this.walking = false;
    this.physicsBody.setVelocity(0, 0);
    this.sitRemainingMs = this.rng.between(balance.gio.sitMinMs, balance.gio.sitMaxMs);
    this.blinkInMs = this.nextBlinkMs();
    this.sprite.setFlipX(false);
    this.playSit();
  }

  private playSit(): void {
    this.sprite.setOrigin(0.5, footY(SIT_ID, this.facing) / sheetOf(SIT_ID).height);
    this.sprite.play(`${SIT_ID}_${this.facing}`, true);
  }

  private blink(): void {
    this.blinkInMs = this.nextBlinkMs();
    this.sprite.setOrigin(0.5, footY(BLINK_ID, this.facing) / sheetOf(BLINK_ID).height);
    this.sprite.play(`${BLINK_ID}_${this.facing}`);
  }

  private nextBlinkMs(): number {
    return this.rng.between(balance.gio.blinkEveryMinMs, balance.gio.blinkEveryMaxMs);
  }

  private tooClose(playerX: number, playerY: number, ahead: number): boolean {
    const velocity = this.physicsBody.velocity;
    const speed = Math.hypot(velocity.x, velocity.y) || 1;
    const aheadX = this.body.x + (velocity.x / speed) * ahead;
    const aheadY = this.body.y + (velocity.y / speed) * ahead;
    return Math.hypot(aheadX - playerX, aheadY - playerY) < balance.gio.keepAwayDistance;
  }

  private tryWalk(playerX: number, playerY: number): void {
    const { walkSpeed, walkMinMs, walkMaxMs, keepAwayDistance, sitMinMs } = balance.gio;
    const heading = this.pickHeading();
    const walkMs = this.rng.between(walkMinMs, walkMaxMs);
    const length = (walkSpeed * walkMs) / 1000;
    const landingX = this.body.x + heading.x * length;
    const landingY = this.body.y + heading.y * length;
    const near =
      Math.hypot(landingX - playerX, landingY - playerY) < keepAwayDistance ||
      Math.hypot(this.body.x - playerX, this.body.y - playerY) < keepAwayDistance;
    if (near) {
      this.sitRemainingMs = sitMinMs;
      return;
    }

    this.facing = direction4From(heading);
    this.walking = true;
    this.walkRemainingMs = walkMs;
    this.physicsBody.setVelocity(heading.x * walkSpeed, heading.y * walkSpeed);
    const sheet = walkSheet(this.facing);
    this.sprite.setFlipX(this.facing === 'west');
    this.sprite.setOrigin(0.5, footY(sheet) / sheetOf(sheet).height);
    this.sprite.play(sheet);
  }

  /** สุ่มทิศในรัศมีเล่น ถ้าออกไกลเกินให้หันกลับเข้าหาบ้าน */
  private pickHeading(): Vector {
    const offsetX = this.homeX - this.body.x;
    const offsetY = this.homeY - this.body.y;
    const distanceFromHome = Math.hypot(offsetX, offsetY);
    if (distanceFromHome > balance.gio.wanderRadius) {
      return { x: offsetX / distanceFromHome, y: offsetY / distanceFromHome };
    }
    const angle = this.rng.between(0, Math.PI * 2);
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  private syncSprite(): void {
    const feetY = this.body.y + BODY_HEIGHT / 2;
    this.sprite.setPosition(this.body.x, feetY);
    this.sprite.setDepth(feetY);
  }
}
