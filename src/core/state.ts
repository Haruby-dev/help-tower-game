import { eventBus } from './events';
import type { TextKey } from './i18n';
import type { Vector } from './movement';
import type { Viewport } from './viewport';

export interface Point {
  x: number;
  y: number;
}

export interface GaugeValues {
  fullness: number;
  happiness: number;
  cleanliness: number;
  homesickness: number;
}

export type Currency = 'coins' | 'stars';

export interface WalletEntry {
  day: number;
  hour: number;
  currency: Currency;
  amount: number;
  /** key ใน th.json */
  label: string;
  category: string;
}

export interface Wallet {
  coins: number;
  stars: number;
  log: WalletEntry[];
  daily: { day: number; coins: number; stars: number }[];
}

export const emptyWallet = (): Wallet => ({ coins: 0, stars: 0, log: [], daily: [] });

/** ของแต่งเป็นความสวยล้วน เก็บธงไว้ก่อน ระบบร้านค้าและหีบมาทีหลัง */
export interface Cosmetics {
  equipped: { charm: string | null; wallpaper: string; canSkin: string };
  owned: { charms: string[]; wallpapers: string[]; canSkins: string[]; clips: string[] };
}

export const defaultCosmetics = (): Cosmetics => ({
  equipped: { charm: null, wallpaper: 'wallpaper_sky_cats', canSkin: 'can_blue' },
  owned: { charms: [], wallpapers: ['wallpaper_sky_cats'], canSkins: ['can_blue'], clips: [] },
});

export interface CropState {
  id: string;
  daysGrown: number;
  harvests: number;
}

export interface PlotState {
  tilled: boolean;
  /** รดน้ำแล้ววันนี้ แห้งตอนเช้าวันถัดไป */
  watered: boolean;
  crop: CropState | null;
  /** ระดับปุ๋ย 0 คือไม่ใส่ ใช้ได้หนึ่งรอบปลูก หมดตอนเก็บเกี่ยว */
  fertilizer: number;
}

export const emptyPlot = (): PlotState => ({ tilled: false, watered: false, crop: null, fertilizer: 0 });

/** ถาดอาหาร จานละ 1 เมนู เมนูเดิมซ้อนในจานเดิม · level 0 / 1 / 2 คือ 3 / 6 / 10 จาน */
export interface Tray {
  level: number;
  plates: (BagStack | null)[];
}

export interface Affection {
  points: number;
  /** ได้กินเมนูประจำใจแล้ว จึงเลยขั้น 90% ไปถึง 100% ได้ */
  signature: boolean;
}

/** แขกแบบพิเศษของแฝดชั้น 5: พี่แวะมาแกล้ง · ฉากเฉลย · ชวนทายใหม่หลังทายผิด */
export type ArrivalKind = 'tease' | 'reveal' | 'quiz';

export interface Arrival {
  monster: string;
  day: number;
  hour: number;
  done: boolean;
  kind?: ArrivalKind;
}

/** แฝดชั้น 5 เฉลยแล้วหรือยัง (วันไหน) และทายถูกแล้วหรือยัง (ได้กระดิ่งลมแฝด) */
export interface Twins {
  revealed: boolean;
  revealDay: number;
  quizWon: boolean;
}

export interface Monsters {
  affection: Record<string, Affection>;
  /** วันล่าสุดที่วางแผนแขกแล้ว (วางแผนตอนจีโอกลับจากเร่ขาย) จะได้ไม่วางซ้ำ */
  plannedDay: number;
  /** แขกของวันนี้และพรุ่งนี้ */
  arrivals: Arrival[];
  twins: Twins;
  /** เมนูที่เคยเสิร์ฟให้แต่ละตัวแล้ว (หยิบกินหรืองอน) อัลบั้มมอนสเตอร์เปิดรสนิยมตามนี้ */
  tasted: Record<string, string[]>;
}

export interface Farm {
  plots: PlotState[];
}

export interface BagStack {
  item: string;
  count: number;
}

export interface CookingSlot {
  recipe: string;
  stars: number;
  minutesLeft: number;
  /** ทำเมนูเดียวกันหลายจานในรอบเดียว ดาวเท่ากันทั้งรอบ */
  count: number;
}

export interface Cooking {
  slot: CookingSlot | null;
}

export interface RecipeBook {
  known: string[];
  bestStars: Record<string, number>;
}

export type Tool = 'hoe' | 'can' | 'sickle' | 'seeds' | 'rod';

/** ไอคอนบนปุ่มกระทำปุ่มเดียว เปลี่ยนตามจุดที่ยืนและของที่ถือ */
export type ActionIcon = 'fish' | 'bath' | 'water' | 'till' | 'plant' | 'harvest' | 'cook' | 'sleep' | 'chest' | 'talk' | 'buy' | 'tray' | 'eat' | 'craft' | 'shake';

export interface ContextAction {
  icon: ActionIcon;
  label: TextKey;
}

export type Weather = 'sunny' | 'rain' | 'cloudy';

