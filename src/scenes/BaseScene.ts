import Phaser from 'phaser';
import { footY, registry } from '../core/assets';
import { audioSettings, sound, type SoundHandle } from '../core/audio';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { createRng } from '../core/rng';
import { gameState, type ActionIcon, type ContextAction } from '../core/state';
import type { Vector } from '../core/movement';
import type { Viewport } from '../core/viewport';
import { Gio, type GioSeat } from '../entities/Gio';
import { Campfire } from '../entities/Campfire';
import { Player, type GardenMove } from '../entities/Player';
import { Plot } from '../entities/Plot';
import { FishingRig } from '../entities/FishingRig';
import { finishBath } from '../systems/bath';
import { autoHooks, baits, catchItem, chosenBait, finishCast, rollCatch, type Catch } from '../systems/fishing';
import { countOf, seedItem } from '../systems/farm';
import { canShakeBanana, shakeBanana } from '../systems/crafting';
import { ACTION_LABEL, actionFor, applyFarmAction, canStoreHarvest, isWithered, produceItem, type FarmAction } from '../systems/farm';
import { withStars } from '../systems/stars';
import { MYSTERY, collectDish, cookMethodOf, dishItem, eatItem, isCooked, isDish, isRawProduce, parseDish, recipes as cookRecipes } from '../systems/cooking';
import { baseItem } from '../systems/stars';
import recipes from '../data/recipes.json';
import { registerSlice } from '../core/atlas';
import { foodArtKey } from './monsterArt';
import { advanceClock, goToSleep } from '../systems/time';
import balance from '../data/balance.json';
import display from '../data/display.json';
import { LIGHTING_PIPELINE, LightingPipeline, type LightSpot } from './LightingPipeline';
import { bathBubble, dirtPuff, harvestArc, popPill, sparkle, splash } from './farmEffects';
import { Pond, type CastSpot, type PondObject } from './Pond';
import { WeatherEffects } from './weatherEffects';
import { TreeSway } from './treeSway';
import { createCanopyMask, softEllipseTexture, type ShadeArea } from './sceneArt';
import { formatMoney } from '../systems/economy';
import { isGioAway, isTripLive } from '../systems/gio';
import { landAt, nextLand, plotCell } from '../systems/land';
import { Arranger, type Rect as ArrangeRect } from './arrange';
import { TrayView } from './trayView';
import { cullOffscreen } from './culling';
import { Visits } from './visits';
import { summonNow } from '../systems/monsters';
import { ownedDecor } from '../systems/decor';
import { SurfaceMap, type Surface } from './surface';

/** เสียงบรรยากาศตามระยะคิดทุกเท่านี้ (มิลลิวินาที) และปัดระดับเป็นขั้นละ 1/20 จะได้ไม่สั่งเสียงทุกเฟรม */
const NEAR_AMBIENCE_EVERY_MS = 150;
const NEAR_AMBIENCE_STEPS = 20;

const CHIME = 'deco_bell_chime';
const CHIME_SHEET = 'deco_bell_chime_sway';
const CHIME_SWAY = 'deco_bell_chime_sway_loop';
const CHIME_FRAMES = 8;

type MoveKeys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

