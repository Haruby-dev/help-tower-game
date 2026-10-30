import Phaser from 'phaser';
import { footY, registry } from '../core/assets';
import { eventBus } from '../core/events';
import { createRng } from '../core/rng';
import { gameState } from '../core/state';
import type { Vector } from '../core/movement';
import type { Viewport } from '../core/viewport';
import { Gio } from '../entities/Gio';
import { Player } from '../entities/Player';

type MoveKeys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

export class BaseScene extends Phaser.Scene {
  private player!: Player;
  private gio!: Gio;
  private keys!: MoveKeys;

  constructor() {
    super('Base');
  }

  create(): void {
    const map = this.make.tilemap({ key: 'base_map' });
    const tilesets = map.tilesets.map((tileset) => map.addTilesetImage(tileset.name, tileset.name)!);
    map.createLayer('ground', tilesets)!.setDepth(-1);

    const worldWidth = map.widthInPixels;
    const worldHeight = map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    const obstacles = this.physics.add.staticGroup();
    for (const rect of map.getObjectLayer('collision')!.objects) {
      const width = rect.width ?? 0;
      const height = rect.height ?? 0;
      const zone = this.add.zone((rect.x ?? 0) + width / 2, (rect.y ?? 0) + height / 2, width, height);
      obstacles.add(zone);
    }

    for (const object of map.getObjectLayer('objects')!.objects) {
      const id = object.name;
      const entry = registry[id];
      if (entry?.type !== 'object') throw new Error(`map object ${id} is not in the registry`);
      this.add
        .image(object.x ?? 0, object.y ?? 0, id)
        .setOrigin(0.5, footY(id) / entry.height)
        .setDepth(object.y ?? 0);
    }

    const spawns = map.getObjectLayer('spawns')!.objects;
    const spawn = (name: string): { x: number; y: number } => {
      const point = spawns.find((candidate) => candidate.name === name);
      if (!point) throw new Error(`map has no spawn ${name}`);
      return { x: point.x ?? 0, y: point.y ?? 0 };
    };

    const playerSpawn = spawn('player');
    const gioSpawn = spawn('gio');
    this.player = new Player(this, playerSpawn.x, playerSpawn.y);
    this.gio = new Gio(this, gioSpawn.x, gioSpawn.y, createRng(Date.now()));

    this.physics.add.collider(this.player.body, obstacles);
    this.physics.add.collider(this.gio.body, obstacles);
    this.physics.add.collider(this.player.body, this.gio.body);

    this.keys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    }) as MoveKeys;

    const camera = this.cameras.main;
    camera.setBounds(0, 0, worldWidth, worldHeight);
    camera.startFollow(this.player.sprite, true);

    this.applyViewport(gameState.viewport);
    const stopListening = eventBus.on('viewport-changed', (viewport) => this.applyViewport(viewport));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopListening);
  }

  override update(_time: number, deltaMs: number): void {
    this.player.update(this.readMoveInput());
    this.gio.update(deltaMs, this.player.feetX, this.player.feetY);
  }

  private readMoveInput(): Vector {
    const { up, down, left, right, w, a, s, d } = this.keys;
    const x = Number(right.isDown || d.isDown) - Number(left.isDown || a.isDown);
    const y = Number(down.isDown || s.isDown) - Number(up.isDown || w.isDown);
    return x === 0 && y === 0 ? gameState.joystick : { x, y };
  }

  private applyViewport(viewport: Viewport): void {
    const camera = this.cameras.main;
    camera.setSize(viewport.canvasWidth, viewport.canvasHeight);
    camera.setZoom(viewport.zoom);
  }
}
