import Phaser from 'phaser';
import { assetUrl, registry } from '../core/assets';
import { idsInGroup, loadAtlasGroup, registerAtlasGroup, registerSlice } from '../core/atlas';
import { audioSettings, sound } from '../core/audio';
import { eventBus } from '../core/events';
import type { Vector } from '../core/movement';
import { createRng, type Rng } from '../core/rng';
import { gameState, type ContextAction } from '../core/state';
import type { Viewport } from '../core/viewport';
import balance from '../data/balance.json';
import dialogue from '../data/dialogue.json';
import display from '../data/display.json';
import monsters from '../data/monsters.json';
import type { GateMap, MonsterData } from '../data/schema';
import { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { eatItem } from '../systems/cooking';
import { chestOpened, forageReady, gateInfo, gateMapOf, gates, gateTimeUp, openGateChest, pickForage, type GateInfo } from '../systems/gates';
import { advanceClock } from '../systems/time';
import { nightAlpha } from './BaseScene';
import { popPill, sparkle } from './farmEffects';
import { type MonsterArt } from './monsterArt';
import { softEllipseTexture } from './sceneArt';
import { itemName } from '../ui/inventory';

/**
 * ฉากในเกต (ทดลองเกต 3 · 9 พ.ย. 2026) ใช้ได้กับทุกบานที่มีแผนที่ใน src/data/gate_maps/
 * ชั้นภาพ: ภาพวาดพื้นหลัง (ล่างสุด) → ตัวละครและของ เรียงตามเท้า → ชั้นหน้า (บนสุด เท้าตัวเอกซ่อนหลังพุ่มไม้ขอบล่าง)
 * ลานบ้านหลับไว้ระหว่างอยู่ในเกต ออกแล้วปลุกกลับมาที่หน้าประตูเกต
 */

type MoveKeys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

const STANDING_STILL: Vector = { x: 0, y: 0 };
const PLAYER_HEAD_PX = 66;
/** ชั้นภาพที่ไม่เรียงตามเท้า */
const DEPTH = { bg: -10, clouds: 7900, fg: 7950, night: 8000 } as const;
/** ระหว่างโหลดภาพและตอนกำลังออกจากเกต นาฬิกาหยุด */
const LOADING_WINDOW = 'gate-loading';
const LEAVING_WINDOW = 'gate-leaving';
const FADE_MS = 250;
/** บอกว่าหมดเวลาแล้วรอให้อ่านฟองคำพูดก่อนกลับบ้าน */
const TIME_UP_READ_MS = 1400;
/** ตัวชนของมอนสเตอร์เจ้าของชั้นกับหีบ (พิกเซลรอบเท้า) */
const OWNER_BODY = { width: 20, height: 10 };
const CHEST_BODY = { width: 30, height: 12 };
/** แตะของในฉากได้ภายในรัศมีนี้จากจุดกลางภาพ */
const TAP_RADIUS = 30;
/** ญาติมอนสเตอร์เดินไปจุดใหม่ห่างไม่ต่ำกว่า/ไม่เกินเท่านี้ ตรวจทางทุก ๆ PATH_STEP_PX */
const WANDER_MIN_PX = 32;
const WANDER_MAX_PX = 170;
const WANDER_TRIES = 24;
const PATH_STEP_PX = 8;
/** เกิดใต้ปากโพรงบ้าน ไล่ลงทีละนิดจนเจอช่องเดินได้ */
const BURROW_STEP_PX = 6;
const BURROW_GAP_PX = 6;
const CLOUD = { width: 220, height: 130, color: '60, 78, 110', solidUntil: 0.35 };

interface Kin {
  monster: Monster;
  idleUntil: number;
}

interface Target {
  kind: 'owner' | 'chest' | 'forage';
  x: number;
  y: number;
  /** จุดของป่าที่เท่าไหร่ */
  index?: number;
}

const monsterData = monsters as MonsterData;

export class GateScene extends Phaser.Scene {
  private floor = 3;
  /** ประตูบ้านในลาน เป็นลมในเกตแล้วตื่นที่นี่ */
  private home = { x: 0, y: 0 };
  private info!: GateInfo;
  private map!: GateMap;
  private tile = 32;
  private ready = false;
  private leaving = false;
  /** ทางออกทำงานหลังตัวเอกเดินออกจากเขตทางออกครั้งแรก (จุดเกิดอยู่ติดทางออก) */
  private exitArmed = false;
  private fainting = false;
  private entered = { day: 1, hour: 6 };
  private worldSize = { width: 1, height: 1 };
  private blocked = new Set<string>();
  private player!: Player;
  private owner: Monster | null = null;
  private kin: Kin[] = [];
  private chest: Phaser.GameObjects.Image | null = null;
  private chestBody: Phaser.GameObjects.Zone | null = null;
  private forage: (Phaser.GameObjects.Image | null)[] = [];
  private clouds: { image: Phaser.GameObjects.Image; speed: number }[] = [];
  private night!: Phaser.GameObjects.Rectangle;
  private keys!: MoveKeys;
  private runKey!: Phaser.Input.Keyboard.Key;
  private rng: Rng = createRng(Date.now());
  private stepTake = 0;

  constructor() {
    super('Gate');
  }

  init(data: { floor: number; home: { x: number; y: number } }): void {
    this.floor = data.floor;
    this.home = data.home;
  }

  create(): void {
    const info = gateInfo(this.floor);
    const map = gateMapOf(this.floor);
    if (!info?.map || !map) throw new Error(`gate ${this.floor} has no map`);
    this.info = info;
    this.map = map;
    this.tile = map.tile;
    this.ready = false;
    this.leaving = false;
    this.exitArmed = false;
    this.fainting = false;
    this.owner = null;
    this.kin = [];
    this.chest = null;
    this.chestBody = null;
    this.forage = [];
    this.clouds = [];
    this.rng = createRng(Date.now());
    this.entered = { day: gameState.world.day, hour: gameState.world.hour };
    this.worldSize = { width: map.size[0] * map.tile, height: map.size[1] * map.tile };
    this.blocked = new Set(map.blocked.map(([x, y]) => `${x},${y}`));
    this.cameras.main.setBackgroundColor(info.outside ?? '#000000');
    this.applyViewport(gameState.viewport);
    gameState.setWindowOpen(LOADING_WINDOW, true);
    gameState.setAction(null);

    const stopViewport = eventBus.on('viewport-changed', (viewport) => this.applyViewport(viewport));
    const stopAction = eventBus.on('action-pressed', () => this.useAction());
    const stopLighting = eventBus.on('lighting-changed', (enabled) => this.clouds.forEach(({ image }) => image.setVisible(enabled)));
    // นอน เป็นลม หรือหลับคาที่ระหว่างอยู่ในเกต ตื่นมาที่ลานบ้าน (เป็นลมตื่นหน้าบ้าน ระบบย้ายตัวเอกให้แล้ว)
    const stopRest = eventBus.on('rest-finished', ({ cause }) => this.leave(cause === 'faint'));
    const stopStarted = eventBus.on('game-started', () => this.leave(true));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopViewport();
      stopAction();
      stopLighting();
      stopRest();
      stopStarted();
      gameState.setWindowOpen(LOADING_WINDOW, false);
      gameState.setWindowOpen(LEAVING_WINDOW, false);
      gameState.setAction(null);
      this.owner?.destroy();
      for (const one of this.kin) one.monster.destroy();
    });

    void this.loadArt().then(() => {
      if (!this.sys.isActive()) return;
      this.build();
      gameState.setWindowOpen(LOADING_WINDOW, false);
      this.cameras.main.fadeIn(FADE_MS);
    });
  }

  /** ภาพของเกตนี้กับมอนสเตอร์เจ้าของชั้นโหลดตอนเข้าเกต (แผ่นรวม) โหลดแผ่นไม่ได้ใช้ไฟล์เดี่ยว */
  private async loadArt(): Promise<void> {
    const ownerArt = monsterData[this.map.owner.monster]?.art;
    const groups = [this.info.map!, ...(ownerArt ? [`monster_${this.map.owner.monster}`] : [])];
    const singles: string[] = [];
    for (const group of groups) {
      try {
        await loadAtlasGroup(group);
        registerAtlasGroup(this.textures, group);
      } catch {
        singles.push(...idsInGroup(group));
      }
    }
    const forageIcon = this.forageArt();
    if (forageIcon && !registerSlice(this.textures, forageIcon)) singles.push(forageIcon);
    const missing = singles.filter((id) => !this.textures.exists(id));
    if (missing.length === 0) return;
    for (const id of missing) {
      const entry = registry[id];
      if (entry?.type !== 'local') continue;
      if (entry.frame_width && entry.frame_height) this.load.spritesheet(id, assetUrl(entry.file), { frameWidth: entry.frame_width, frameHeight: entry.frame_height });
      else this.load.image(id, assetUrl(entry.file));
    }
    await new Promise<void>((resolve) => {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
  }

  /** ภาพของป่าในฉากคือไอคอนของในกระเป๋า (ภาพเดียวกัน ขนาดจริง) */
  private forageArt(): string | null {
    const item = this.info.forage?.item;
    if (!item?.startsWith('ing_')) return null;
    return `ing_icon_${item.slice('ing_'.length)}`;
  }

  private px(point: readonly [number, number]): { x: number; y: number } {
    return { x: point[0] * this.tile, y: point[1] * this.tile };
  }

  private isBlocked(x: number, y: number): boolean {
    const column = Math.floor(x / this.tile);
    const row = Math.floor(y / this.tile);
    if (column < 0 || row < 0 || column >= this.map.size[0] || row >= this.map.size[1]) return true;
    return this.blocked.has(`${column},${row}`);
  }

  private build(): void {
    const name = this.info.map!;
    const { width, height } = this.worldSize;
    this.add.image(0, 0, `${name}_bg`).setOrigin(0).setDepth(DEPTH.bg);
    this.add.image(0, 0, `${name}_fg`).setOrigin(0).setDepth(DEPTH.fg);
    this.physics.world.setBounds(0, 0, width, height);

    // ช่องเดินไม่ได้ รวมช่องติดกันในแถวเดียวเป็นตัวชนชิ้นเดียว
    const obstacles = this.physics.add.staticGroup();
    for (let row = 0; row < this.map.size[1]; row += 1) {
      let start = -1;
      for (let column = 0; column <= this.map.size[0]; column += 1) {
        const solid = column < this.map.size[0] && this.blocked.has(`${column},${row}`);
        if (solid && start < 0) start = column;
        if (!solid && start >= 0) {
          const runWidth = (column - start) * this.tile;
          obstacles.add(this.add.zone(start * this.tile + runWidth / 2, row * this.tile + this.tile / 2, runWidth, this.tile));
          start = -1;
        }
      }
    }

    const spawn = this.px(this.map.spawn);
    this.player = new Player(this, spawn.x, spawn.y);
    // จุดเกิดคือเท้า ตัวชนอยู่เหนือเท้าครึ่งความสูงตัวชน
    this.player.moveTo({ x: spawn.x, y: spawn.y - (this.player.feetY - this.player.body.y) });
    this.player.onWalkFrame = (index) => this.footstep(index);
    this.physics.add.collider(this.player.body, obstacles);

    // มอนสเตอร์เจ้าของชั้น ยืนท่าหวานหันหน้าลง
    const ownerId = this.map.owner.monster;
    const ownerArt = monsterData[ownerId]?.art;
    if (ownerArt) {
      const at = this.px(this.map.owner.pos);
      this.owner = new Monster(this, ownerId, ownerArt as MonsterArt, at, 100, true, this.rng);
      this.addBody(obstacles, at, OWNER_BODY);
    }

    if (this.info.reward && !chestOpened(gameState.world, this.floor)) {
      const at = this.px(this.map.reward_chest.pos);
      this.chest = this.add.image(at.x, at.y, 'gate_reward_chest').setOrigin(0.5, 1).setDepth(at.y);
      this.chestBody = this.addBody(obstacles, at, CHEST_BODY);
    }

    const forageIcon = this.forageArt();
    this.forage = this.map.forage.points.map((point, index) => {
      if (!forageIcon || !forageReady(gameState.world, this.floor, index)) return null;
      const at = this.px(point);
      return this.add.image(Math.round(at.x), Math.round(at.y), forageIcon).setOrigin(0.5, 1).setDepth(at.y);
    });

    this.createKin();
    this.createClouds();

    const nightColor = Phaser.Display.Color.HexStringToColor(display.night.color).color;
    this.night = this.add.rectangle(0, 0, width, height, nightColor, 0).setOrigin(0).setDepth(DEPTH.night);

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
    this.input.keyboard!.on('keydown-E', () => this.useAction());
    this.input.keyboard!.on('keydown-SPACE', () => this.useAction());
    // แตะของตรง ๆ เมื่อยืนใกล้
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const target = this.target();
      if (target && Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, target.x, target.y - this.tile / 2) < TAP_RADIUS) this.useAction();
    });

    this.ready = true;
    this.followPlayer();
  }

  private addBody(group: Phaser.Physics.Arcade.StaticGroup, feet: { x: number; y: number }, size: { width: number; height: number }): Phaser.GameObjects.Zone {
    const zone = this.add.zone(feet.x, feet.y - size.height / 2, size.width, size.height);
    group.add(zone);
    return zone;
  }

  /** ญาติมอนสเตอร์ (กระต่ายสามสี) เกิดใต้โพรงบ้านของตัวเอง เดินเล่นช้า ๆ ในเขตที่กำหนด ไม่คุย */
  private createKin(): void {
    const { kin } = this.map;
    const base = monsterData[kin.monster]?.art;
    if (!base) return;
    const name = this.info.map!;
    for (let index = 0; index < kin.count; index += 1) {
      const variant = kin.variants[index % kin.variants.length]!;
      const sheet = `${name}_kin_${variant}`;
      if (!this.textures.exists(`${sheet}_sweet_stand`)) continue;
      const art = { ...(base as MonsterArt), sheet, hungryEye: null };
      const home = this.px(kin.home_burrows[index % kin.home_burrows.length]!);
      const at = this.belowBurrow(home);
      const monster = new Monster(this, `${kin.monster}_kin_${variant}`, art, at, 100, true, this.rng);
      monster.speedMultiplier = this.info.kinSpeed ?? 1;
      this.kin.push({ monster, idleUntil: this.time.now + this.idleMs() });
    }
  }

  private belowBurrow(burrow: { x: number; y: number }): { x: number; y: number } {
    let y = burrow.y;
    while (this.isBlocked(burrow.x, y) && y < this.worldSize.height) y += BURROW_STEP_PX;
    return { x: Math.round(burrow.x), y: Math.round(y + BURROW_GAP_PX) };
  }

  private idleMs(): number {
    const [low, high] = this.info.kinIdleMs ?? [1500, 4500];
    return low + this.rng.next() * (high - low);
  }

  private pathClear(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(length / PATH_STEP_PX));
    for (let step = 1; step <= steps; step += 1) {
      const share = step / steps;
      if (this.isBlocked(from.x + (to.x - from.x) * share, from.y + (to.y - from.y) * share)) return false;
    }
    return true;
  }

  private wanderTarget(from: { x: number; y: number }): { x: number; y: number } | null {
    const [x0, y0, x1, y1] = this.map.kin.wander_area.map((value) => value * this.tile) as [number, number, number, number];
    for (let attempt = 0; attempt < WANDER_TRIES; attempt += 1) {
      const point = { x: Math.round(x0 + this.rng.next() * (x1 - x0)), y: Math.round(y0 + this.rng.next() * (y1 - y0)) };
      const distance = Math.hypot(point.x - from.x, point.y - from.y);
      if (distance < WANDER_MIN_PX || distance > WANDER_MAX_PX) continue;
      if (this.pathClear(from, point)) return point;
    }
    return null;
  }

  private updateKin(deltaMs: number, time: number, paused: boolean): void {
    for (const one of this.kin) {
      const { monster } = one;
      monster.update(deltaMs, paused, time);
      if (paused || !monster.arrived || monster.eating || time < one.idleUntil) continue;
      // พักอยู่: บางทีแทะหญ้า แล้วเดินไปจุดใหม่
      if (one.idleUntil > 0 && this.rng.next() < (this.info.kinNibbleChance ?? 0)) {
        monster.eat();
        one.idleUntil = 0;
        continue;
      }
      const target = this.wanderTarget({ x: monster.feetX, y: monster.feetY });
      if (target) monster.walkTo([target]);
      // หยุดพักเมื่อถึงที่ (เวลาพักนับจากตอนออกเดิน + เวลาเดินโดยประมาณ)
      const walkMs = target ? (Math.hypot(target.x - monster.feetX, target.y - monster.feetY) / (balance.monsters.walkSpeed * monster.speedMultiplier)) * 1000 : 0;
      one.idleUntil = time + walkMs + this.idleMs();
    }
  }

  /** เงาเมฆลอยช้า ๆ ทั้งฉาก (คูณสี จาง ๆ) ปิด "เอฟเฟกต์แสง" แล้วหายไป */
  private createClouds(): void {
    const rule = this.info.cloudShadows;
    if (!rule) return;
    const key = softEllipseTexture(this, { width: CLOUD.width, height: CLOUD.height, color: CLOUD.color, alpha: 1, solidUntil: CLOUD.solidUntil });
    for (let index = 0; index < rule.count; index += 1) {
      const x = ((index + this.rng.next() * 0.5) / rule.count) * (this.worldSize.width + CLOUD.width) - CLOUD.width / 2;
      const y = this.rng.next() * this.worldSize.height;
      const image = this.add
        .image(x, y, key)
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
        .setAlpha(rule.alpha)
        .setDepth(DEPTH.clouds)
        .setVisible(gameState.lightingEnabled);
      this.clouds.push({ image, speed: rule.driftPxPerSecond * (0.8 + this.rng.next() * 0.4) });
    }
  }

  private updateClouds(deltaMs: number): void {
    for (const cloud of this.clouds) {
      cloud.image.x += (cloud.speed * deltaMs) / 1000;
      if (cloud.image.x - CLOUD.width / 2 > this.worldSize.width) {
        cloud.image.x = -CLOUD.width / 2;
        cloud.image.y = this.rng.next() * this.worldSize.height;
      }
    }
  }

  override update(time: number, deltaMs: number): void {
    if (!this.ready) return;
    const paused = !gameState.clockRunning;
    const running = this.runKey.isDown || gameState.runHeld;
    const input = paused || this.leaving ? STANDING_STILL : this.readMoveInput();
    this.player.update(input, running);
    this.owner?.update(deltaMs, paused, time);
    this.updateKin(deltaMs, time, paused);
    if (gameState.lightingEnabled && !paused) this.updateClouds(deltaMs);
    this.followPlayer();

    const camera = this.cameras.main;
    const screenScale = camera.zoom / window.devicePixelRatio;
    gameState.trackPlayerScreen({
      x: (this.player.feetX - camera.worldView.x) * screenScale,
      y: (this.player.feetY - PLAYER_HEAD_PX - camera.worldView.y) * screenScale,
    });

    if (this.leaving) return;
    this.checkExit();
    advanceClock(deltaMs, this.home, (done) => this.playFaint(done));
    if (this.leaving) return;
    if (gameState.started) this.night.setFillStyle(this.night.fillColor, nightAlpha(gameState.world.hour));
    if (gameState.clockRunning && gateTimeUp(gameState.world, this.entered)) this.timeUp();
    gameState.setAction(this.contextAction());
  }

  private checkExit(): void {
    const [x0, y0, x1, y1] = this.map.exit_zone.map((value) => value * this.tile) as [number, number, number, number];
    const { feetX: x, feetY: y } = this.player;
    const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
    if (!inside) this.exitArmed = true;
    else if (this.exitArmed && gameState.clockRunning) this.leave(false);
  }

  private timeUp(): void {
    this.leaving = true;
    gameState.setWindowOpen(LEAVING_WINDOW, true);
    gameState.setAction(null);
    eventBus.emit('player-says', 'gateTimeUp');
    this.time.delayedCall(TIME_UP_READ_MS, () => {
      this.leaving = false;
      this.leave(false);
    });
  }

  /** กลับลานบ้านหน้าประตูเกต · keepPlace = ระบบย้ายตัวเอกไปแล้ว (เป็นลมตื่นหน้าบ้าน โหลดเซฟ) */
  private leave(keepPlace: boolean): void {
    if (this.leaving) return;
    this.leaving = true;
    gameState.setWindowOpen(LEAVING_WINDOW, true);
    gameState.setAction(null);
    if (!keepPlace) gameState.trackPlayer(gates.yardReturn);
    const finish = (): void => {
      this.scene.wake('Base');
      this.scene.stop();
    };
    if (keepPlace || !this.ready) {
      finish();
      return;
    }
    this.cameras.main.fadeOut(FADE_MS);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, finish);
  }

  private playFaint(done: () => void): void {
    this.fainting = true;
    this.player.playOnce(
      'anim_faint_south',
      () => undefined,
      () => {
        this.time.delayedCall(balance.player.faintHoldMs, () => {
          this.fainting = false;
          this.player.endOnce();
          done();
        });
      },
      true,
    );
  }

  /** ของที่ใกล้เท้าที่สุดที่ใช้ได้ในระยะเอื้อม */
  private target(): Target | null {
    if (!this.ready || this.player.busy || this.leaving) return null;
    const options: Target[] = [];
    if (this.owner) options.push({ kind: 'owner', x: this.owner.feetX, y: this.owner.feetY });
    if (this.chest) options.push({ kind: 'chest', x: this.chest.x, y: this.chest.y });
    this.forage.forEach((image, index) => {
      if (image) options.push({ kind: 'forage', x: image.x, y: image.y, index });
    });
    let best: Target | null = null;
    let bestDistance = balance.interact.reachPx;
    for (const option of options) {
      const distance = Phaser.Math.Distance.Between(this.player.feetX, this.player.feetY, option.x, option.y);
      if (distance < bestDistance) {
        best = option;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** คุยกับเจ้าของชั้นใช้ไอคอนคุยเหมือนคุยกับจีโอ · หีบกับของป่าใช้อุ้งเท้า (จุดกดใช้ทั่วไป) */
  private contextAction(): ContextAction | null {
    if (!gameState.clockRunning || this.fainting) return null;
    if (gameState.selectedFood) return { icon: 'eat', label: 'action.eat' };
    const target = this.target();
    if (!target) return null;
    if (target.kind === 'owner') return { icon: 'talk', label: 'action.talk' };
    return { icon: 'interact', label: target.kind === 'chest' ? 'action.open_chest' : 'action.forage' };
  }

  private useAction(): void {
    if (!this.ready || this.leaving || this.fainting || !gameState.clockRunning) return;
    const food = gameState.selectedFood;
    if (food) {
      this.eat(food);
      return;
    }
    const target = this.target();
    if (!target) return;
    if (target.kind === 'owner') this.talkToOwner();
    else if (target.kind === 'chest') this.openChest();
    else if (target.index !== undefined) this.pick(target.index);
  }

  /** เจ้าของชั้นพูดหนึ่งประโยคจากบทเดิมของตัวนี้ (บททักตอนมาเยี่ยมแบบสนิท) */
  private talkToOwner(): void {
    const owner = this.owner;
    if (!owner) return;
    const lines = (dialogue.monsters as Record<string, { appear?: Record<string, string[]> } | undefined>)[owner.id]?.appear;
    const pool = lines?.close ?? lines?.warm ?? [];
    const text = pool[Math.floor(this.rng.next() * pool.length)];
    if (!text) return;
    eventBus.emit('speech', { speaker: `gate:${owner.id}`, text, anchor: () => (owner.sprite.active ? this.toScreen(owner.feetX, owner.headY) : null) });
  }

  private openChest(): void {
    const result = openGateChest(gameState.world, this.floor);
    if (result === 'full') {
      eventBus.emit('player-says', 'bagFull');
      return;
    }
    if (!result || !this.chest) return;
    gameState.setWorld(result.world);
    sound.play('chest_open');
    const { x, y } = this.chest;
    sparkle(this, x, y - this.chest.height / 2);
    this.chest.destroy();
    this.chest = null;
    this.chestBody?.destroy();
    this.chestBody = null;
    this.pill(result.item, result.count, x, y - this.tile);
  }

  private pick(index: number): void {
    const image = this.forage[index];
    const result = pickForage(gameState.world, this.floor, index);
    if (result === 'full') {
      eventBus.emit('player-says', 'bagFull');
      return;
    }
    if (!result || !image) return;
    gameState.setWorld(result.world);
    sound.play('farm_harvest');
    sparkle(this, image.x, image.y - image.height / 2);
    image.destroy();
    this.forage[index] = null;
    this.pill(result.item, result.count, this.player.feetX, this.player.feetY - PLAYER_HEAD_PX);
  }

  private pill(item: string, count: number, x: number, y: number): void {
    const icon = item.startsWith('ing_') ? `ing_icon_${item.slice('ing_'.length)}` : item;
    popPill(this, x, y, this.textures.exists(icon) ? icon : '__WHITE', `+${count} ${itemName(item)}`, gameState.viewport.zoom);
  }

  /** กินจากแถบอาหารได้ในเกตด้วย (ท่ากินมือเปล่า ไม่วาดอาหารในมือ) */
  private eat(item: string): void {
    const next = eatItem(gameState.world, item);
    if (!next) return;
    gameState.setWorld(next);
    eventBus.emit('player-ate', item);
    if (!this.player.busy) this.player.playOnce('anim_eat_south', () => undefined, () => undefined);
  }

  private footstep(index: number): void {
    const { frames, keys } = audioSettings.steps;
    if (!frames.includes(index)) return;
    sound.play(keys[this.stepTake % keys.length]!);
    this.stepTake += 1;
  }

  private toScreen(x: number, y: number): { x: number; y: number } {
    const camera = this.cameras.main;
    const scale = camera.zoom / window.devicePixelRatio;
    return { x: (x - camera.worldView.x) * scale, y: (y - camera.worldView.y) * scale };
  }

  /** กล้องตามตัวเอกแบบลานบ้าน ขอบภาพตรงพิกเซลจอเต็มจุด · จอกว้างกว่าแผนที่ วางแผนที่กลางจอ */
  private followPlayer(): void {
    const camera = this.cameras.main;
    const { zoom } = camera;
    const viewWidth = camera.width / zoom;
    const viewHeight = camera.height / zoom;
    const snap = (want: number, view: number, world: number): number => {
      if (view >= world) return Math.round(((world - view) / 2) * zoom) / zoom;
      const max = world - view;
      const left = Math.min(Math.max(want - view / 2, 0), max);
      return Math.min(Math.round(left * zoom), Math.floor(max * zoom)) / zoom;
    };
    const left = snap(this.player.feetX, viewWidth, this.worldSize.width);
    const top = snap(this.player.sprite.y, viewHeight, this.worldSize.height);
    camera.setScroll(left - (camera.width - viewWidth) / 2, top - (camera.height - viewHeight) / 2);
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
    if (this.ready) this.followPlayer();
  }
}