/** ลำดับชั้นภาพที่ไม่เรียงตามเท้า ค่าลบอยู่ใต้ตัวละครเสมอ */
const DEPTH = {
  ground: -10,
  flat: -8,
  flowers: -7,
  pond: -9.5,
  plotMarker: -6,
  arrange: 7980,
  weather: 7990,
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
/** ครึ่งความกว้างที่ยืนใช้โต๊ะช่างกับกอกล้วยได้รอบฐาน (พิกเซลเกม) */
const WORKBENCH_SLACK_PX = 24;
const BANANA_SLACK_PX = 56;
/** กอกล้วยโยกซ้ายขวา 1 พิกเซล */
const BANANA_SHAKE_STEPS = 8;
const BANANA_SHAKE_MS = 480;
/** ความสูงภาพในป้ายเด้งที่วางพอดีเหนือหัว (ป้ายผัก) ภาพที่สูงกว่านี้ยกป้ายขึ้นตาม */
const DISH_POP_BASE_PX = 16;
const DOOR_TAP_LIFT = 24;
const DOOR_TAP_RADIUS = 34;
const TILE_MIDDLE = 16;
/** ขนาดช่องแผนที่ ใช้แปลงตำแหน่งพิกเซลเป็นช่องตอนหาว่าของอยู่ในที่ดินแปลงไหน */
const TILE_PX = 32;
/** แสงเรืองกองไฟอยู่เหนือเท้ากองไฟเท่านี้ (ตามจุด glow_fire บนแผนที่เดิม) */
const FIRE_GLOW_LIFT = 16;
const ARRANGE_WINDOW = 'arrange';
const TILL_HIT_FRAME = 6;
const TILL_DIRT_PIECES = 2;
const MINUTES_PER_HOUR = 60;
const MS_PER_SECOND = 1000;
/** อาหารที่ทำเสร็จเด้งขึ้นเหนือกองไฟเท่านี้ */
const BATH_BUBBLE_MS = 280;
const BATH_SPARKLE_SHARE = 0.25;
const BATH_SPREAD_PX = 12;
/** ปลายคันในภาพทิศตะวันออก กลับด้านเป็นทิศตะวันตกด้วย 87 − x */
const FRAME_LAST_PX = 87;
const SEED_PILL_DELAY_MS = 450;

type FishingPhase = 'cast' | 'wait' | 'nibble' | 'bite' | 'reel';

const FARM_ICON: Record<FarmAction, ActionIcon> = { till: 'till', dig: 'till', plant: 'plant', water: 'water', harvest: 'harvest', fertilize: 'plant' };
/** ภาพท่ารดน้ำมีน้ำไหลจากบัวอยู่แล้ว เติมแค่น้ำกระเซ็นเล็ก ๆ บนแปลงตอนน้ำถึงดิน */
const WATER_SPLASH_FRAME = 5;

interface FishingTrip {
  phase: FishingPhase;
  bait: string;
  spot: CastSpot;
  castHour: number;
  timer: Phaser.Time.TimerEvent | null;
}

interface BathTrip {
  startHour: number;
  effect: Phaser.Time.TimerEvent;
  /** เลิกฟังเฟรมท่าอาบน้ำ (เสียงวักน้ำกับน้ำกระเซ็น) */
  stopSounds: () => void;
}

/** ไล่ความมืดระหว่างจุดเวลาใน display.json */
export function nightAlpha(hour: number): number {
  const { keys } = display.night;
  const next = keys.findIndex((key) => key.hour >= hour);
  if (next <= 0) return keys[next === 0 ? 0 : keys.length - 1]!.alpha;
  const before = keys[next - 1]!;
  const after = keys[next]!;
  return before.alpha + ((after.alpha - before.alpha) * (hour - before.hour)) / (after.hour - before.hour);
}

/** จุดทางเดินของจีโอไปโพรงบนแผนที่ ชื่อ gio_trip_1, gio_trip_2, … เรียงจากตะกร้าไปโพรง */
const GIO_TRIP_PREFIX = 'gio_trip_';
/** มอนสเตอร์ใช้ทางเดียวกันจากโพรงออกมาที่ลาน จำนวนจุดจากฝั่งโพรง */
const MONSTER_ROUTE_POINTS = 3;
/** ที่นั่งกินใกล้โพรงบนแผนที่ ชื่อ monster_eat_1, monster_eat_2, … */
const MONSTER_EAT_PREFIX = 'monster_eat_';
/** แตะถาดตรงกลางภาพ (เหนือเท้าถาด) */
const TRAY_TAP_LIFT = 12;

export class BaseScene extends Phaser.Scene {
  private player!: Player;
  private gio!: Gio;
  private gioSeat: GioSeat | null = null;
  /** สรุปยอดเปิดเองครั้งเดียวต่อรอบที่จีโอกลับ ตอนเดินมาใกล้ */
  private receiptShownDay = 0;
  private keys!: MoveKeys;
  private runKey!: Phaser.Input.Keyboard.Key;
  private labels: Phaser.GameObjects.Text[] = [];
  private shadeAreas: ShadeArea[] = [];
  private pool = { x: 0, y: 0, radiusX: 1, radiusY: 1 };
  private glows: Partial<Record<'fire' | 'gate' | 'burrow', LightSpot>> = {};
  private lightingWorld = { width: 1, height: 1 };
  private worldSize = { width: 1, height: 1 };
  private door = { x: 0, y: 0 };
  private night!: Phaser.GameObjects.Rectangle;
  private plots: Plot[] = [];
  private grownSoundAt = -Infinity;
  /** รอบเสียงเท้าแยกตามพื้น หญ้ากับดินนับของตัวเอง */
  private stepTakes: Record<Surface, number> = { grass: 0, dirt: 0 };
  private surfaces!: SurfaceMap;
  /** เสียงออกแรงตอนพรวนดิน สุ่มราว 1 ใน 3 ไม่ติดกันเกินไป */
  private readonly voiceRng = createRng(Date.now() + 31);
  private lastTillVoiceAt = -Infinity;
  /** เสียงบ่อน้ำกับกองไฟตามระยะ คิดทุก NEAR_AMBIENCE_EVERY_MS ส่งเมื่อระดับเปลี่ยน */
  private nearAmbienceAt = 0;
  private nearAmbienceShown = '';
  /** กระดิ่งลมแฝดดังเมื่อเดินเข้าใกล้ ไม่ถี่กว่าที่ตั้งไว้ */
  private chimeNear = false;
  private chimeRungAt = -Infinity;
  private ground!: Phaser.Tilemaps.TilemapLayer;
  /** ชั้นแปลงผักของที่ดิน land_1..3 แสดงชั้นเดียวตามจำนวนที่ซื้อแล้ว */
  private landLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  /** ของที่หายไปเมื่อซื้อที่ดินแปลงนั้น: วัชพืช ตอไม้ หิน ป้าย ราคา และตัวกันเดิน */
  private landClutter: { destroy(): void }[][] = [];
  private landSigns: { x: number; y: number }[] = [];
  private landShown = -1;
  /** โหมดจัดวางของบนตาราง */
  private arranger!: Arranger;
  private movableBlockers = new Map<string, Phaser.GameObjects.Zone>();
  private placedApplied = false;
  /** กระดิ่งลมแฝด (รางวัลทายแฝดถูก) แกว่งเบา ๆ ที่ลานหน้าบ้าน ย้ายได้ในโหมดจัดวาง */
  private chime: Phaser.GameObjects.Sprite | null = null;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private plotMarker!: Phaser.GameObjects.Sprite;
  private queuedPlot: number | null = null;
  /** อาหารกับปลายนิ้วที่วาดทับท่ากิน มีค่าระหว่างกำลังกิน */
  private eatArt: { dish: Phaser.GameObjects.Image | null; hands: Phaser.GameObjects.Image } | null = null;
  /** กำลังเล่นท่าเป็นลมก่อนม่านขึ้น */
  private fainting = false;
  /** กินแล้วแต่ท่าอื่นยังไม่จบ รอเล่นท่ากิน */
  private pendingEat: string | null = null;
  private campfire: Campfire | null = null;
  private trayView: TrayView | null = null;
  /** โต๊ะช่างเก่า (ย้ายได้ในโหมดจัดวาง) กับกอกล้วยมุมล่างขวา */
  private workbench: Phaser.GameObjects.Image | null = null;
  private banana: Phaser.GameObjects.Image | null = null;
  private visits: Visits | null = null;
  private cookingShown: boolean | null = null;
  /** ทำครั้งเดียว เวลาเดียว: ระหว่างตัวเอกทำท่าทำอาหาร นาฬิกาเดินเร็วขึ้นเท่านี้ เวลาของแรงก์จึงผ่านไปใน balance.cooking.fastCookMs */
  private fastCookScale = 1;
  /** เสียงผัดวนระหว่างยืนทำอาหารที่กองไฟ */
  private cookLoop: SoundHandle | null = null;
  private pond: Pond | null = null;
  private treeSway = new TreeSway();
  private pondObjects: PondObject[] = [];
  private rig!: FishingRig;
  private weatherFx!: WeatherEffects;
  private fishing: FishingTrip | null = null;
  private bath: BathTrip | null = null;
  private readonly fishRng = createRng(Date.now());
  private readonly farmRng = createRng(Date.now() + 1);

  constructor() {
    super('Base');
  }

  create(): void {
    this.labels = [];
    this.pondObjects = [];
    this.fishing = null;
    this.bath = null;
    this.trayView = null;
    this.chime = null;
    this.treeSway = new TreeSway();
    this.shadeAreas = [];
    this.glows = {};
    const map = this.make.tilemap({ key: 'base_map' });
    const tilesets = map.tilesets.map((tileset) => map.addTilesetImage(tileset.name, tileset.name)!);
    const ground = map.createLayer('ground', tilesets)!.setDepth(DEPTH.ground);
    this.ground = ground;
    this.landShown = -1;
    this.landClutter = balance.land.lands.map(() => []);
    this.landSigns = [];
    this.landLayers = balance.land.lands.map((_, index) => map.createLayer(`land_${index + 1}`, tilesets)!.setDepth(DEPTH.ground).setVisible(false));
    this.surfaces = new SurfaceMap(this, () => [...this.landLayers, this.ground]);
    this.stepTakes = { grass: 0, dirt: 0 };
    this.nearAmbienceShown = '';
    this.chimeNear = false;
    this.createPlots(ground);

    const worldWidth = map.widthInPixels;
    const worldHeight = map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    const obstacles = this.physics.add.staticGroup();
    this.obstacles = obstacles;
    this.movableBlockers = new Map();
    this.placedApplied = false;
    this.arranger = new Arranger(this, DEPTH.arrange, (rect, ignore) => this.blockedFor(rect, ignore));
    for (const rect of map.getObjectLayer('collision')!.objects) {
      const width = rect.width ?? 0;
      const height = rect.height ?? 0;
      const zone = this.add.zone((rect.x ?? 0) + width / 2, (rect.y ?? 0) + height / 2, width, height);
      obstacles.add(zone);
      const moving = /^move_(.+)$/.exec(rect.name ?? '')?.[1];
      if (moving) this.movableBlockers.set(moving, zone);
      // ตัวกันเดินของที่ดินที่ยังไม่ซื้อ และหินในรั้ว หายไปพร้อมกันตอนซื้อ
      const land = /^land_(\d)$/.exec(rect.name ?? '')?.[1] ?? landAt(zone.x / map.tileWidth, zone.y / map.tileHeight);
      if (land !== null && land !== undefined) this.landClutter[Number(land)]?.push(zone);
    }

    for (const object of map.getObjectLayer('flowers')!.objects) {
      this.add.image(object.x ?? 0, object.y ?? 0, object.name).setDepth(DEPTH.flowers);
    }
    for (const object of map.getObjectLayer('objects')!.objects) this.placeObject(object);
    this.pond = Pond.create(this, ground, this.pondObjects, DEPTH.pond);
    this.pond?.setEffects(gameState.lightingEnabled);
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
    const tripStep = (name: string): number => Number(name.slice(GIO_TRIP_PREFIX.length));
    const tripRoute = spawns
      .filter((point) => point.name.startsWith(GIO_TRIP_PREFIX))
      .sort((a, b) => tripStep(a.name) - tripStep(b.name))
      .map((point) => ({ x: point.x ?? 0, y: point.y ?? 0 }));
    this.player = new Player(this, playerSpawn.x, playerSpawn.y);
    this.player.onWalkFrame = (index) => this.footstep(index);
    this.gio = new Gio(this, gioSpawn, this.gioSeat, createRng(Date.now()), { route: tripRoute, burrow: spawn('gio_burrow') });
    const eatSpots = spawns
      .filter((point) => point.name.startsWith(MONSTER_EAT_PREFIX))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((point) => ({ x: point.x ?? 0, y: point.y ?? 0 }));
    this.visits = new Visits(
      this,
      { burrow: spawn('gio_burrow'), route: [...tripRoute].reverse().slice(0, MONSTER_ROUTE_POINTS), eatSpots },
      () => this.trayView,
      (x, y) => this.toScreen(x, y),
    );

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
    this.worldSize = { width: worldWidth, height: worldHeight };
    this.followPlayer();

    this.setUpLighting(worldWidth, worldHeight);

    const nightColor = Phaser.Display.Color.HexStringToColor(display.night.color).color;
    this.night = this.add.rectangle(0, 0, worldWidth, worldHeight, nightColor, 0).setOrigin(0).setDepth(DEPTH.night);
    this.weatherFx = new WeatherEffects(this, DEPTH.weather);
    this.rig = new FishingRig(this);
    // ภาพนอกกล้องไม่ต้องวาด มือถือจะได้ไม่สั่งวาดหลายร้อยครั้งต่อภาพ
    cullOffscreen(this);

    this.input.keyboard!.on('keydown-E', () => this.useAction());
    this.input.keyboard!.on('keydown-SPACE', () => this.useAction());
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.arranger.active && pointer.isDown) this.arranger.drag(pointer.worldX, pointer.worldY);
    });
    // ปล่อยนิ้วนอกพื้นที่เกม (เช่นใต้แถบบน) ก็นับเป็นปล่อย ของจะได้ไม่ค้างกลางทาง
    const dropArranged = (): void => {
      if (!this.arranger.active) return;
      const placed = this.arranger.release(this.playerRect());
      if (placed) gameState.setWorld({ ...gameState.world, placed: { ...gameState.world.placed, [placed.id]: placed.feet } });
      this.reportArrange();
    };
    this.input.on('pointerup', dropArranged);
    this.input.on('pointerupoutside', dropArranged);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.arranger.active) {
        this.arranger.press(pointer.worldX, pointer.worldY);
        this.reportArrange();
        return;
      }
      // ระหว่างตกปลา แตะตรงไหนก็ได้คือดึงเบ็ด
      if (this.fishing) {
        if (this.fishing.phase === 'bite') this.finishFishing(true);
        return;
      }
      const tapped = this.plots.findIndex((plot) => Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, plot.centerX, plot.centerY) < map.tileWidth / 2);
      if (tapped >= 0 && gameState.clockRunning && this.inReach(tapped)) {
        this.useFarm(tapped);
        return;
      }
      if (this.campfireInReach() && this.campfire && Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, this.campfire.x, this.campfire.y) < DOOR_TAP_RADIUS) {
        this.useAction();
        return;
      }
      const tray = this.trayView?.image;
      if (tray && this.trayInReach() && Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, tray.x, tray.y - TRAY_TAP_LIFT) < DOOR_TAP_RADIUS) {
        eventBus.emit('tray-open', undefined);
        return;
      }
      // แตะโต๊ะช่างหรือกอกล้วยตรง ๆ เมื่อยืนใกล้
      if (this.workbenchInReach() && this.workbench?.getBounds().contains(pointer.worldX, pointer.worldY)) {
        eventBus.emit('workbench-open', undefined);
        return;
      }
      if (this.bananaReady() && this.banana?.getBounds().contains(pointer.worldX, pointer.worldY)) {
        this.shakeBananaClump();
        return;
      }
      const near = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, this.door.x, this.door.y - DOOR_TAP_LIFT);
      if (near < DOOR_TAP_RADIUS) this.useAction();
    });
    const stopAction = eventBus.on('action-pressed', () => this.useAction());
    const stopDig = eventBus.on('dig-confirmed', (plot) => this.startMove(plot, 'dig'));
    const stopFertilize = eventBus.on('fertilize-confirmed', (plot) => this.startMove(plot, 'fertilize'));
    const stopMoved = eventBus.on('player-moved', (point) => this.player.moveTo(point));
    const stopStarted = eventBus.on('game-started', (world) => {
      if (world.player) this.player.moveTo(world.player);
    });
    if (gameState.started && gameState.world.player) this.player.moveTo(gameState.world.player);

    this.applyViewport(gameState.viewport);
    const stopViewport = eventBus.on('viewport-changed', (viewport) => this.applyViewport(viewport));
    const stopLighting = eventBus.on('lighting-changed', (enabled) => this.applyLighting(enabled));
    const stopTreat = eventBus.on('gio-treat', (taste) => this.gio.eatTreat(taste));
    const stopArrange = eventBus.on('arrange-toggle', () => this.setArranging(!this.arranger.active));
    const stopArrangeCommand = eventBus.on('arrange-command', (command) => this.arrangeCommand(command));
    const stopRestart = eventBus.on('game-started', () => {
      this.placedApplied = false;
      this.visits?.destroy();
    });
    // นอนหรือเป็นลมข้ามเวลา แขกที่ยังเดินอยู่หายไป (ระบบกินจากถาดแทนถ้ายังไม่ได้มาถึงถาด)
    const stopRest = eventBus.on('rest-finished', () => this.visits?.destroy());
    const stopSummon = eventBus.on('monster-summon', () => {
      if (!gameState.started) return;
      const next = summonNow(gameState.world);
      if (next) gameState.setWorld(next);
      else eventBus.emit('notice', 'settings.test_monster_none');
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopCookLoop();
      stopAction();
      stopDig();
      stopFertilize();
      stopMoved();
      stopStarted();
      stopViewport();
      stopLighting();
      stopTreat();
      stopArrange();
      stopArrangeCommand();
      stopRestart();
      stopRest();
      stopSummon();
      this.visits?.destroy();
    });
  }

  override update(time: number, deltaMs: number): void {
    this.pond?.update(time);
    this.treeSway.update(time);
    const running = this.runKey.isDown || gameState.runHeld;
    const input = gameState.clockRunning ? this.readMoveInput() : STANDING_STILL;
    this.followPond();
    this.player.update(input, running);
    if (gameState.started) this.updateGioTrip();
    if (this.cookLoop && !this.player.isCooking) this.stopCookLoop();
    this.gio.update(deltaMs, this.player.feetX, this.player.feetY, !gameState.clockRunning);
    if (gameState.started) this.openReceiptWhenNear();
    if (gameState.started) this.followPlaced();
    if (gameState.started) this.syncDecor();
    if (gameState.started) {
      this.updateNearAmbience(time);
      this.ringChimeWhenNear(time);
    }
    if (gameState.started) {
      this.trayView?.sync(gameState.world.tray);
      this.visits?.update(deltaMs, time, { x: this.player.feetX, y: this.player.feetY });
    }
    if (this.arranger.active) this.arranger.draw(this.playerRect());
    else this.followPlayer();
    gameState.trackPlayer({ x: this.player.body.x, y: this.player.body.y });
    const camera = this.cameras.main;
    const screenScale = camera.zoom / window.devicePixelRatio;
    gameState.trackPlayerScreen({
      x: (this.player.feetX - camera.worldView.x) * screenScale,
      y: (this.player.feetY - PLAYER_HEAD_PX - camera.worldView.y) * screenScale,
    });
    if (this.pendingEat && !this.player.busy && !this.fainting) {
      this.playEat(this.pendingEat);
      this.pendingEat = null;
    }
    const clockScale = this.player.isCooking ? this.fastCookScale : 1;
    advanceClock(deltaMs * clockScale, this.door, (done) => this.playFaint(done));
    this.updateFarm();
    if (gameState.started) this.night.setFillStyle(this.night.fillColor, nightAlpha(gameState.world.hour));
    this.weatherFx.update(deltaMs, camera.worldView, gameState.started ? gameState.world.weather : null);
    this.drawFishingLine();
  }

  /**
   * กล้องตามตัวเอกโดยให้ขอบซ้ายบนของภาพตรงพิกเซลจอเต็มจุดเสมอ
   * หน้าต่างคอมกว้างเท่าไหร่ก็ได้ กล้องจึงเคยค้างครึ่งพิกเซลจอ แล้วการ์ดจอจริงเห็นรอยต่อแผ่นพื้นเป็นเส้นสว่างบาง ๆ
   */
  private followPlayer(): void {
    const camera = this.cameras.main;
    const { zoom } = camera;
    const viewWidth = camera.width / zoom;
    const viewHeight = camera.height / zoom;
    const snap = (want: number, view: number, world: number): number => {
      const max = Math.max(0, world - view);
      const left = Math.min(Math.max(want - view / 2, 0), max);
      return Math.min(Math.round(left * zoom), Math.floor(max * zoom)) / zoom;
    };
    const left = snap(this.player.feetX, viewWidth, this.worldSize.width);
    const top = snap(this.player.sprite.y, viewHeight, this.worldSize.height);
    // Phaser เลื่อนภาพตามจุดกลางกล้อง scroll จึงต่างจากขอบซ้ายบนครึ่งหนึ่งของส่วนที่ซูมออกไป
    camera.setScroll(left - (camera.width - viewWidth) / 2, top - (camera.height - viewHeight) / 2);
  }

  private placeObject(object: Phaser.Types.Tilemaps.TiledObject): void {
    const id = object.name;
    const entry = registry[id];
    if (entry?.type !== 'object' && entry?.type !== 'local' && entry?.type !== 'placeholder') {
      throw new Error(`map object ${id} is not in the registry`);
    }
    const x = object.x ?? 0;
    const y = object.y ?? 0;
    if (id === 'campfire') {
      this.campfire = new Campfire(this, x, y, createRng(Date.now()), () => gameState.viewport.zoom);
    }
    const flat = this.property<boolean>(object, 'flat') ?? false;
    const originY = entry.type === 'placeholder' ? 1 : footY(id) / entry.height;
    const image = this.add.image(x, y, id).setOrigin(0.5, originY).setDepth(flat ? DEPTH.flat : y);
    const seatAt = (feetX: number, feetY: number): GioSeat => {
      const top = feetY - originY * entry.height;
      return { x: feetX, top, bottom: top + entry.height, width: entry.width };
    };
    if (id === 'gio_seat') this.gioSeat = seatAt(x, y);
    if (id.startsWith('food_tray')) this.trayView = new TrayView(this, image);
    if (id === 'workbench') this.workbench = image;
    if (id === 'banana_clump') this.banana = image;
    // ของหน้าบ้านย้ายได้ในโหมดจัดวาง กองไฟพาแสงเรืองไปด้วย ตะกร้าพาจีโอไปด้วย
    this.arranger.register(id, image, this.movableBlockers.get(id) ?? null, flat, (feet) => {
      if (id === 'campfire') {
        this.campfire?.moveTo(feet.x, feet.y);
        if (this.glows.fire) Object.assign(this.glows.fire, { x: feet.x, y: feet.y - FIRE_GLOW_LIFT });
      }
      if (id === 'gio_seat') {
        this.gioSeat = seatAt(feet.x, feet.y);
        this.gio?.moveSeat(this.gioSeat);
      }
    });

    const submerged = this.property<number>(object, 'submerged');
    if (submerged) image.setCrop(0, 0, entry.width, Math.round(entry.height * submerged));
    if (id === 'fishing_dock' || submerged) {
      const corner = image.getTopLeft();
      this.pondObjects.push({
        key: id,
        left: Math.round(corner.x),
        top: Math.round(corner.y),
        width: entry.width,
        height: submerged ? Math.round(entry.height * submerged) : entry.height,
      });
    }
    // วัชพืช ตอไม้ หิน และต้นไม้ใหญ่ในรั้วที่ดินที่ยังไม่ซื้อ หายไปตอนซื้อ (ต้นไม้ใหญ่ผู้ใช้ตัดสิน 5 พ.ย. 2026)
    const clutterLand = /^(weed_|stump_seat|rock_small_|tree_big_)/.test(id) ? landAt(x / TILE_PX, y / TILE_PX) : null;
    if (clutterLand !== null) this.landClutter[clutterLand]?.push(image);

    const treeKind = /^tree_big_(\d)$/.exec(id)?.[1];
    if (treeKind !== undefined) {
      const sway = this.treeSway.add(this, image, Number(treeKind));
      if (clutterLand !== null) this.landClutter[clutterLand]?.push(sway);
    }

    const plot = this.property<number>(object, 'plot');
    if (plot !== undefined) {
      this.landSigns[plot] = { x, y };
      this.landClutter[plot]?.push(image);
      const price = this.add
        .text(x, y - PRICE_LIFT_PX, formatMoney(balance.land.prices[plot]!), {
          fontFamily: 'Mali',
          fontSize: `${PRICE_FONT_PX}px`,
          fontStyle: 'bold',
          color: '#5a3a22',
        })
        .setOrigin(0.5)
        .setDepth(y + 1);
      this.labels.push(price);
      this.landClutter[plot]?.push(price);
    }

    // ต้นไม้ทำให้เกิดร่มเงาบนพื้นรอบต้น · ต้นในที่ดินขายไม่มีร่มเงา เพราะหายไปตอนซื้อ และร่มเงาวาดครั้งเดียวตอนเปิดเกม
    if (id.startsWith('tree_big') && clutterLand === null) {
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

  /** ทุกท่าล็อกการเดิน กดปุ่มเดิมอีกครั้งเพื่อหยุด · ท่าทำสวนสั้นจึงทำจนจบเอง */
  private useAction(): void {
    if (this.arranger.active) return;
    if (this.fishing) {
      if (this.fishing.phase === 'bite') this.finishFishing(true);
      else if (this.fishing.phase !== 'reel') this.cancelFishing();
      return;
    }
    if (this.bath) {
      this.endBath();
      return;
    }
    // ทำอาหารสั้น ๆ ไม่กี่วินาที ทำจนเสร็จเอง ไม่มีปุ่มหยุด
    if (this.player.isCooking) return;
    const food = gameState.selectedFood;
    if (food) {
      this.eat(food);
      return;
    }
    const plot = this.targetPlot();
    if (this.landSignWins()) eventBus.emit('land-requested', this.nearLandSign()!);
    else if (plot !== null && this.farmActionAt(plot)) this.useFarm(plot);
    else if (this.campfireAction()) this.useCampfire();
    else if (this.trayInReach()) eventBus.emit('tray-open', undefined);
    else if (this.nearGio()) eventBus.emit('gio-talk', undefined);
    else if (this.workbenchInReach()) eventBus.emit('workbench-open', undefined);
    else if (this.bananaReady()) this.shakeBananaClump();
    else if (this.pondSpot()) {
      if (gameState.selectedTool === 'rod') this.startFishing();
      else this.startBath();
    } else if (this.nearDoor() && !this.player.busy) goToSleep(this.door);
  }

  /** กินอาหารที่เลือกในแถบอาหาร ของในกระเป๋าลด เติมเกจอิ่มทันที แล้วเล่นท่ากิน · แตะซ้ำระหว่างกินได้ ท่าเริ่มใหม่ */
  private eat(item: string): void {
    if (this.fainting) return;
    const next = eatItem(gameState.world, item);
    if (!next) return;
    gameState.setWorld(next);
    eventBus.emit('player-ate', item);
    // กำลังลุกจากกองไฟหรือทำสวนอยู่ ท่ากินเริ่มทันทีที่ท่านั้นจบ
    if (this.player.busy && !this.eatArt) this.pendingEat = item;
    else this.playEat(item);
  }

  /**
   * ท่ากินมือว่าง โค้ดวาดอาหารจริงให้ก้นกลางจานอยู่ที่จุดของเฟรมนั้น แล้ววาดปลายนิ้วทับ (docs/girl_eat_faint_art_2026-11-07.md)
   * อาหารใช้ภาพจิ๋วบนถาด ผักสดใช้ภาพผักจิ๋ว ไม่มีภาพก็กินมือเปล่า
   */
  private playEat(item: string): void {
    this.clearEatArt();
    const dishKey = this.eatDishKey(item);
    const dish = dishKey ? this.add.image(0, 0, dishKey).setOrigin(0, 0).setVisible(false) : null;
    const hands = this.add.image(0, 0, 'fx_eat_hands_south', 0).setOrigin(0, 0).setVisible(false);
    this.eatArt = { dish, hands };
    const entry = registry.anim_eat_south;
    const anchors = entry?.type === 'local' ? (entry.anchors ?? {}) : {};
    this.player.playOnce(
      'anim_eat_south',
      (frame) => {
        const anchor = anchors[String(frame)];
        const corner = this.player.frameCorner;
        const depth = this.player.sprite.depth;
        hands.setVisible(anchor !== undefined);
        dish?.setVisible(anchor !== undefined);
        if (!anchor) return;
        dish?.setPosition(corner.x + anchor[0] - Math.floor(dish.width / 2), corner.y + anchor[1] - dish.height + 1).setDepth(depth + 0.01);
        hands.setFrame(frame).setPosition(corner.x, corner.y).setDepth(depth + 0.02);
      },
      () => this.clearEatArt(),
    );
  }

  private eatDishKey(item: string): string | null {
    if (isDish(item)) {
      const { recipe } = parseDish(item);
      return foodArtKey(this, recipe, (recipes as Record<string, { icon?: string }>)[recipe]?.icon);
    }
    if (!isRawProduce(item)) return null;
    const key = `ing_mini_${baseItem(item)}`;
    return registerSlice(this.textures, key) ? key : null;
  }

  private clearEatArt(): void {
    this.eatArt?.dish?.destroy();
    this.eatArt?.hands.destroy();
    this.eatArt = null;
  }

  /**
   * เกจหมดแล้วล้มก่อน: หยุดทุกท่า หันหน้าลง เล่นท่าเป็นลมแล้วนอนค้าง นาฬิกาหยุดระหว่างนี้ แล้วม่านเป็นลมขึ้นตามเดิม
   * ฉากจีโอแบกกลับบ้านยังไม่มีภาพ
   */
  private playFaint(done: () => void): void {
    this.fainting = true;
    this.pendingEat = null;
    this.clearEatArt();
    if (this.fishing) this.cancelFishing();
    if (this.bath) this.endBath();
    if (this.player.isCooking) this.player.finishCooking();
    this.stopCookLoop();
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

  /** วันที่ฝากขาย จีโอเดินไปมุดโพรงตอนเที่ยงและโผล่ออกมาตอนหกโมงเย็น เดินให้เห็นเฉพาะตอนกล้องมองเห็นและเพิ่งถึงเวลา */
  private updateGioTrip(): void {
    const world = gameState.world;
    const away = isGioAway(world);
    const view = this.cameras.main.worldView;
    if (away && this.gio.present && !this.gio.leaving) {
      this.gio.leave(isTripLive(world, true) && view.contains(this.gio.feetX, this.gio.feetY));
    } else if (!away && this.gio.leaving) {
      this.gio.cancelLeave(this.player.feetX, this.player.feetY);
    } else if (!away && !this.gio.present) {
      const burrow = this.gio.burrowPoint;
      this.gio.comeBack(isTripLive(world, false) && burrow !== null && view.contains(burrow.x, burrow.y));
    }
  }

  /** จีโอกลับมาพร้อมเงิน ใบสรุปยอดเปิดเองครั้งแรกที่เดินมาใกล้ (ครั้งเดียวต่อรอบ) */
  private openReceiptWhenNear(): void {
    const report = gameState.world.gio.report;
    if (!report || this.receiptShownDay === report.day || !this.nearGio()) return;
    this.receiptShownDay = report.day;
    eventBus.emit('gio-talk', undefined);
  }

  /** ยืนใกล้ของในฉาก วัดจากเส้นเท้าของของนั้น slackX คือครึ่งความกว้างที่ยืนได้รอบฐาน */
  private nearObject(image: Phaser.GameObjects.Image | null, slackX: number): boolean {
    if (!image || !image.visible || !gameState.clockRunning || this.player.busy) return false;
    const dx = Math.max(0, Math.abs(this.player.feetX - image.x) - slackX);
    const dy = this.player.feetY - image.y;
    return Math.hypot(dx, dy) < balance.crafting.reachPx;
  }

  private workbenchInReach(): boolean {
    return this.nearObject(this.workbench, WORKBENCH_SLACK_PX);
  }

  /** กอกล้วยกว้าง 3 ต้น ยืนตรงไหนรอบฐานก็เขย่าได้ วันละครั้ง */
  private bananaReady(): boolean {
    return this.nearObject(this.banana, BANANA_SLACK_PX) && canShakeBanana(gameState.world);
  }

  /** เขย่ากอกล้วย ต้นโยกซ้ายขวาทีละพิกเซล ใบตองกับเชือกกาบกล้วยเด้งเหนือหัวทีละป้าย */
  private shakeBananaClump(): void {
    const next = shakeBanana(gameState.world);
    if (!next) {
      if (canShakeBanana(gameState.world)) eventBus.emit('player-says', 'bagFull');
      return;
    }
    gameState.setWorld(next);
    const clump = this.banana;
    if (clump) {
      const home = clump.x;
      this.tweens.addCounter({
        from: 0,
        to: BANANA_SHAKE_STEPS,
        duration: BANANA_SHAKE_MS,
        onUpdate: (tween) => clump.setX(home + (Math.floor(tween.getValue() ?? 0) % 2 === 0 ? 1 : -1)),
        onComplete: () => clump.setX(home),
      });
    }
    Object.entries(balance.crafting.banana).forEach(([item, count], order) => {
      const ingredient = item.startsWith('ing_') ? item.slice('ing_'.length) : null;
      const icon = ingredient ? `ing_icon_${ingredient}` : item;
      const name = t((ingredient ? `ingredient.${ingredient}.name` : `item.${item}.name`) as TextKey);
      this.time.delayedCall(order * SEED_PILL_DELAY_MS, () => {
        popPill(this, this.player.feetX, this.player.feetY - PLAYER_HEAD_PX, this.textures.exists(icon) ? icon : item, `+${count} ${name}`, gameState.viewport.zoom);
      });
    });
  }

  /** คุยกับจีโอได้เมื่อจีโออยู่บ้าน นั่งหรือเดินเล่นอยู่ (ไม่ใช่ระหว่างไปหรือกลับจากโพรง) และยืนใกล้ */
  private nearGio(): boolean {
    if (!this.gio.canTalk || !gameState.clockRunning || this.player.busy) return false;
    const distance = Phaser.Math.Distance.Between(this.player.feetX, this.player.feetY, this.gio.feetX, this.gio.feetY);
    return distance < balance.gioCare.talkReachPx;
  }

  /** จุดลงทุ่นถ้ายืนริมบ่อ ใช้ทั้งตกปลาและอาบน้ำ */
  private pondSpot(): CastSpot | null {
    if (!this.pond || !gameState.clockRunning || this.player.busy) return null;
    const { castMinPx, castMaxPx, minDepthPx, castThrow } = balance.fishing;
    const reach = { minPx: castMinPx, maxPx: castMaxPx, minDepth: minDepthPx };
    return this.pond.castSpot(this.player.feetX, this.player.feetY, reach, this.player.facing4, castThrow);
  }

  /** ระหว่างตกปลาหรืออาบน้ำเดินไม่ได้ เปิดหน้าต่างเมื่อไหร่เก็บเบ็ดโดยไม่เสียเวลาและเหยื่อ · อาบน้ำครบเวลาหรือกดหยุดได้สะอาดตามเวลาที่อาบ */
  private followPond(): void {
    if (this.fishing && this.fishing.phase !== 'reel' && !gameState.clockRunning) this.cancelFishing();
    if (!this.bath) return;
    const done = gameState.world.hour - this.bath.startHour >= balance.bath.minutes / MINUTES_PER_HOUR;
    if (done || !gameState.clockRunning) this.endBath();
  }

  /** เหยื่อที่เลือกในแถบเหนือช่องคันเบ็ด ถ้าหมดแล้วใช้เหยื่อแรกที่ยังมี */
  private pickBait(): string | null {
    return chosenBait(gameState.world.bag, gameState.selectedBait);
  }

  private startFishing(): void {
    const spot = this.pondSpot();
    if (!spot || this.fishing) return;
    const bait = this.pickBait();
    if (!bait) {
      eventBus.emit('player-says', 'noBait');
      return;
    }
    const trip: FishingTrip = { phase: 'cast', bait, spot, castHour: gameState.world.hour, timer: null };
    this.fishing = trip;
    const castFrame = (sheet: string): number => audioSettings.castFrames[sheet as keyof typeof audioSettings.castFrames];
    this.player.startPose(
      spot.facing,
      'anim_fish',
      () => this.landBobber(trip),
      (frame, sheet) => {
        if (frame === castFrame(sheet)) sound.play('fish_cast');
      },
    );
  }

  /** ตกปลาอัตโนมัติรอนานกว่าตกเอง 1.5 เท่า */
  private landBobber(trip: FishingTrip): void {
    if (this.fishing !== trip) return;
    const { waitMinMs, waitMaxMs, nibbleRepeatsMin, nibbleRepeatsMax, nibbleGapMs, biteLeadMs, autoWaitMultiplier } = balance.fishing;
    splash(this, trip.spot.x, trip.spot.y);
    sound.play('fish_plop');
    this.rig.show(trip.spot);
    trip.phase = 'wait';
    const wait = this.fishRng.between(waitMinMs, waitMaxMs) * (gameState.autoFish ? autoWaitMultiplier : 1);
    trip.timer = this.time.delayedCall(wait, () => {
      if (this.fishing !== trip) return;
      trip.phase = 'nibble';
      const times = nibbleRepeatsMin + Math.floor(this.fishRng.next() * (nibbleRepeatsMax - nibbleRepeatsMin + 1));
      this.rig.nibble(times, nibbleGapMs, biteLeadMs, () => this.startBite(trip), () => sound.play('fish_nibble'));
    });
  }

  /** ขึ้น "!" ให้แตะภายในราว 1 วินาที ตั้งค่าตกปลาอัตโนมัติไว้จะดึงให้เอง แต่ติดแค่ราว 65% */
  private startBite(trip: FishingTrip): void {
    if (this.fishing !== trip) return;
    const { biteWindowMs, autoTapMs } = balance.fishing;
    trip.phase = 'bite';
    this.rig.bite();
    this.rig.showMark(this.player.feetX, this.player.feetY);
    sound.play('fish_alert');
    // ตกปลาอัตโนมัติตั้งนาฬิกาเดียว เดิมมีสองนาฬิกาแข่งกัน ถ้าเครื่องกระตุก นาฬิกา "ไม่ทัน" อาจดังก่อนจนพลาดทุกครั้ง
    trip.timer = gameState.autoFish
      ? this.time.delayedCall(autoTapMs, () => this.finishFishing(autoHooks(this.fishRng)))
      : this.time.delayedCall(biteWindowMs, () => this.finishFishing(false));
  }

  /** ดึงทันได้ของและเสียเหยื่อ ไม่ทันปลาหลุดแต่เหยื่อยังอยู่ ทั้งสองแบบใช้เวลาครบ 30 นาที */
  private finishFishing(hooked: boolean): void {
    const trip = this.fishing;
    if (!trip || trip.phase !== 'bite') return;
    trip.timer?.remove();
    trip.phase = 'reel';
    const world = gameState.world;
    const caught = hooked ? rollCatch(world, trip.bait, trip.castHour, this.fishRng) : null;
    const firstTime = caught?.kind === 'fish' && !world.fishing.caught[caught.fish];
    const result = finishCast(world, trip.castHour, trip.bait, caught);
    gameState.setWorld(result.world);
    sound.play('fish_reel');
    this.rig.reel(() => {
      if (this.fishing !== trip) return;
      this.fishing = null;
      this.player.endPose();
      if (!caught) {
        sound.play('fish_escape');
        eventBus.emit('player-says', 'fishEscaped');
      } else if (!result.stored) eventBus.emit('player-says', 'bagFull');
      else {
        sound.play('fish_catch');
        this.showCatch(trip.spot, caught, firstTime);
      }
      if (caught && !result.stored) return;
      if (gameState.autoFish && gameState.autoRebait) this.rebait(trip.bait);
    });
  }

  /** เหวี่ยงเบ็ดใหม่ด้วยเหยื่อเดิม ถ้าเหยื่อหมดหยุดแล้วบอก */
  private rebait(bait: string): void {
    const item = baits[bait]?.item;
    if (!item || countOf(gameState.world.bag, item) === 0) {
      eventBus.emit('player-says', 'baitRanOut');
      return;
    }
    this.time.delayedCall(balance.fishing.rebaitDelayMs, () => {
      if (this.fishing || this.bath || !gameState.autoFish || !gameState.autoRebait) return;
      if (gameState.selectedTool !== 'rod' || !this.pondSpot()) return;
      gameState.setSelectedBait(bait);
      this.startFishing();
    });
  }

  private cancelFishing(): void {
    this.fishing?.timer?.remove();
    this.fishing = null;
    this.rig.hide();
    this.player.endPose();
  }

  private showCatch(spot: CastSpot, caught: Catch, firstTime: boolean): void {
    const item = catchItem(caught);
    const name = caught.kind === 'fish' ? t(`fish.${caught.fish}.name` as TextKey) : t(`item.${item}.name` as TextKey);
    const label = firstTime ? `+1 ${name} ${t('fishing.new')}` : `+1 ${name}`;
    const handY = this.player.feetY - PLAYER_HEAD_PX / 2;
    harvestArc(this, item, spot.x, spot.y, this.player.feetX, handY, () => {
      popPill(this, this.player.feetX, this.player.feetY - PLAYER_HEAD_PX, item, label, gameState.viewport.zoom);
    });
  }

  /** สายเบ็ดออกจากปลายคันของเฟรมที่กำลังแสดง */
  private drawFishingLine(): void {
    if (!this.fishing || !this.player.isPosing) return;
    const facing = this.fishing.spot.facing;
    const entry = registry[`anim_fish_${facing === 'west' ? 'east' : facing}`];
    const tip = entry?.type === 'local' ? entry.anchors?.[String(this.player.poseFrame)] : undefined;
    if (!tip) return;
    const corner = this.player.frameCorner;
    this.rig.drawLine({ x: corner.x + (this.player.flipped ? FRAME_LAST_PX - tip[0] : tip[0]), y: corner.y + tip[1] }, this.player.feetY);
  }

  /** เสียงเท้าตอนเท้าแตะพื้นในท่าเดิน (เฟรมใน audio.json) วิ่งแล้วท่าเร็วขึ้น เสียงจึงถี่ขึ้นเอง */
  private footstep(index: number): void {
    const { frames, keys, dirtKeys } = audioSettings.steps;
    if (!frames.includes(index)) return;
    // บนลานดินและแปลงผักเป็นเสียงเท้าบนดิน ที่อื่นเป็นหญ้า (แผ่นครึ่งหญ้าครึ่งดินดูพิกเซลตรงจุดเท้า)
    const surface = this.surfaces.at(this.player.feetX, this.player.feetY);
    const list = surface === 'dirt' ? dirtKeys : keys;
    sound.play(list[this.stepTakes[surface] % list.length]!);
    this.stepTakes[surface] += 1;
  }

  /** เสียงออกแรงของตัวเอกตอนจอบกระทบดิน (พรวนและขุดทิ้ง) ราว 1 ใน 3 และไม่ห่างกันน้อยกว่า tillVoiceGapMs */
  private tillVoice(): void {
    const now = this.time.now;
    if (now - this.lastTillVoiceAt < audioSettings.tillVoiceGapMs || this.voiceRng.next() >= audioSettings.tillVoiceChance) return;
    this.lastTillVoiceAt = now;
    sound.say(audioSettings.tillVoice);
  }

  /** เสียงบ่อน้ำดังเต็มเมื่อยืนริมบ่อ เสียงกองไฟดังเต็มเมื่อยืนที่จุดทำอาหาร ค่อย ๆ เงียบเมื่อเดินห่าง (ระยะใน audio.json) */
  private updateNearAmbience(time: number): void {
    if (!gameState.started || time < this.nearAmbienceAt) return;
    this.nearAmbienceAt = time + NEAR_AMBIENCE_EVERY_MS;
    const { pond, campfire } = audioSettings.nearAmbience;
    const level = (distance: number, rule: { nearTiles: number; farTiles: number }): number => {
      const span = (rule.farTiles - rule.nearTiles) * TILE_PX;
      const raw = span > 0 ? (rule.farTiles * TILE_PX - distance) / span : distance <= rule.farTiles * TILE_PX ? 1 : 0;
      return Math.round(Math.min(1, Math.max(0, raw)) * NEAR_AMBIENCE_STEPS) / NEAR_AMBIENCE_STEPS;
    };
    const { feetX, feetY } = this.player;
    const levels = {
      [pond.key]: this.pond ? level(this.pond.distanceToWater(feetX, feetY), pond) : 0,
      [campfire.key]: this.campfire ? level(Phaser.Math.Distance.Between(feetX, feetY, this.campfire.x, this.campfire.y), campfire) : 0,
    };
    const shown = JSON.stringify(levels);
    if (shown === this.nearAmbienceShown) return;
    this.nearAmbienceShown = shown;
    eventBus.emit('ambience-near', levels);
  }

  /** กระดิ่งลมแฝดดังสองโน้ตเบา ๆ เมื่อเดินเข้าใกล้ ไม่ถี่กว่า everyMs */
  private ringChimeWhenNear(time: number): void {
    if (!this.chime) return;
    const { key, nearTiles, volume, everyMs } = audioSettings.twinChime;
    const near = Phaser.Math.Distance.Between(this.player.feetX, this.player.feetY, this.chime.x, this.chime.y) <= nearTiles * TILE_PX;
    if (near && !this.chimeNear && time - this.chimeRungAt >= everyMs) {
      sound.play(key, { volume });
      this.chimeRungAt = time;
    }
    this.chimeNear = near;
  }

  /** อาบน้ำที่บ่อหันไหนก็ใช้ท่าทิศใต้ มีฟองกับประกายลอยรอบตัว */
  private startBath(): void {
    if (!this.pondSpot() || this.bath || this.fishing) return;
    this.player.startPose('south', 'anim_wash');
    // เสียงตามภาพ: เฟรมมือวักน้ำมีเสียงวัก เฟรมน้ำโดนหน้ามีเสียงกระเซ็น 1 → 2 → 3 → 4 วนไปทุกรอบ
    const { scoopFrame, splashFrame, splashes } = audioSettings.bath;
    let splash = 0;
    const onFrame = (animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void => {
      if (!animation.key.startsWith('anim_wash_')) return;
      const index = Number(frame.textureFrame);
      if (index === scoopFrame) sound.play('bath_scoop');
      if (index === splashFrame) {
        sound.play(splashes[splash % splashes.length]!);
        splash += 1;
      }
    };
    this.player.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
    const stopSounds = (): void => {
      this.player.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
    };
    const effect = this.time.addEvent({
      delay: BATH_BUBBLE_MS,
      loop: true,
      callback: () => {
        const x = this.player.feetX + this.fishRng.between(-BATH_SPREAD_PX, BATH_SPREAD_PX);
        const y = this.player.feetY - this.fishRng.between(8, PLAYER_HEAD_PX - 16);
        if (this.fishRng.next() < BATH_SPARKLE_SHARE) sparkle(this, x, y);
        else bathBubble(this, x, y);
      },
    });
    this.bath = { startHour: gameState.world.hour, effect, stopSounds };
  }

  private endBath(): void {
    if (!this.bath) return;
    const minutes = (gameState.world.hour - this.bath.startHour) * MINUTES_PER_HOUR;
    this.bath.effect.remove();
    this.bath.stopSounds();
    this.bath = null;
    sound.play('bath_sparkle');
    gameState.setWorld(finishBath(gameState.world, minutes));
    this.player.endPose();
  }

  /**
   * ทำครั้งเดียว เวลาเดียว (zone1 food update 2): เริ่มทำแล้วตัวเอกเล่นท่าของวิธีนั้น นาฬิกาเดินเร็ว เวลาของแรงก์ผ่านไปในไม่กี่วินาที
   * สุกแล้วลุกขึ้น อาหารทุกจานเด้งออกเข้ากระเป๋า กระเป๋าเต็มอาหารรออยู่ที่กองไฟ เก็บทีหลังได้ · อาหารที่ค้างจากเซฟเก่าสุกตามเวลาปกติ
   */
  private followCooking(): void {
    const { slot } = gameState.world.cooking;
    const cooking = slot !== null && !isCooked(slot);
    if (cooking === this.cookingShown) return;
    const started = cooking && this.cookingShown === false;
    const finished = !cooking && this.cookingShown === true && isCooked(slot);
    const served = finished && this.player.isCooking;
    this.cookingShown = cooking;
    if (started && slot && this.campfire && this.campfireInReach()) {
      const pose = cookMethodOf(slot.recipe)?.pose;
      const normalMs = (slot.minutesLeft / MINUTES_PER_HOUR) * balance.time.realSecondsPerGameHour * MS_PER_SECOND;
      this.fastCookScale = Math.max(1, normalMs / balance.cooking.fastCookMs);
      this.player.startCooking({ x: this.campfire.x, y: this.campfire.y }, pose ?? '', {
        onStart: () => sound.play('cook_start'),
        onLoop: () => {
          this.stopCookLoop();
          this.cookLoop = sound.play('cook_loop', { loop: true });
        },
      });
    }
    if (!cooking) {
      this.player.finishCooking();
      this.fastCookScale = 1;
    }
    if (finished) {
      this.stopCookLoop();
      sound.play('cook_done');
    }
    if (served) this.serveDishes();
  }

  /** อาหารทุกจานเข้ากระเป๋า เด้งป้ายพร้อมดาวเหนือหัวตัวเอก แล้วเปิดหน้าแต่งจาน */
  private serveDishes(): void {
    const { slot } = gameState.world.cooking;
    if (!slot || !this.campfire) return;
    const next = collectDish(gameState.world);
    if (!next) {
      eventBus.emit('player-says', 'bagFull');
      return;
    }
    gameState.setWorld(next);
    const item = dishItem(slot.recipe, slot.stars);
    // ภาพอาหาร 48 พิกเซลเด้งเหนือหัวตัวเอกแบบเดียวกับตอนเก็บผัก ไม่บังหน้า (ภาพในกระเป๋าไม่ได้โหลดเข้าฉาก)
    const icon = cookRecipes[slot.recipe]?.icon ?? '';
    const name = t(`dish.${slot.recipe}.name` as TextKey);
    const key = this.textures.exists(icon) ? icon : item;
    // ป้ายสูงตามภาพอาหาร จึงยกขึ้นอีกครึ่งหนึ่งของส่วนที่สูงกว่าป้ายผัก ขอบล่างจะได้อยู่เหนือหัว
    const extra = Math.max(0, Math.ceil((this.textures.getFrame(key).height - DISH_POP_BASE_PX) / 2));
    popPill(this, this.player.feetX, this.player.feetY - PLAYER_HEAD_PX - extra, key, `+${slot.count} ${name}`, gameState.viewport.zoom, `star_badge_${Math.min(3, slot.stars)}`);
    // เห็นป้ายเด้งก่อน แล้วจึงเปิดหน้าแต่งจาน (แต่งครั้งเดียวได้ทุกจาน)
    this.time.delayedCall(balance.toppings.openDelayMs, () => eventBus.emit('decorate-open', { item, count: slot.count }));
  }

  /** ลุกจากกองไฟหรืออาหารสุกแล้ว เสียงผัดค่อย ๆ หยุด */
  private stopCookLoop(): void {
    this.cookLoop?.stop(audioSettings.cookLoopFadeMs);
    this.cookLoop = null;
  }

  private campfireInReach(): boolean {
    if (!this.campfire || !gameState.clockRunning) return false;
    return Phaser.Math.Distance.Between(this.player.feetX, this.player.feetY, this.campfire.x, this.campfire.y) < balance.cooking.reachPx;
  }

  /** ยืนใกล้ถาดอาหารจึงวางอาหารได้ */
  private trayInReach(): boolean {
    const tray = this.trayView?.image;
    if (!tray || !gameState.clockRunning || this.player.busy) return false;
    return Phaser.Math.Distance.Between(this.player.feetX, this.player.feetY, tray.x, tray.y) < balance.tray.reachPx;
  }

  /** ตำแหน่งบนแผนที่เป็นพิกเซล CSS บนจอ ใช้วางฟองคำพูดและป้ายชื่อ */
  private toScreen(x: number, y: number): { x: number; y: number } {
    const camera = this.cameras.main;
    const scale = camera.zoom / window.devicePixelRatio;
    return { x: (x - camera.worldView.x) * scale, y: (y - camera.worldView.y) * scale };
  }

  private campfireAction(): TextKey | null {
    if (!this.campfireInReach()) return null;
    const { slot } = gameState.world.cooking;
    if (!slot) return 'action.cook';
    return isCooked(slot) ? 'action.collect' : null;
  }

  /** เก็บได้เมื่อสุกแล้ว กระเป๋าเต็มอาหารยังรออยู่ที่กองไฟ เก็บแล้วเปิดหน้าแต่งจาน */
  private useCampfire(): void {
    const { slot } = gameState.world.cooking;
    if (!slot) {
      eventBus.emit('cook-open', undefined);
      return;
    }
    const next = collectDish(gameState.world);
    if (!next) {
      eventBus.emit('player-says', 'bagFull');
      return;
    }
    gameState.setWorld(next);
    if (slot.recipe === MYSTERY) eventBus.emit('player-says', 'mysteryFood');
    else eventBus.emit('decorate-open', { item: dishItem(slot.recipe, slot.stars), count: slot.count });
  }

  private createPlots(ground: Phaser.Tilemaps.TilemapLayer): void {
    const { cols, rows } = balance.farm;
    this.plots = [];
    for (let index = 0; index < cols * rows; index += 1) this.addPlot(ground, index);
    this.plotMarker = this.add.sprite(0, 0, 'plot_cursor').setDepth(DEPTH.plotMarker).setVisible(false).play('plot_cursor_loop');
  }

  private addPlot(ground: Phaser.Tilemaps.TilemapLayer, index: number): void {
    const cell = plotCell(index);
    const tile = cell ? ground.getTileAt(cell.col, cell.row) : null;
    if (!tile) throw new Error(`map has no tile for plot ${index}`);
    this.plots[index] = new Plot(this, tile, DEPTH.flat);
  }

  /** ตัวเอกกินพื้นที่เท่าตัวชนของเธอ ห้ามวางของทับ */
  private playerRect(): ArrangeRect {
    const body = this.player.body.body as Phaser.Physics.Arcade.Body;
    return { x: body.x, y: body.y, width: body.width, height: body.height };
  }

  /** ช่องนี้ชนตัวกันเดินอื่นไหม ไม่นับตัวกันเดินของชิ้นที่กำลังย้าย ประตูบ้านต้องว่างเสมอ */
  private blockedFor(rect: ArrangeRect, ignore: Phaser.GameObjects.Zone | null): boolean {
    if (rect.x <= this.door.x && this.door.x < rect.x + rect.width && rect.y <= this.door.y && this.door.y < rect.y + rect.height) return true;
    return this.obstacles.getChildren().some((child) => {
      if (child === ignore) return false;
      const zone = child as Phaser.GameObjects.Zone;
      const left = zone.x - zone.width / 2;
      const top = zone.y - zone.height / 2;
      return left < rect.x + rect.width && rect.x < left + zone.width && top < rect.y + rect.height && rect.y < top + zone.height;
    });
  }

  /** ของตกแต่งรางวัลที่ได้แล้วแต่ยังไม่มีในฉาก วางที่ตำแหน่งในเซฟ หรือช่องว่างใกล้ช่องที่อยากวางที่สุด */
  private syncDecor(): void {
    if (this.chime || !ownedDecor(gameState.world).includes(CHIME)) return;
    const rule = balance.decor[CHIME];
    if (!this.anims.exists(CHIME_SWAY)) {
      this.anims.create({ key: CHIME_SWAY, frames: this.anims.generateFrameNumbers(CHIME_SHEET, { start: 0, end: CHIME_FRAMES - 1 }), frameRate: 1000 / rule.swayMs, repeat: -1 });
    }
    const entry = registry[CHIME_SHEET];
    const frameHeight = entry?.type === 'local' ? (entry.frame_height ?? entry.height) : 1;
    const sprite = this.add.sprite(0, 0, CHIME_SHEET, 0).setOrigin(0.5, footY(CHIME_SHEET) / frameHeight).play(CHIME_SWAY);
    this.chime = sprite;
    this.arranger.register(CHIME, sprite as unknown as Phaser.GameObjects.Image, null, false, () => undefined);
    const saved = gameState.world.placed[CHIME];
    const tile = TILE_PX;
    const feet = saved ?? this.arranger.findFree(CHIME, this.playerRect(), { x: (rule.prefer.x + 0.5) * tile, y: (rule.prefer.y + 1) * tile });
    if (!feet) return;
    this.arranger.apply(CHIME, feet);
    if (!saved) gameState.setWorld({ ...gameState.world, placed: { ...gameState.world.placed, [CHIME]: feet } });
  }

  /** ตำแหน่งที่เคยย้ายไว้ในเซฟ ใช้ครั้งเดียวต่อการเริ่มเกม */
  private followPlaced(): void {
    if (this.placedApplied) return;
    this.placedApplied = true;
    for (const [id, feet] of Object.entries(gameState.world.placed)) this.arranger.apply(id, feet);
  }

  private reportArrange(): void {
    eventBus.emit('arrange-changed', this.arranger.state(this.playerRect()));
  }

  /** เข้าโหมดจัดวาง: นาฬิกาหยุด กล้องเลื่อนไปที่ลานหน้าบ้าน · ออก: กลับไปตามตัวเอก */
  private setArranging(on: boolean): void {
    if (on === this.arranger.active) return;
    if (on) {
      if (!gameState.started || this.player.busy || this.fishing || this.bath) return;
      this.arranger.enter();
      gameState.setWindowOpen(ARRANGE_WINDOW, true);
      const center = this.arranger.zoneCenter();
      if (center) this.cameras.main.centerOn(center.x, center.y);
    } else {
      this.arranger.exit();
      gameState.setWindowOpen(ARRANGE_WINDOW, false);
    }
    this.reportArrange();
  }

  private arrangeCommand(command: 'place' | 'cancel' | 'done'): void {
    if (!this.arranger.active) return;
    if (command === 'done') {
      this.setArranging(false);
      return;
    }
    if (command === 'cancel') this.arranger.cancel();
    else {
      const placed = this.arranger.place(this.playerRect());
      if (placed) gameState.setWorld({ ...gameState.world, placed: { ...gameState.world.placed, [placed.id]: placed.feet } });
    }
    this.reportArrange();
  }

  /** ที่ดินที่ซื้อแล้ว: ชั้นแปลงผักแสดง ของรกในรั้วหาย เดินเข้าได้ และมีแปลงผักเพิ่มตามเซฟ */
  private followLand(): void {
    const owned = gameState.world.land.owned;
    if (owned !== this.landShown) {
      this.landShown = owned;
      this.landLayers.forEach((layer, index) => layer.setVisible(index === owned - 1));
      for (let land = 0; land < owned; land += 1) {
        for (const piece of this.landClutter[land] ?? []) piece.destroy();
        this.landClutter[land] = [];
      }
    }
    for (let index = this.plots.length; index < gameState.world.farm.plots.length; index += 1) this.addPlot(this.ground, index);
  }

  /** ยืนใกล้ป้ายของที่ดินแปลงถัดไปจึงกดซื้อได้ ซื้อตามลำดับ */
  private nearLandSign(): number | null {
    if (!gameState.clockRunning || this.player.busy) return null;
    const land = nextLand(gameState.world);
    const sign = land === null ? undefined : this.landSigns[land];
    if (land === null || !sign) return null;
    return Phaser.Math.Distance.Between(this.player.feetX, this.player.feetY, sign.x, sign.y) < balance.interact.reachPx ? land : null;
  }

  /** ป้ายขายที่อยู่เหนือแปลงผักพอดี ถ้ายืนใกล้ป้ายมากกว่าแปลง ปุ่มกระทำเป็นซื้อที่ดิน */
  private landSignWins(): boolean {
    const land = this.nearLandSign();
    if (land === null) return false;
    const sign = this.landSigns[land]!;
    const plot = this.targetPlot();
    const toSign = Phaser.Math.Distance.Between(this.player.feetX, this.player.feetY, sign.x, sign.y);
    return plot === null || !this.farmActionAt(plot) || toSign < this.distanceToPlot(plot);
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
    this.followLand();
    const { plots } = gameState.world.farm;
    let grown = false;
    this.plots.forEach((plot, index) => {
      if (plot.sync(plots[index]!)) grown = true;
      plot.tick(this.time.now);
    });
    // พืชพร้อมเก็บพร้อมกันหลายแปลง (เช่นเช้าหลังนอน) ดังครั้งเดียว และไม่เกินครั้งละ 2 วินาที
    if (grown && this.time.now - this.grownSoundAt >= audioSettings.farmGrownGapMs) {
      this.grownSoundAt = this.time.now;
      sound.play('farm_grown');
    }
    const target = gameState.clockRunning && !this.fishing && !this.bath && !this.player.isCooking ? this.targetPlot() : null;
    const action = target !== null ? this.farmActionAt(target) : null;
    if (target !== null && action) {
      const plot = this.plots[target]!;
      this.plotMarker.setPosition(plot.centerX, plot.centerY).setVisible(true);
    } else {
      this.plotMarker.setVisible(false);
    }
    this.campfire?.sync(gameState.world.cooking.slot, this.time.now);
    this.followCooking();
    gameState.setAction(this.contextAction(action));
  }

  /** ปุ่มกระทำปุ่มเดียว ไอคอนตามจุดที่ยืนและของที่ถือ ระหว่างทำท่าเป็นปุ่มหยุดของท่านั้น */
  private contextAction(farm: FarmAction | null): ContextAction | null {
    if (this.fishing) {
      if (this.fishing.phase === 'reel') return null;
      return { icon: 'fish', label: this.fishing.phase === 'bite' ? 'action.reel' : 'action.stop' };
    }
    if (this.bath) return { icon: 'bath', label: 'action.stop' };
    if (this.player.isCooking) return null;
    // แถบอาหาร: เลือกอาหารแล้วปุ่มกระทำเป็น "กิน" (ผู้ใช้เลือกแบบ B 7 พ.ย. 2026)
    if (gameState.selectedFood) return { icon: 'eat', label: 'action.eat' };
    if (this.landSignWins()) return { icon: 'buy', label: 'action.buy_land' };
    if (farm) return { icon: FARM_ICON[farm], label: ACTION_LABEL[farm] };
    const fire = this.campfireAction();
    if (fire) return { icon: 'cook', label: fire };
    if (this.trayInReach()) return { icon: 'tray', label: 'action.tray' };
    if (this.nearGio()) return { icon: 'talk', label: 'action.talk' };
    // ไอคอนโต๊ะช่างกับเขย่าต้นกล้วยยังไม่มีภาพ ใช้กล่องสีแทนตามกฎทะเบียน
    if (this.workbenchInReach()) return { icon: 'craft', label: 'action.craft' };
    if (this.bananaReady()) return { icon: 'shake', label: 'action.shake' };
    if (this.pondSpot()) return gameState.selectedTool === 'rod' ? { icon: 'fish', label: 'action.fish' } : { icon: 'bath', label: 'action.bath' };
    return this.nearDoor() ? { icon: 'sleep', label: 'action.sleep' } : null;
  }

  /** ตอนกำลังทำท่าอยู่ แตะใหม่จะจำไว้ทำต่อ */
  private useFarm(index: number): void {
    if (this.player.busy) {
      this.queuedPlot = index;
      return;
    }
    const action = this.farmActionAt(index);
    if (!action) return;
    const state = gameState.world.farm.plots[index]!;
    if (action === 'dig' && !isWithered(state)) {
      eventBus.emit('dig-requested', { plot: index, crop: state.crop!.id });
      return;
    }
    // ปุ๋ยระดับสูงกว่าแทนของเดิม ถามก่อน
    if (action === 'fertilize' && state.fertilizer > 0) {
      eventBus.emit('fertilize-requested', { plot: index, item: gameState.selectedSeed! });
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
    const move: GardenMove = action === 'dig' ? 'till' : action === 'fertilize' ? 'plant' : action;
    this.player.playGardenMove(
      move,
      { x: plot.centerX, y: plot.centerY },
      (frame) => {
        this.playMoveEffect(move, frame, plot);
        if (frame === audioSettings.farmFrames[move]) {
          sound.play(`farm_${move}`);
          if (move === 'till') this.tillVoice();
        }
      },
      () => {
        const before = gameState.world.farm.plots[index]!;
        const crop = before.crop?.id;
        const seedsBefore = crop ? countOf(gameState.world.bag, seedItem(crop)) : 0;
        const starCounts = (bag: typeof gameState.world.bag): number[] => [1, 2, 3].map((stars) => (crop ? countOf(bag, withStars(produceItem(crop), stars)) : 0));
        const producedBefore = starCounts(gameState.world.bag);
        const next = applyFarmAction(gameState.world, index, action, seed, this.farmRng);
        if (next) {
          gameState.setWorld(next);
          plot.sync(next.farm.plots[index]!);
          if (action === 'plant') plot.pop();
          if (action === 'water' && crop) {
            plot.wake();
            sparkle(this, plot.centerX, plot.centerY - TILE_MIDDLE);
          }
          if (action === 'harvest' && crop) {
            const gained = starCounts(next.bag).map((count, at) => count - producedBefore[at]!);
            this.showHarvest(plot, crop, gained, countOf(next.bag, seedItem(crop)) > seedsBefore);
          }
        }
        const queued = this.queuedPlot;
        this.queuedPlot = null;
        if (queued !== null) this.useFarm(queued);
      },
    );
  }

  private playMoveEffect(move: GardenMove, frame: number, plot: Plot): void {
    if (move === 'plant' && frame >= 4 && frame <= 7) dirtPuff(this, plot.centerX, plot.centerY);
    // ภาพท่าพรวนมีเศษดินในเฟรมแล้ว จึงเติมแค่นิดเดียวตอนจอบกระทบดิน
    if (move === 'till' && frame === TILL_HIT_FRAME) dirtPuff(this, plot.centerX, plot.centerY, TILL_DIRT_PIECES);
    if (move === 'water' && frame === WATER_SPLASH_FRAME) splash(this, plot.centerX, plot.centerY);
  }

  /** ป้ายละดาว (ได้ผัก 2–3 ดาวขึ้นป้ายแยกพร้อมป้ายดาว) ได้เมล็ดแถมขึ้นป้ายสุดท้าย · gained คือจำนวนที่ได้ของ 1 / 2 / 3 ดาว */
  private showHarvest(plot: Plot, crop: string, gained: number[], gotSeed: boolean): void {
    const handY = this.player.feetY - PLAYER_HEAD_PX / 2;
    harvestArc(this, `icon_${crop}`, plot.centerX, plot.centerY, this.player.feetX, handY, () => {
      const name = t(`crop.${crop}.name` as TextKey);
      const pills = gained.flatMap((count, at) => (count > 0 ? [{ count, stars: at + 1 }] : []));
      pills.forEach(({ count, stars }, order) => {
        this.time.delayedCall(order * SEED_PILL_DELAY_MS, () => {
          popPill(this, this.player.feetX, this.player.feetY - PLAYER_HEAD_PX, `icon_${crop}`, `+${count} ${name}`, gameState.viewport.zoom, `star_badge_${stars}`);
        });
      });
      if (!gotSeed) return;
      this.time.delayedCall(Math.max(1, pills.length) * SEED_PILL_DELAY_MS, () => {
        popPill(this, this.player.feetX, this.player.feetY - PLAYER_HEAD_PX, `icon_${crop}`, `+1 ${t('bag.seed_prefix')}${name}`, gameState.viewport.zoom);
      });
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
    this.pond?.setEffects(enabled);
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
    if (this.player) this.followPlayer();
    // ชื่อบนกล่องแทนภาพวาดที่ความละเอียดจริงของจอ จึงไม่แตกเมื่อขยาย
    for (const label of this.labels) label.setResolution(viewport.zoom);
  }
}
