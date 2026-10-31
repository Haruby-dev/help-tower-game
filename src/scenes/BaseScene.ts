import Phaser from 'phaser';
import { footY, registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { createRng } from '../core/rng';
import { gameState } from '../core/state';
import type { Vector } from '../core/movement';
import type { Viewport } from '../core/viewport';
import { Gio } from '../entities/Gio';
import { Player } from '../entities/Player';
import { shadowTexture, softEllipseTexture } from './sceneArt';

type MoveKeys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

/** ลำดับชั้นภาพที่ไม่เรียงตามเท้า ค่าลบอยู่ใต้ตัวละครเสมอ ระลอกอยู่เหนือหินกลางบ่อ หมอกอยู่เหนือบ้านสัตว์เลี้ยงแต่หลังแนวต้นไม้ด้านล่าง */
const DEPTH = {
  ground: -10,
  deepWater: -9,
  flat: -8,
  flowers: -7,
  sun: -6,
  shadow: -5,
  ripple: 500,
  fog: 507,
  label: 9001,
} as const;

const PLAYER_SHADOW = { width: 30, height: 10 };
const GIO_SHADOW = { width: 40, height: 12 };
const FOG_DRIFT_PX = 6;
const FOG_DRIFT_MS = 5000;
const FOG_MIN_ALPHA = 0.8;
const LABEL_FONT_PX = 8;

export class BaseScene extends Phaser.Scene {
  private player!: Player;
  private gio!: Gio;
  private keys!: MoveKeys;
  private playerShadow!: Phaser.GameObjects.Image;
  private gioShadow!: Phaser.GameObjects.Image;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Base');
  }

  create(): void {
    this.labels = [];
    const map = this.make.tilemap({ key: 'base_map' });
    const tilesets = map.tilesets.map((tileset) => map.addTilesetImage(tileset.name, tileset.name)!);
    map.createLayer('ground', tilesets)!.setDepth(DEPTH.ground);

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

    for (const object of map.getObjectLayer('flowers')!.objects) {
      this.add.image(object.x ?? 0, object.y ?? 0, object.name).setDepth(DEPTH.flowers);
    }
    for (const object of map.getObjectLayer('objects')!.objects) this.placeObject(object);
    for (const effect of map.getObjectLayer('effects')!.objects) this.placeEffect(effect);

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
    this.playerShadow = this.add
      .image(playerSpawn.x, playerSpawn.y, shadowTexture(this, PLAYER_SHADOW.width, PLAYER_SHADOW.height))
      .setDepth(DEPTH.shadow);
    this.gioShadow = this.add
      .image(gioSpawn.x, gioSpawn.y, shadowTexture(this, GIO_SHADOW.width, GIO_SHADOW.height))
      .setDepth(DEPTH.shadow);

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
    this.playerShadow.setPosition(this.player.feetX, this.player.feetY);
    this.gioShadow.setPosition(this.gio.body.x, this.gio.sprite.y);
  }

  private placeObject(object: Phaser.Types.Tilemaps.TiledObject): void {
    const id = object.name;
    const entry = registry[id];
    if (entry?.type !== 'object' && entry?.type !== 'local' && entry?.type !== 'placeholder') {
      throw new Error(`map object ${id} is not in the registry`);
    }
    const x = object.x ?? 0;
    const y = object.y ?? 0;
    const flat = this.property<boolean>(object, 'flat') ?? false;
    const originY = entry.type === 'placeholder' ? 1 : footY(id) / entry.height;
    const image = this.add.image(x, y, id).setOrigin(0.5, originY).setDepth(flat ? DEPTH.flat : y);

    const submerged = this.property<number>(object, 'submerged');
    if (submerged) image.setCrop(0, 0, entry.width, Math.round(entry.height * submerged));

    const shadowWidth = this.property<number>(object, 'shadowWidth');
    const shadowHeight = this.property<number>(object, 'shadowHeight');
    if (shadowWidth && shadowHeight) {
      this.add.image(x, y, shadowTexture(this, shadowWidth, shadowHeight)).setDepth(DEPTH.shadow);
    }

    if (entry.type === 'placeholder') {
      const label = this.add
        .text(x, y - entry.height / 2, t(entry.labelKey as TextKey), {
          fontFamily: 'Mali',
          fontSize: `${LABEL_FONT_PX}px`,
          fontStyle: 'bold',
          color: '#fff1ee',
          stroke: '#3c2a22',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.label);
      this.labels.push(label);
    }
  }

  private placeEffect(effect: Phaser.Types.Tilemaps.TiledObject): void {
    const width = effect.width ?? 0;
    const height = effect.height ?? 0;
    const x = (effect.x ?? 0) + width / 2;
    const y = (effect.y ?? 0) + height / 2;

    if (effect.name === 'sun') {
      const key = softEllipseTexture(this, { width, height, color: '255, 236, 150', alpha: 0.26, solidUntil: 0.2 });
      this.add.image(x, y, key).setDepth(DEPTH.sun);
    } else if (effect.name === 'deep_water') {
      const key = softEllipseTexture(this, { width, height, color: '12, 62, 92', alpha: 0.42, solidUntil: 0.35 });
      this.add.image(x, y, key).setDepth(DEPTH.deepWater);
    } else if (effect.name === 'ripple') {
      const key = softEllipseTexture(this, { width, height, color: '236, 250, 250', alpha: 0.6, solidUntil: 0.5 });
      this.add.image(x, y, key).setDepth(DEPTH.ripple);
    } else if (effect.name === 'fog') {
      const key = softEllipseTexture(this, { width, height, color: '238, 243, 240', alpha: 0.72, solidUntil: 0.45 });
      const fog = this.add.image(x, y, key).setDepth(DEPTH.fog);
      this.tweens.add({
        targets: fog,
        x: x + FOG_DRIFT_PX,
        alpha: FOG_MIN_ALPHA,
        duration: FOG_DRIFT_MS,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      throw new Error(`map has unknown effect ${effect.name}`);
    }
  }

  private property<T>(object: Phaser.Types.Tilemaps.TiledObject, name: string): T | undefined {
    const properties = object.properties as { name: string; value: T }[] | undefined;
    return properties?.find((property) => property.name === name)?.value;
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
    // ชื่อบนกล่องแทนภาพวาดที่ความละเอียดจริงของจอ จึงไม่แตกเมื่อขยาย
    for (const label of this.labels) label.setResolution(viewport.zoom);
  }
}