export interface Fishing {
  rods: string[];
  /** จำนวนที่ตกได้ของแต่ละชนิด */
  caught: Record<string, number>;
}

/** สรุปยอดตอนจีโอกลับมา เงินเข้ากระเป๋าเงินแล้ว ของที่ขายไม่หมดรอรับคืนตอนคุย */
export interface GioReport {
  day: number;
  sold: BagStack[];
  returned: BagStack[];
  gross: number;
  commission: number;
  coins: number;
  /** ของแปลก ๆ ที่จีโอได้มาฝาก (ความสุขช่วงบนสุด) */
  gift: BagStack | null;
  /** ช่วงความสุขตอนฝาก ใช้คิดราคาต่อชิ้นในใบสรุปยอด */
  tier: number;
}

/** twin_clue ข่าวแฝดที่จีโอเล่าขัดกันเองก่อนเฉลย · twin_reveal ข่าวด่วนวันหลังเฉลย */
export type TipKind = 'favourite' | 'drink' | 'signature' | 'twin_clue' | 'twin_reveal';

/** ข่าวหนึ่งข้อที่จีโอเล่า */
export interface Tip {
  monster: string;
  kind: TipKind;
  day: number;
  read: boolean;
}

/** ความสุขจีโอ แมวเลียวันนี้ ลูบหัว และของที่ฝากขาย */
export interface GioCare {
  happiness: number;
  treatDay: number;
  treatsToday: number;
  pettedDay: number;
  specialWeek: number;
  /** วันที่อ่านข่าวแล้ว */
  newsDay: number;
  /** แมวเลียรสที่จีโอเคยกินแล้ว รูปในอัลบั้มจีโอเปิดตามนี้ */
  album: string[];
  tips: Tip[];
  tipsReportDay: number;
  lastTipDay: number;
  /** tier คือช่วงความสุขตอนฝาก ใช้คิดค่าคอมตอนจีโอกลับ */
  consignment: { items: BagStack[]; returnDay: number; tier: number } | null;
  report: GioReport | null;
}

/** งานประดิษฐ์ (งานอาหารโซน 1 ขั้นที่ 4) */
export interface Crafting {
  /** วันที่เขย่าต้นกล้วยล่าสุด 0 คือยังไม่เคย */
  bananaDay: number;
  /** ของที่ตัวเอกเคยพูดถึงตอนได้ครั้งแรกแล้ว */
  noticed: string[];
  /** ถาดตากกับลอบที่มี (ไม่อยู่ในกระเป๋า) */
  stations: { drying_tray: number; trap: number };
}

/** ความจริงของเกมที่อยู่ในเซฟ */
export interface World {
  day: number;
  /** ชั่วโมงนับต่อเนื่องจากเที่ยงคืนของวันนั้น 26 คือตีสองของวันถัดไป */
  hour: number;
  gauges: GaugeValues;
  /** null คือยังไม่เคยวาง ให้ใช้จุดเกิดบนแผนที่ */
  player: Point | null;
  wallet: Wallet;
  farm: Farm;
  bag: BagStack[];
  cooking: Cooking;
  recipes: RecipeBook;
  cosmetics: Cosmetics;
  seed: number;
  weather: Weather;
  fishing: Fishing;
  chests: { sinceCosmetic: number };
  toys: string[];
  stash: Record<string, number>;
  gio: GioCare;
  /** ที่ดินที่ซื้อแล้ว (ซื้อตามลำดับ จึงเก็บแค่จำนวน) */
  land: { owned: number };
  crafting: Crafting;
  /** ของที่ผู้เล่นย้ายแล้ว เก็บตำแหน่งเท้าเป็นพิกเซล ของที่ยังไม่ย้ายใช้ตำแหน่งบนแผนที่ */
  placed: Record<string, Point>;
  tray: Tray;
  monsters: Monsters;
}

class GameState {
  private currentViewport: Viewport | null = null;
  private currentRotationRequired = false;
  private currentJoystick: Vector = { x: 0, y: 0 };
  private currentLightingEnabled = true;
  private currentAutoFish = false;
  private currentZoomStep = 0;
  private currentRunHeld = false;
  private currentWorld: World | null = null;
  private currentSlot: number | null = null;
  private currentAction: ContextAction | null = null;
  private currentBait: string | null = null;
  private currentFood: string | null = null;
  private currentAutoRebait = false;
  private openWindows = new Set<string>();
  private currentPlayerScreen: Point = { x: 0, y: 0 };
  private currentTool: Tool = 'hoe';
  private currentSeed: string | null = null;

  get viewport(): Viewport {
    if (!this.currentViewport) throw new Error('viewport has not been set');
    return this.currentViewport;
  }

  get rotationRequired(): boolean {
    return this.currentRotationRequired;
  }

  get joystick(): Vector {
    return this.currentJoystick;
  }

  get world(): World {
    if (!this.currentWorld) throw new Error('game has not started');
    return this.currentWorld;
  }

  get started(): boolean {
    return this.currentWorld !== null;
  }

