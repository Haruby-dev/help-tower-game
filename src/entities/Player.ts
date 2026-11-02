import Phaser from 'phaser';
import { animationKey, characterEntry, directionsOf, footY } from '../core/assets';
import { direction8From, velocityFrom, type Direction8, type Vector } from '../core/movement';
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
    return this.acting;
  }

  /** ท่าทำสวนมี 3 ทิศ ทิศตะวันตกกลับด้านจากตะวันออก ระหว่างทำจะเดินไม่ได้ */
  playGardenMove(move: GardenMove, toward: { x: number; y: number }, onFrame: (frame: number) => void, onDone: () => void): void {
    const dx = toward.x - this.feetX;
    const dy = toward.y - this.feetY;
    const sideways = Math.abs(dx) > Math.abs(dy);
    this.facing = sideways ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north';
    const sheet = this.facing === 'west' ? 'east' : this.facing;
    const key = `anim_${move}_${sheet}`;
    this.acting = true;
    this.sprite.setFlipX(this.facing === 'west');
    this.sprite.setOrigin(0.5, footY(WALK_ID, sheet) / characterEntry(WALK_ID).frameHeight);
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

  update(input: Vector, running = false): void {
    if (this.acting) {
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
