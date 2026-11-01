import Phaser from 'phaser';
import { animationKey, characterEntry, directionsOf, footY } from '../core/assets';
import { direction4From, type Direction4, type Vector } from '../core/movement';
import type { Rng } from '../core/rng';
import balance from '../data/balance.json';

const IDLE_ID = 'gio_idle';
const STAND_ID = 'gio_stand';
const BODY_WIDTH = 26;
const BODY_HEIGHT = 10;
/** คอลัมน์ในแผ่น gio_stand ดู buildHopSheet */
const FRAME_NORMAL = 0;
const FRAME_STRETCH = 1;
const FRAME_SQUASH = 2;
const FRAMES_PER_ROW = 3;

/** ความสูงและเฟรมของการกระโดดหนึ่งครั้ง phase นับจาก 0 ถึง 1 */
export function hopPose(phase: number): { lift: number; frame: number } {
  const { hopArcPx, hopTakeOffShare, hopLandingShare } = balance.gio;
  const lift = Math.round(4 * hopArcPx * phase * (1 - phase));
  if (phase < hopTakeOffShare) return { lift, frame: FRAME_STRETCH };
  if (phase > 1 - hopLandingShare) return { lift, frame: FRAME_SQUASH };
  return { lift, frame: FRAME_NORMAL };
}

export class Gio {
  readonly body: Phaser.GameObjects.Zone;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly homeX: number;
  private readonly homeY: number;
  private hopping = false;
  private sitRemainingMs = 0;
  private hopElapsedMs = 0;
  private facing: Direction4 = 'south';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly rng: Rng,
  ) {
    this.homeX = x;
    this.homeY = y;
    this.body = scene.add.zone(x, y, BODY_WIDTH, BODY_HEIGHT).setName('gio_body');
    scene.physics.add.existing(this.body);
    this.physicsBody.setCollideWorldBounds(true);
    this.physicsBody.setImmovable(true);

    this.sprite = scene.add.sprite(x, y, IDLE_ID).setName('gio');
    this.sit();
    this.syncSprite(0);
  }

  private get physicsBody(): Phaser.Physics.Arcade.Body {
    return this.body.body as Phaser.Physics.Arcade.Body;
  }

  update(deltaMs: number, playerX: number, playerY: number): void {
    if (this.hopping) {
      this.updateHop(deltaMs);
      return;
    }
    this.sitRemainingMs -= deltaMs;
    if (this.sitRemainingMs <= 0) this.tryHop(playerX, playerY);
    this.syncSprite(0);
  }

  private updateHop(deltaMs: number): void {
    this.hopElapsedMs += deltaMs;
    const hopMs = 1000 / balance.gio.hopsPerSecond;
    if (this.hopElapsedMs >= hopMs * balance.gio.hopsPerTrip) {
      this.sit();
      this.syncSprite(0);
      return;
    }
    const { lift, frame } = hopPose((this.hopElapsedMs % hopMs) / hopMs);
    const row = directionsOf(characterEntry(STAND_ID)).indexOf(this.facing);
    this.sprite.setFrame(row * FRAMES_PER_ROW + frame);
    this.syncSprite(lift);
  }

  private sit(): void {
    this.hopping = false;
    this.physicsBody.setVelocity(0, 0);
    this.sitRemainingMs = this.rng.between(balance.gio.sitMinMs, balance.gio.sitMaxMs);
    this.sprite.setOrigin(0.5, footY(IDLE_ID, 'south') / characterEntry(IDLE_ID).frameHeight);
    this.sprite.play(animationKey(IDLE_ID, 'south'));
  }

  private tryHop(playerX: number, playerY: number): void {
    const heading = this.pickHeading();
    const tripMs = (balance.gio.hopsPerTrip / balance.gio.hopsPerSecond) * 1000;
    const hopLength = (balance.gio.hopSpeed * tripMs) / 1000;
    const landingX = this.body.x + heading.x * hopLength;
    const landingY = this.body.y + heading.y * hopLength;
    const tooClose =
      Math.hypot(landingX - playerX, landingY - playerY) < balance.gio.keepAwayDistance ||
      Math.hypot(this.body.x - playerX, this.body.y - playerY) < balance.gio.keepAwayDistance;

    if (tooClose) {
      this.sitRemainingMs = balance.gio.sitMinMs;
      return;
    }

    this.facing = direction4From(heading);
    this.hopping = true;
    this.hopElapsedMs = 0;
    this.physicsBody.setVelocity(heading.x * balance.gio.hopSpeed, heading.y * balance.gio.hopSpeed);
    this.sprite.stop();
    this.sprite.setTexture(STAND_ID);
    this.sprite.setOrigin(0.5, footY(STAND_ID, this.facing) / characterEntry(STAND_ID).frameHeight);
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

  private syncSprite(lift: number): void {
    const feetY = this.body.y + BODY_HEIGHT / 2;
    this.sprite.setPosition(this.body.x, feetY - lift);
    this.sprite.setDepth(feetY);
  }
}