  get activeSlot(): number | null {
    return this.currentSlot;
  }

  /** นาฬิกาหยุดเมื่อเปิดหน้าต่างเต็มหรือยังไม่เลือกช่องเซฟ */
  get clockRunning(): boolean {
    return this.currentWorld !== null && this.openWindows.size === 0;
  }

  startGame(slot: number, world: World): void {
    this.currentSlot = slot;
    this.currentWorld = world;
    eventBus.emit('game-started', world);
    eventBus.emit('world-changed', world);
  }

  setWorld(world: World): void {
    this.currentWorld = world;
    eventBus.emit('world-changed', world);
  }

  /** ตำแหน่งเหนือหัวตัวเอกบนหน้าจอ ใช้วางฟองคำพูด */
  get playerScreen(): Point {
    return this.currentPlayerScreen;
  }

  trackPlayerScreen(point: Point): void {
    this.currentPlayerScreen = point;
  }

  /** ฉากรายงานตำแหน่งทุกเฟรม ไม่ต้องแจ้งใคร */
  trackPlayer(point: Point): void {
    if (this.currentWorld) this.currentWorld = { ...this.currentWorld, player: point };
  }

  /** ระบบย้ายตัวละคร เช่น ตื่นที่หน้าบ้าน ฉากจึงต้องตาม */
  movePlayer(point: Point): void {
    this.trackPlayer(point);
    eventBus.emit('player-moved', point);
  }

  setWindowOpen(name: string, open: boolean): void {
    if (this.openWindows.has(name) === open) return;
    if (open) this.openWindows.add(name);
    else this.openWindows.delete(name);
    eventBus.emit('window-changed', { name, open });
  }

  setAction(action: ContextAction | null): void {
    if (action?.icon === this.currentAction?.icon && action?.label === this.currentAction?.label) return;
    this.currentAction = action;
    eventBus.emit('action-changed', action);
  }

  get selectedTool(): Tool {
    return this.currentTool;
  }

  setSelectedTool(tool: Tool): void {
    this.currentTool = tool;
    eventBus.emit('tool-changed', tool);
  }

  get selectedSeed(): string | null {
    return this.currentSeed;
  }

  setSelectedSeed(seed: string | null): void {
    this.currentSeed = seed;
    eventBus.emit('tool-changed', this.currentTool);
  }

  /** เหยื่อที่เลือกในแถบเหนือช่องคันเบ็ด id ใน baits.json */
  get selectedBait(): string | null {
    return this.currentBait;
  }

  setSelectedBait(bait: string | null): void {
    this.currentBait = bait;
    eventBus.emit('tool-changed', this.currentTool);
  }

  /** อาหารที่เลือกในแถบอาหาร (สลับแถบเครื่องมือเป็นแถบอาหาร) ปุ่มกระทำเป็น "กิน" · null คือโหมดเครื่องมือหรือไม่มีของกิน */
  get selectedFood(): string | null {
    return this.currentFood;
  }

  setSelectedFood(item: string | null): void {
    if (item === this.currentFood) return;
    this.currentFood = item;
    eventBus.emit('food-changed', item);
  }

  /** ตกปลาอัตโนมัติแล้วเหวี่ยงเบ็ดใหม่ด้วยเหยื่อเดิมจนกว่าเหยื่อหมด */
  get autoRebait(): boolean {
    return this.currentAutoRebait;
  }

  setAutoRebait(on: boolean): void {
    this.currentAutoRebait = on;
  }

  /** ปุ่มวิ่งบนจอสัมผัส กดค้างแล้ววิ่ง */
  get runHeld(): boolean {
    return this.currentRunHeld;
  }

  setRunHeld(on: boolean): void {
    this.currentRunHeld = on;
  }

  get zoomStep(): number {
    return this.currentZoomStep;
  }

  setZoomStep(step: number): void {
    if (step === this.currentZoomStep) return;
    this.currentZoomStep = step;
    eventBus.emit('zoom-step-changed', step);
  }

  /** ตั้งค่าตกปลาอัตโนมัติ ขึ้น "!" แล้วดึงให้เอง */
  get autoFish(): boolean {
    return this.currentAutoFish;
  }

  setAutoFish(on: boolean): void {
    this.currentAutoFish = on;
  }

  get lightingEnabled(): boolean {
    return this.currentLightingEnabled;
  }

  setLightingEnabled(enabled: boolean): void {
    if (enabled === this.currentLightingEnabled) return;
    this.currentLightingEnabled = enabled;
    eventBus.emit('lighting-changed', enabled);
  }

  setViewport(viewport: Viewport): void {
    this.currentViewport = viewport;
    eventBus.emit('viewport-changed', viewport);
  }

  setRotationRequired(required: boolean): void {
    if (required === this.currentRotationRequired) return;
    this.currentRotationRequired = required;
    eventBus.emit('rotation-required-changed', required);
  }

  setJoystick(vector: Vector): void {
    this.currentJoystick = vector;
  }
}

export const gameState = new GameState();
