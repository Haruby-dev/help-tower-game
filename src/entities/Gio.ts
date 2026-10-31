import Phaser from 'phaser';
import { animationKey, characterEntry, footY } from '../core/assets';
import { direction4From, type Vector } from '../core/movement';
import type { Rng } from '../core/rng';
import balance from '../data/balance.json';

const IDLE_ID = 'gio_idle';
const HOP_ID = 'gio_hop';
const BODY_WIDTH = 26;
const BODY_HEIGHT = 10;

export class Gio {
  readonly body: Phaser.GameObjects.Zone;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly homeX: number;
  private readonly homeY: number;
  private hopping = false;
  private sitRemainingMs = 0;

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
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.sit());
    this.sit();
    this.syncSprite();
  }

  private get physicsBody(): Phaser.Physics.Arcade.Body {
    return this.body.body as Phaser.Physics.Arcade.Body;
  }

  update(deltaMs: number, playerX: number, playerY: number): void {
    if (!this.hopping) {
      this.sitRemainingMs -= deltaMs;
      if (this.sitRemainingMs <= 0) this.tryHop(playerX, playerY);
    }
    this.syncSprite();
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
    const hopLength = (balance.gio.hopSpeed * this.hopDurationMs()) / 1000;
    const landingX = this.body.x + heading.x * hopLength;
    const landingY = this.body.y + heading.y * hopLength;
    const tooClose =
      Math.hypot(landingX - playerX, landingY - playerY) < balance.gio.keepAwayDistance ||
      Math.hypot(this.body.x - playerX, this.body.y - playerY) < balance.gio.keepAwayDistance;

    if (tooClose) {
      this.sitRemainingMs = balance.gio.sitMinMs;
      return;
    }

    const direction = direction4From(heading);
    this.hopping = true;
    this.physicsBody.setVelocity(heading.x * balance.gio.hopSpeed, heading.y * balance.gio.hopSpeed);
    this.sprite.setOrigin(0.5, footY(HOP_ID, direction) / characterEntry(HOP_ID).frameHeight);
    this.sprite.play(animationKey(HOP_ID, direction));
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

  private hopDurationMs(): number {
    const entry = characterEntry(HOP_ID);
    return (entry.frameCount / (entry.frameRate ?? 1)) * 1000;
  }

  private syncSprite(): void {
    const feetY = this.body.y + BODY_HEIGHT / 2;
    this.sprite.setPosition(this.body.x, feetY);
    this.sprite.setDepth(feetY);
  }
}
