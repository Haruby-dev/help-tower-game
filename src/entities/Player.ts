import Phaser from 'phaser';
import { animationKey, characterEntry, directionsOf, footY } from '../core/assets';
import { direction8From, velocityFrom, type Direction8, type Vector } from '../core/movement';
import balance from '../data/balance.json';

const WALK_ID = 'player_girl_walk';
const STAND_ID = 'player_girl_stand';
const BODY_WIDTH = 16;
const BODY_HEIGHT = 10;

export class Player {
  readonly body: Phaser.GameObjects.Zone;
  readonly sprite: Phaser.GameObjects.Sprite;
  private facing: Direction8 = 'south';

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

  private get physicsBody(): Phaser.Physics.Arcade.Body {
    return this.body.body as Phaser.Physics.Arcade.Body;
  }

  update(input: Vector): void {
    const velocity = velocityFrom(input, balance.player.speed);
    this.physicsBody.setVelocity(velocity.x, velocity.y);

    const direction = direction8From(input);
    if (direction) {
      this.facing = direction;
      this.showWalking();
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
