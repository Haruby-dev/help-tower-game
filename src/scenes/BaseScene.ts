import Phaser from 'phaser';
import { footY, registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { createRng } from '../core/rng';
import { gameState } from '../core/state';
import type { Vector } from '../core/movement';
import type { Viewport } from '../core/viewport';
import { Gio } from '../entities/Gio';
import { Player, type GardenMove } from '../entities/Player';
import { Plot } from '../entities/Plot';
import { ACTION_LABEL, actionFor, applyFarmAction, canStoreHarvest, yieldOf, type FarmAction } from '../systems/farm';
import { advanceClock, goToSleep } from '../systems/time';
import balance from '../data/balance.json';
import display from '../data/display.json';
import { LIGHTING_PIPELINE, LightingPipeline, type LightSpot } from './LightingPipeline';
import { dirtPuff, floatText, harvestArc, sparkle, waterDrops } from './farmEffects';
import { createCanopyMask, softEllipseTexture, type ShadeArea } from './sceneArt';

type MoveKeys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

/** ลำดับชั้นภาพที่ไม่เรียงตามเท้า ค่าลบอยู่ใต้ตัวละครเสมอ */
const DEPTH = {
  ground: -10,
  flat: -8,
  flowers: -7,
  plotMarker: -6,
  night: 8000,
  label: 9001,
} as const;

const LIGHT_MASK_KEY = 'light_mask';
const TREE_SHADE = { lift: 24, width: 96, height: 72 };
const FOG_DRIFT_PX = 6;
const FOG_DRIFT_MS = 5000;
const FOG_MIN_ALPHA = 0.8;
const LABEL_FONT_PX = 8;
const PRICE_FONT_PX = 9;
/** ตำแหน่งตัวเลขราคาเหนือจุดเท้าของป้าย */
const PRICE_LIFT_PX = 30;

const STANDING_STILL: Vector = { x: 0, y: 0 };
const PLAYER_HEAD_PX = 66;
const DOOR_TAP_LIFT = 24;
const DOOR_TAP_RADIUS = 34;
const TILE_MIDDLE = 16;

/** ไล่ความมืดระหว่างจุดเวลาใน display.json */
export function nightAlpha(hour: number): number {
  const { keys } = display.night;
  const next = keys.findIndex((key) => key.hour >= hour);
  if (next <= 0) return keys[next === 0 ? 0 : keys.length - 1]!.alpha;
  const before = keys[next - 1]!;
  const after = keys[next]!;
  return before.alpha + ((after.alpha - before.alpha) * (hour - before.hour)) / (after.hour - before.hour);
}

export class BaseScene extends Phaser.Scene {
  private player!: Player;
  private gio!: Gio;
  private keys!: MoveKeys;
  private runKey!: Phaser.Input.Keyboard.Key;
  private labels: Phaser.GameObjects.Text[] = [];
  private shadeAreas: ShadeArea[] = [];
  private pool = { x: 0, y: 0, radiusX: 1, radiusY: 1 };
  private glows: Partial<Record<'fire' | 'gate' | 'burrow', LightSpot>> = {};
  private lightingWorld = { width: 1, height: 1 };
  private door = { x: 0, y: 0 };
  private night!: Phaser.GameObjects.Rectangle;
  private plots: Plot[] = [];
  private plotMarker!: Phaser.GameObjects.Graphics;
  private queuedPlot: number | null = null;

  constructor() {
    super('Base');
  }

  create(): void {
    this.labels = [];
    this.shadeAreas = [];
    this.glows = {};
    const map = this.make.tilemap({ key: 'base_map' });
    const tilesets = map.tilesets.map((tileset) => map.addTilesetImage(tileset.name, tileset.name)!);
    const ground = map.createLayer('ground', tilesets)!.setDepth(DEPTH.ground);
    this.createPlots(ground);

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

    this.door = spawn('door');
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

    this.runKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, worldWidth, worldHeight);
    camera.startFollow(this.player.sprite, true);

    this.setUpLighting(worldWidth, worldHeight);

    const nightColor = Phaser.Display.Color.HexStringToColor(display.night.color).color;
    this.night = this.add.rectangle(0, 0, worldWidth, worldHeight, nightColor, 0).setOrigin(0).setDepth(DEPTH.night);

    this.input.keyboard!.on('keydown-E', () => this.useAction());
    this.input.keyboard!.on('keydown-SPACE', () => this.useAction());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const tapped = this.plots.findIndex((plot) => Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, plot.centerX, plot.centerY) < map.tileWidth / 2);
      if (tapped >= 0 && gameState.clockRunning && this.inReach(tapped)) {
        this.useFarm(tapped);
        return;
      }
      const near = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, this.door.x, this.door.y - DOOR_TAP_LIFT);
      if (near < DOOR_TAP_RADIUS) this.useAction();
    });
    const stopAction = eventBus.on('action-pressed', () => this.useAction());
    const stopDig = eventBus.on('dig-confirmed', (plot) => this.startMove(plot, 'dig'));
    const stopMoved = eventBus.on('player-moved', (point) => this.player.moveTo(point));
    const stopStarted = eventBus.on('game-started', (world) => {
      if (world.player) this.player.moveTo(world.player);
    });
    if (gameState.started && gameState.world.player) this.player.moveTo(gameState.world.player);

    this.applyViewport(gameState.viewport);
    const stopViewport = eventBus.on('viewport-changed', (viewport) => this.applyViewport(viewport));
    const stopLighting = eventBus.on('lighting-changed', (enabled) => this.applyLighting(enabled));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopAction();
      stopDig();
      stopMoved();
      stopStarted();
      stopViewport();
      stopLighting();
    });
  }

  override update(_time: number, deltaMs: number): void {
    const running = this.runKey.isDown || gameState.runHeld;
    this.player.update(gameState.clockRunning ? this.readMoveInput() : STANDING_STILL, running);
    this.gio.update(deltaMs, this.player.feetX, this.player.feetY);
    gameState.trackPlayer({ x: this.player.body.x, y: this.player.body.y });
    const camera = this.cameras.main;
    const screenScale = camera.zoom / window.devicePixelRatio;
    gameState.trackPlayerScreen({
      x: (this.player.feetX - camera.worldView.x) * screenScale,
      y: (this.player.feetY - PLAYER_HEAD_PX - camera.worldView.y) * screenScale,
    });
    advanceClock(deltaMs, this.door);
    this.updateFarm();
    if (gameState.started) this.night.setFillStyle(this.night.fillColor, nightAlpha(gameState.world.hour));
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

    const plot = this.property<number>(object, 'plot');
    if (plot !== undefined) {
      const price = this.add
        .text(x, y - PRICE_LIFT_PX, String(balance.land.prices[plot]), {
          fontFamily: 'Mali',
          fontSize: `${PRICE_FONT_PX}px`,
          fontStyle: 'bold',
          color: '#5a3a22',
        })
        .setOrigin(0.5)
        .setDepth(y + 1);
      this.labels.push(price);
    }

    // ต้นไม้ทำให้เกิดร่มเงาบนพื้นรอบต้น
    if (id.startsWith('tree_big')) {
      this.shadeAreas.push({
        x,
        y: y - TREE_SHADE.lift,
        width: TREE_SHADE.width,
        height: TREE_SHADE.height,
        blobs: display.lighting.treeBlobs,
      });
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

    if (effect.name === 'light_pool') {
      this.pool = { x, y, radiusX: width / 2, radiusY: height / 2 };
    } else if (effect.name === 'canopy') {
      this.shadeAreas.push({ x, y, width, height, blobs: display.lighting.patchBlobs });
    } else if (effect.name === 'glow_fire') {
      this.glows.fire = { x, y, radius: width / 2 };
    } else if (effect.name === 'glow_gate') {
      this.glows.gate = { x, y, radius: width / 2 };
    } else if (effect.name === 'glow_burrow') {
      this.glows.burrow = { x, y, radius: width / 2 };
    } else if (effect.name === 'fog') {
      const key = softEllipseTexture(this, { width, height, color: '238, 243, 240', alpha: 0.72, solidUntil: 0.45 });
      const fog = this.add.image(x, y, key).setDepth(y + height / 2);
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

  private nearDoor(): boolean {
    return (
      gameState.clockRunning &&
      Phaser.Math.Distance.Between(this.player.body.x, this.player.body.y, this.door.x, this.door.y) <
        balance.interact.reachPx
    );
  }

  private useAction(): void {
    const plot = this.targetPlot();
    if (plot !== null && this.farmActionAt(plot)) this.useFarm(plot);
    else if (this.nearDoor() && !this.player.busy) goToSleep(this.door);
  }

  private createPlots(ground: Phaser.Tilemaps.TilemapLayer): void {
    const { plotOrigin, cols, rows } = balance.farm;
    this.plots = Array.from({ length: cols * rows }, (_, index) => {
      const tile = ground.getTileAt(plotOrigin.col + (index % cols), plotOrigin.row + Math.floor(index / cols));
      if (!tile) throw new Error(`map has no soil for plot ${index}`);
      const plot = new Plot(this, tile, DEPTH.flat);
      this.labels.push(plot.label);
      return plot;
    });
    this.plotMarker = this.add.graphics().setDepth(DEPTH.plotMarker).setVisible(false);
    this.plotMarker.lineStyle(1, 0xffffff, 0.9).strokeRect(0.5, 0.5, ground.tilemap.tileWidth - 1, ground.tilemap.tileHeight - 1);
  }

  private distanceToPlot(index: number): number {
    const plot = this.plots[index]!;
    return Phaser.Math.Distance.Between(this.player.feetX, this.player.feetY, plot.centerX, plot.centerY);
  }

  private inReach(index: number): boolean {
    return this.distanceToPlot(index) < balance.farm.reachPx;
  }

  /** แปลงใกล้เท้าที่สุดที่เอื้อมถึง */
  private targetPlot(): number | null {
    let best: number | null = null;
    this.plots.forEach((_, index) => {
      if (this.inReach(index) && (best === null || this.distanceToPlot(index) < this.distanceToPlot(best))) best = index;
    });
    return best;
  }

  private farmActionAt(index: number): FarmAction | null {
    const plot = gameState.world.farm.plots[index];
    return plot ? actionFor(plot, gameState.selectedTool, gameState.selectedSeed, gameState.world.bag) : null;
  }

  private updateFarm(): void {
    if (!gameState.started) return;
    const { plots } = gameState.world.farm;
    this.plots.forEach((plot, index) => plot.sync(plots[index]!));
    const target = gameState.clockRunning ? this.targetPlot() : null;
    const action = target !== null ? this.farmActionAt(target) : null;
    if (target !== null && action) {
      const plot = this.plots[target]!;
      this.plotMarker.setPosition(plot.centerX - TILE_MIDDLE, plot.centerY - TILE_MIDDLE).setVisible(true);
    } else {
      this.plotMarker.setVisible(false);
    }
    gameState.setAction(action ? ACTION_LABEL[action] : this.nearDoor() ? 'action.sleep' : null);
  }

  /** ตอนกำลังทำท่าอยู่ แตะใหม่จะจำไว้ทำต่อ */
  private useFarm(index: number): void {
    if (this.player.busy) {
      this.queuedPlot = index;
      return;
    }
    const action = this.farmActionAt(index);
    if (!action) return;
    if (action === 'dig') {
      const crop = gameState.world.farm.plots[index]!.crop!.id;
      eventBus.emit('dig-requested', { plot: index, crop });
      return;
    }
    if (action === 'harvest' && !canStoreHarvest(gameState.world, index)) {
      eventBus.emit('player-says', 'bagFull');
      return;
    }
    this.startMove(index, action);
  }

  private startMove(index: number, action: FarmAction): void {
    const plot = this.plots[index]!;
    const seed = gameState.selectedSeed;
    const move: GardenMove = action === 'dig' ? 'till' : action;
    this.player.playGardenMove(
      move,
      { x: plot.centerX, y: plot.centerY },
      (frame) => this.playMoveEffect(move, frame, plot),
      () => {
        const before = gameState.world.farm.plots[index]!;
        const amount = yieldOf(before);
        const crop = before.crop?.id;
        const next = applyFarmAction(gameState.world, index, action, seed);
        if (next) {
          gameState.setWorld(next);
          plot.sync(next.farm.plots[index]!);
          if (action === 'plant') plot.pop();
          if (action === 'water' && crop) {
            plot.wake();
            sparkle(this, plot.centerX, plot.centerY - TILE_MIDDLE);
          }
          if (action === 'harvest' && crop) this.showHarvest(plot, crop, amount);
        }
        const queued = this.queuedPlot;
        this.queuedPlot = null;
        if (queued !== null) this.useFarm(queued);
      },
    );
  }

  private playMoveEffect(move: GardenMove, frame: number, plot: Plot): void {
    if ((move === 'plant' && frame >= 4 && frame <= 7) || (move === 'till' && frame >= 4 && frame <= 6)) {
      dirtPuff(this, plot.centerX, plot.centerY);
    }
    if (move === 'water' && frame === 3) {
      waterDrops(this, this.player.feetX, this.player.feetY - PLAYER_HEAD_PX / 2, plot.centerX, plot.centerY);
    }
  }

  private showHarvest(plot: Plot, crop: string, amount: number): void {
    const handY = this.player.feetY - PLAYER_HEAD_PX / 2;
    harvestArc(this, `icon_${crop}`, plot.centerX, plot.centerY, this.player.feetX, handY, () => {
      const name = t(`crop.${crop}.name` as TextKey);
      floatText(this, this.player.feetX, this.player.feetY - PLAYER_HEAD_PX, `+${amount} ${name}`, gameState.viewport.zoom);
    });
  }

  private setUpLighting(worldWidth: number, worldHeight: number): void {
    const renderer = this.game.renderer;
    if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
    if (!renderer.pipelines.getPostPipeline(LIGHTING_PIPELINE)) {
      renderer.pipelines.addPostPipeline(LIGHTING_PIPELINE, LightingPipeline);
    }
    if (!this.textures.exists(LIGHT_MASK_KEY)) {
      createCanopyMask(this, LIGHT_MASK_KEY, worldWidth, worldHeight, this.shadeAreas, createRng(display.lighting.seed));
    }
    this.lightingWorld = { width: worldWidth, height: worldHeight };
    this.applyLighting(gameState.lightingEnabled);
  }

  private applyLighting(enabled: boolean): void {
    const { fire, gate, burrow } = this.glows;
    const camera = this.cameras.main;
    if (!(this.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) || !fire || !gate || !burrow) return;
    camera.removePostPipeline(LIGHTING_PIPELINE);
    if (!enabled) return;
    camera.setPostPipeline(LIGHTING_PIPELINE);
    const pipeline = camera.getPostPipeline(LIGHTING_PIPELINE) as LightingPipeline;
    pipeline.configure({
      maskKey: LIGHT_MASK_KEY,
      worldWidth: this.lightingWorld.width,
      worldHeight: this.lightingWorld.height,
      pool: this.pool,
      glows: [fire, gate, burrow],
    });
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
