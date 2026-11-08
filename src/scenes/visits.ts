import Phaser from 'phaser';
import { assetUrl, registry } from '../core/assets';
import { atlasGroupOf, idsInGroup, loadAtlasGroup, registerAtlasGroup } from '../core/atlas';
import { audioSettings, sound } from '../core/audio';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { createRng } from '../core/rng';
import { gameState, type World } from '../core/state';
import balance from '../data/balance.json';
import dialogueJson from '../data/dialogue.json';
import type { Dialogue } from '../data/schema';
import { Monster } from '../entities/Monster';
import { parseDish, recipes } from '../systems/cooking';
import { dishToppingEffect, favouriteToppingOf } from '../systems/toppings';
import type { ArrivalKind } from '../core/state';
import {
  affectionOf,
  affectionPercent,
  arrivalKey,
  barOwner,
  dueArrivals,
  eatPlaceFor,
  finishTwinScene,
  isCleared,
  isTwin,
  nameKey,
  newVisitMemo,
  markArrived,
  monsterTable,
  planVisit,
  requiredPoints,
  revealDue,
  scheduleReveal,
  takePlate,
  noteTasted,
  tierOf,
  twinA,
  twinB,
  twinsSwitched,
  voiceOf,
  type EatPlace,
  type Reaction,
} from '../systems/monsters';
import { servingsOnTray } from '../systems/tray';
import { foodArtKey, prepareTwinArt, TWIN_ANIMS, type MonsterArt } from './monsterArt';
import type { TrayView } from './trayView';

type Point = { x: number; y: number };
type Beat = keyof Omit<Dialogue['monsters'][string], 'name' | 'voice'>;

const dialogue = dialogueJson as unknown as Dialogue;
const rules = balance.monsters;
/** แผนแต่ละครั้งที่มาเยี่ยมสุ่มจาก seed ของเซฟ วัน และลำดับแขก */
const PLAN_MIX = 3571;
/** ยืนหน้าถาดห่างขอบล่างของถาดเท่านี้ */
const FRONT_GAP_PX = 12;
/** เข้าถาดจากด้านขวา (ฝั่งโพรง) */
const APPROACH_GAP_PX = 18;
/** มอนสเตอร์ขี้อายกับหยิ่งลังเล ก้าวถอยแล้วกลับมาก่อนตัดสินใจ */
const HESITANT = new Set(['shy', 'proud']);
const HESITATE_CHANCE = 0.35;
const HESITATE_STEP_PX = 8;
const POUT_MS = 500;
const TAG_DROP_PX = 2;
const CLEAR_PAUSE_MS = 2200;
const VANISH_SPARKLE = true;
const HEARTS: Record<Reaction, number> = { neutral: 0, like: 1, favourite: 3, signature: 2 };
/** ตำแหน่งกินสำรองรอบโพรงถ้าแผนที่ไม่มีจุด monster_eat_* */
const FALLBACK_EAT: Point[] = [
  { x: -70, y: 70 },
  { x: 60, y: 76 },
  { x: -20, y: 104 },
];

/** เทสต์อัตโนมัติเร่งการมาเยี่ยมได้ (เปิดเฉพาะโหมด ?test) เกมจริงเป็น 1 เสมอ */
export const visitTestHooks = { speed: 1 };
const twinRules = rules.twins;
const twinLines = dialogue.twins;
/** ตอนทายแฝด ฟองคำพูดตัวขวายกสูงกว่าตัวซ้ายเท่านี้ (พิกเซลเกม) ฟองสูง 13 กับหางฟอง */
const QUIZ_BUBBLE_LIFT_PX = 19;
/** น้องเดินออกจากโพรงตามพี่ห่างกันเท่านี้ จะได้ไม่ซ้อนกันตอนเดิน */
const PARTNER_DELAY_MS = 450;

/** เสียงกระดิ่งสองโน้ต "กริ๊ง~ กรุ๊ง~" ของแฝด (กระดิ่งสูงคือพี่ ต่ำคือน้อง) */
function playTwinBells(): void {
  sound.play(audioSettings.twinChime.key);
}

type Wait = { kind: 'ms'; left: number } | { kind: 'walk' } | { kind: 'eat' } | { kind: 'until'; test: () => boolean };

interface Meal {
  item: string;
  gain: number;
  reaction: Reaction;
  cleared: boolean;
  /** จานนี้ทำให้ครบเซ็ตเมนูโปรดกับเครื่องดื่มโปรด */
  set: boolean;
}

interface Run {
  key: string;
  /** สุ่มแผนการหยิบจาก seed ของเซฟกับเวลาที่มา */
  seed: number;
  monster: Monster;
  script: Generator<Wait, void, void>;
  wait: Wait | null;
  done: boolean;
  /** ความชอบที่แสดงอยู่ ภาพค่อย ๆ ตามความจริงทีละจานตอนกิน */
  shownPoints: number;
  shownCleared: boolean;
  /** ที่นั่งกินที่จองไว้ เช่น nearBurrow:0 หรือ yard:1 */
  spot: string | null;
  /** แขกแบบพิเศษของแฝด (แวะมาแกล้ง ฉากเฉลย ชวนทาย) */
  kind: ArrivalKind | null;
  /** น้องแฝดที่มาพร้อมพี่ในฉากเฉลย */
  partner: Monster | null;
}

export interface VisitPlaces {
  burrow: Point;
  /** ทางจากโพรงออกมาที่ลาน เรียงจากโพรงออกไป */
  route: Point[];
  eatSpots: Point[];
}

/** แปลงตำแหน่งบนแผนที่เป็นตำแหน่งบนจอ (พิกเซล CSS) ฉากเป็นคนให้ */
export type ToScreen = (x: number, y: number) => Point;

/**
 * แขกมอนสเตอร์ที่มาถึงเวลาแล้ว: โผล่จากโพรง เดินมาดูถาดทีละจาน หยิบตามความชอบ ไปนั่งกินใกล้โพรง แล้วกลับเข้าโพรง
 * ความชอบเข้าเซฟทันทีที่หยิบ (GameState) ภาพเล่นตามทีหลัง
 */
export class Visits {
  private runs = new Map<string, Run>();
  private trayOwner: Run | null = null;
  private spotsTaken = new Set<string>();
  private readonly talkRng = createRng(Date.now() + 7);
  private tagShown = new Set<string>();
  private player: Point = { x: 0, y: 0 };
  /** แผ่นภาพมอนสเตอร์ที่สั่งโหลดแล้ว (โหลดตอนจะมาเยี่ยม ไม่โหลดตอนเปิดเกม) */
  private art = new Map<string, 'loading' | 'done'>();
  private twinAnswer: number | null = null;
  private readonly stopAnswer = eventBus.on('twin-quiz-answer', ({ index }) => {
    this.twinAnswer = index;
  });

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly places: VisitPlaces,
    private readonly tray: () => TrayView | null,
    private readonly toScreen: ToScreen,
  ) {}

  update(deltaMs: number, time: number, player: Point): void {
    if (!gameState.started) return;
    const world = gameState.world;
    this.player = player;
    // แขกที่วางแผนไว้แล้ว (วันนี้และพรุ่งนี้) โหลดภาพไว้ก่อน ตอนถึงเวลาจะได้ออกมาทันที
    for (const arrival of world.monsters.arrivals) if (!arrival.done) this.requestArt(arrival.monster);
    for (const arrival of dueArrivals(world)) {
      const key = arrivalKey(arrival);
      if (!this.runs.has(key)) this.spawn(key, Math.round(arrival.hour * 1000), arrival.monster, arrival.kind ?? null);
    }
    const paused = !gameState.clockRunning;
    const step = deltaMs * visitTestHooks.speed;
    for (const run of [...this.runs.values()]) {
      run.monster.sprite.anims.timeScale = visitTestHooks.speed * run.monster.speedMultiplier;
      run.monster.update(step, paused, time);
      if (run.partner) {
        run.partner.sprite.anims.timeScale = visitTestHooks.speed * run.partner.speedMultiplier;
        run.partner.update(step, paused, time);
      }
      if (!paused) this.advance(run, step);
      if (run.done) this.remove(run);
    }
    this.updateTags(player);
  }

  destroy(): void {
    for (const run of this.runs.values()) {
      run.monster.destroy();
      run.partner?.destroy();
      eventBus.emit('monster-tag', { id: run.key, hidden: true });
    }
    this.runs.clear();
    this.stopAnswer();
    eventBus.emit('twin-quiz-close', undefined);
    this.trayOwner = null;
    this.spotsTaken.clear();
  }

  private spawn(key: string, seed: number, id: string, kind: ArrivalKind | null): void {
    const own = monsterTable[id]?.art ?? null;
    // น้องแฝดก่อนเฉลยปลอมตัวเป็นพี่ทุกพิกเซล (ใช้ภาพพี่ทั้งชุด)
    const art = monsterTable[id]?.twinOf && !gameState.world.monsters.twins.revealed ? (monsterTable[monsterTable[id]!.twinOf!]?.art ?? own) : own;
    if (art && !this.scene.textures.exists(`${art.sheet}_hungry_stand`) && this.requestArt(id) === 'loading') return;
    if (!art || !this.scene.textures.exists(`${art.sheet}_hungry_stand`)) {
      // ไม่มีภาพ (ข้อมูลผิด) นับว่ามาแล้ว จะได้ไม่ค้าง
      gameState.setWorld(markArrived(gameState.world, key));
      return;
    }
    const world = gameState.world;
    const affection = affectionOf(world, id);
    const monster = new Monster(this.scene, id, art as MonsterArt, this.places.burrow, affectionPercent(world, id), isCleared(world, id), createRng(Date.now() + seed));
    const run: Run = { key, seed, monster, script: undefined as never, wait: null, done: false, shownPoints: affection.points, shownCleared: isCleared(world, id), spot: null, kind, partner: null };
    if (kind === 'reveal' || kind === 'quiz') {
      // น้องมาพร้อมพี่ ในชุดฟางเหมือนกันจนสะบัดฟางออก
      prepareTwinArt(this.scene);
      run.partner = new Monster(this.scene, twinB, art as MonsterArt, this.places.burrow, 100, true, createRng(Date.now() + seed + 1));
    } else if (kind === 'tease') prepareTwinArt(this.scene);
    run.script = kind === 'reveal' || kind === 'quiz' ? this.twinScene(run, kind) : kind === 'tease' ? this.teaseVisit(run) : this.visit(run);
    this.runs.set(key, run);
    this.next(run);
  }

  /**
   * โหลดแผ่นภาพของมอนสเตอร์ตัวนี้ (แฝดน้องอยู่แผ่นเดียวกับพี่) ตอบ done เมื่อโหลดเสร็จหรือโหลดไม่ได้แล้ว
   * โหลดแผ่นรวมไม่ได้ลองโหลดไฟล์เดี่ยวแบบเดิม
   */
  private requestArt(id: string): 'loading' | 'done' {
    const art = monsterTable[id]?.art;
    const group = art ? atlasGroupOf(`${art.sheet}_hungry_stand`) : null;
    if (!group) return 'done';
    const known = this.art.get(group);
    if (known) return known;
    this.art.set(group, 'loading');
    const textures = this.scene.textures;
    loadAtlasGroup(group)
      .then(() => registerAtlasGroup(textures, group))
      .catch(
        () =>
          new Promise<void>((resolve) => {
            const loader = this.scene.load;
            for (const sheet of idsInGroup(group)) {
              const entry = registry[sheet];
              if (entry?.type === 'local' && entry.frame_width && entry.frame_height && !textures.exists(sheet)) {
                loader.spritesheet(sheet, assetUrl(entry.file), { frameWidth: entry.frame_width, frameHeight: entry.frame_height });
              }
            }
            loader.once(Phaser.Loader.Events.COMPLETE, () => resolve());
            loader.start();
          }),
      )
      .finally(() => this.art.set(group, 'done'));
    return 'loading';
  }

  private remove(run: Run): void {
    if (this.trayOwner === run) this.trayOwner = null;
    if (run.spot !== null) this.spotsTaken.delete(run.spot);
    run.monster.destroy();
    run.partner?.destroy();
    this.runs.delete(run.key);
    this.tagShown.delete(run.key);
    eventBus.emit('monster-tag', { id: run.key, hidden: true });
  }

  private next(run: Run): void {
    const step = run.script.next();
    run.wait = step.done ? null : step.value;
    if (step.done) run.done = true;
  }

  private advance(run: Run, deltaMs: number): void {
    const wait = run.wait;
    if (!wait) return;
    if (wait.kind === 'ms') {
      wait.left -= deltaMs;
      if (wait.left > 0) return;
    } else if (wait.kind === 'walk') {
      if (!run.monster.arrived) return;
    } else if (wait.kind === 'eat') {
      if (run.monster.eating) return;
    } else if (!wait.test()) return;
    this.next(run);
  }

  /** ป้ายชื่อกับความชอบเหนือหัว เมื่อตัวเอกยืนใกล้ */
  private updateTags(player: Point): void {
    const world = gameState.world;
    for (const run of this.runs.values()) {
      const { monster } = run;
      // ฉากเฉลยไม่มีป้าย จะได้ไม่บังคำถาม
      const near = run.partner === null && Math.hypot(monster.feetX - player.x, monster.feetY - player.y) < rules.labelReachPx;
      if (!near) {
        if (this.tagShown.delete(run.key)) eventBus.emit('monster-tag', { id: run.key, hidden: true });
        continue;
      }
      this.tagShown.add(run.key);
      // แฝดก่อนเฉลยแสดงหลอดของตัวเดียว ("100% หลอก") วันที่อีกตัวมา หลอดไม่ขยับ
      const owner = barOwner(world, monster.id);
      const percent =
        owner !== monster.id ? affectionPercent(world, owner) : run.shownCleared ? 100 : Math.min(100, (run.shownPoints / requiredPoints(monster.id)) * 100);
      eventBus.emit('monster-tag', {
        id: run.key,
        hidden: false,
        name: t(nameKey(world, monster.id)),
        percent: Math.floor(percent),
        // ป้ายชื่ออยู่ใต้เท้า ฟองคำพูดอยู่เหนือหัว จะได้ไม่ทับกัน
        anchor: () => (monster.sprite.active ? this.toScreen(monster.feetX, monster.feetY + TAG_DROP_PX) : null),
      });
    }
  }

  private say(run: Run, beat: Beat, always = false): void {
    if (!always && this.talkRng.next() >= rules.talkChance) return;
    // น้องแฝดมีบทของตัวเอง (ก่อนเฉลยบทไม่ชอบมาจาก dislike_B_pre ผ่าน twinPrank)
    const lines = run.monster.id === twinB ? twinLines.B_general[beat] : dialogue.monsters[voiceOf(run.monster.id)]?.[beat];
    const tier = tierOf(gameState.world, run.monster.id);
    const pool = lines?.[tier] ?? lines?.any;
    if (!pool || pool.length === 0) return;
    this.speak(run, pool[Math.floor(this.talkRng.next() * pool.length)]!);
  }

  /** lift ยกฟองขึ้นอีก (พิกเซลเกม) ฟองสองตัวที่ยืนชิดกันจะได้ไม่ทับกัน · hold ค้างฟองไว้จนกว่าจะตอบ false */
  private speak(run: Run, text: string, who: Monster = run.monster, options: { lift?: number; hold?: () => boolean } = {}): void {
    const lift = options.lift ?? 0;
    eventBus.emit('speech', {
      speaker: `${run.key}:${who.id}`,
      text,
      anchor: () => (who.sprite.active ? this.toScreen(who.feetX, who.headY - lift) : null),
      ...(options.hold ? { hold: options.hold } : {}),
    });
  }

  /**
   * ท็อปปิ้งบนจานที่กิน: ผิดประเภทหน้าจะอ้วก 🤢 (ไม่มีผลเสีย) ในฟองความคิด
   * ท็อปปิ้งที่ชอบหัวใจลอยกับประกาย · ผงนัวบนของคาวมีประกายและบางครั้งพูด "นัวว~!"
   */
  private reactToToppings(run: Run, item: string): void {
    const monster = run.monster;
    const effect = dishToppingEffect(item, favouriteToppingOf(monster.id));
    if (effect.yuck) monster.think('emote_yuck', rules.bubbleMs);
    if (effect.favourite) {
      monster.hearts(1);
      monster.sparkles();
    }
    if (effect.noticed) {
      monster.sparkles();
      if (this.talkRng.next() < balance.toppings.umamiSayChance) this.speak(run, t('monster.umami'));
    }
  }

  private pick(lines: string[]): string {
    return lines[Math.floor(this.talkRng.next() * lines.length)]!;
  }

  /** แฝดก่อนเฉลย: บทแซวตอนเจอเมนูที่ไม่ชอบ ให้รู้ว่าโดนแกล้ง ไม่ใช่บั๊ก */
  private twinPrank(run: Run): boolean {
    const id = run.monster.id;
    if (!isTwin(id) || gameState.world.monsters.twins.revealed) return false;
    this.speak(run, this.pick(id === twinA ? twinLines.dislike_A_pre : twinLines.dislike_B_pre));
    return true;
  }

  private *walk(run: Run, points: Point[]): Generator<Wait, void, void> {
    run.monster.walkTo(points);
    yield { kind: 'walk' };
  }

  private trayFront(): { approach: Point; plates: { index: number; x: number }[]; y: number } | null {
    const view = this.tray();
    if (!view) return null;
    const { right, bottom } = view.bounds;
    const level = gameState.world.tray.level;
    const y = bottom + FRONT_GAP_PX;
    const plates = gameState.world.tray.plates
      .map((_, index) => ({ index, x: view.platePoint(level, index).x }))
      // เดินจากขวา (ฝั่งโพรง) ไปซ้าย จานที่ตรงกันดูจานแถวหน้าก่อน
      .sort((a, b) => b.x - a.x || b.index - a.index);
    return { approach: { x: right + APPROACH_GAP_PX, y }, plates, y };
  }

  /** ที่นั่งกิน: ใกล้โพรงใช้จุด monster_eat_* บนแผนที่ · ลานหน้าบ้านอยู่รอบถาด ถาดย้ายที่ก็ตามไป */
  private eatSpot(run: Run, place: Exclude<EatPlace, 'burrow'>): Point {
    const view = this.tray();
    const spots =
      place === 'yard' && view
        ? rules.yardSpots.map(([dx, dy]) => ({ x: view.bounds.centerX + dx, y: view.bounds.bottom + dy }))
        : this.places.eatSpots.length > 0
          ? this.places.eatSpots
          : FALLBACK_EAT.map((offset) => ({ x: this.places.burrow.x + offset.x, y: this.places.burrow.y + offset.y }));
    const free = spots.findIndex((_, index) => !this.spotsTaken.has(`${place}:${index}`));
    const index = free >= 0 ? free : 0;
    run.spot = `${place}:${index}`;
    this.spotsTaken.add(run.spot);
    return spots[index]!;
  }

  /** กลับเข้าโพรง: จากลาน (ถาดหรือลานหน้าบ้าน) เดินย้อนทางเดิม จากที่นั่งใกล้โพรงเดินเข้าจุดแรกนอกโพรงแล้วมุดเข้าไป */
  private *goHome(run: Run, from: 'yard' | 'nearBurrow'): Generator<Wait, void, void> {
    const { route, burrow } = this.places;
    const path = from === 'yard' ? [...[...route].reverse(), burrow] : [route[0] ?? burrow, burrow];
    yield* this.walk(run, path);
    if (VANISH_SPARKLE) run.monster.sparkles();
  }

  private showAffection(run: Run, meal: Meal | null): void {
    if (meal) {
      run.shownPoints = Math.min(requiredPoints(run.monster.id), run.shownPoints + meal.gain);
      if (meal.cleared) run.shownCleared = true;
    }
    const percent = run.shownCleared ? 100 : (run.shownPoints / requiredPoints(run.monster.id)) * 100;
    run.monster.setAffection(percent, run.shownCleared);
  }

  private *visit(run: Run): Generator<Wait, void, void> {
    const { monster } = run;
    const id = monster.id;
    const info = monsterTable[id]!;
    this.say(run, 'appear');
    const first = this.trayFront();
    yield* this.walk(run, [...this.places.route, ...(first ? [first.approach] : [])]);

    // ถาดมีแขกอยู่ ยืนรอข้าง ๆ
    yield { kind: 'until', test: () => this.trayOwner === null };
    this.trayOwner = run;
    gameState.setWorld(markArrived(gameState.world, run.key));
    const front = this.trayFront();
    if (!front || isCleared(gameState.world, id)) {
      this.trayOwner = null;
      yield* this.goHome(run, 'yard');
      return;
    }
    if (servingsOnTray(gameState.world.tray) === 0) {
      monster.stand('north');
      this.say(run, 'emptyTray', true);
      yield { kind: 'ms', left: rules.thinkMs };
      this.trayOwner = null;
      yield* this.goHome(run, 'yard');
      return;
    }

    const world: World = gameState.world;
    const plan = planVisit(world, id, createRng(world.seed + world.day * PLAN_MIX + run.seed));
    // ที่กินตัดสินจากความชอบตอนมาถึง ก่อนได้ความชอบจากรอบนี้
    const place = eatPlaceFor(world, id);
    this.say(run, 'browse');
    const memo = newVisitMemo();
    const meals: Meal[] = [];
    for (const { index, x } of front.plates) {
      if (!gameState.world.tray.plates[index]) continue;
      yield* this.walk(run, [{ x, y: front.y }]);
      monster.stand('north');
      if (HESITANT.has(info.personality) && this.talkRng.next() < HESITATE_CHANCE) {
        this.speak(run, '…');
        yield* this.walk(run, [{ x: x + HESITATE_STEP_PX, y: front.y + 2 }, { x, y: front.y }]);
        monster.stand('north');
        yield { kind: 'ms', left: rules.thinkMs };
      }
      yield { kind: 'ms', left: rules.browseMs };
      if (plan.pouts.includes(index)) {
        // จำว่าเคยเสิร์ฟเมนูนี้แล้ว อัลบั้มจะได้เปิดช่อง "ไม่ชอบ"
        const pouted = gameState.world.tray.plates[index];
        if (pouted) gameState.setWorld(noteTasted(gameState.world, id, parseDish(pouted.item).recipe));
        // เส้นเลือดงอนขึ้นก่อน บทพูดไม่ชอบ (ถ้าสุ่มได้) ตามมาหลังเส้นเลือดจาง จะได้ไม่ทับกัน
        monster.pout();
        yield { kind: 'ms', left: POUT_MS };
        if (!this.twinPrank(run)) this.say(run, 'dislike');
        continue;
      }
      const take = plan.takes.find((entry) => entry.plate === index);
      if (!take) continue;
      const result = takePlate(gameState.world, id, take, memo);
      gameState.setWorld(result.world);
      if (result.taken === 0) continue;
      const recipe = parseDish(take.item).recipe;
      // หอคอยใช้ภาพอาหารจิ๋ววางบนจาน D1 (ผู้ใช้เลือก 6 พ.ย. 2026 14:18)
      monster.addToTower(foodArtKey(this.scene, recipe, recipes[recipe]?.icon), result.taken);
      monster.hearts(take.reaction === 'neutral' ? 0 : 1);
      if (take.reaction === 'favourite' || take.reaction === 'signature') monster.sparkles();
      if (take.reaction === 'favourite') this.say(run, 'favourite', true);
      else if (take.reaction === 'like') this.say(run, 'like');
      result.gains.forEach((gain, at) => {
        const last = at === result.gains.length - 1;
        meals.push({ item: take.item, gain: gain + (last ? result.setBonus : 0), reaction: take.reaction, cleared: result.cleared && last, set: result.set && last });
      });
      if (result.set) {
        // ครบเซ็ตเมนูโปรดกับเครื่องดื่มโปรด
        this.speak(run, t('monster.set'));
        monster.hearts(2);
        monster.sparkles();
        yield { kind: 'ms', left: rules.bubbleMs / 2 };
      }
      yield { kind: 'ms', left: rules.eatGapMs };
    }
    if (plan.asks) {
      // ฟองความคิดมีไอคอนเมนูประจำใจที่อยากกิน ไม่มีตัวหนังสือ (ภาพยังไม่มีใช้ฟองคำพูดแทน)
      const icon = `mini16_${plan.asks}`;
      if (this.scene.textures.exists(icon)) monster.think(icon, rules.bubbleMs);
      else this.speak(run, `${t('monster.asks')}${t(`dish.${plan.asks}.name` as TextKey)}${t('monster.asks_end')}`);
      yield { kind: 'ms', left: rules.bubbleMs };
    }
    this.trayOwner = null;
    // น้องแฝดมากินก่อนหลอดสลับ หลอดไม่ขยับ มีบทแซว
    const frozenBar = id === twinB && !twinsSwitched(gameState.world);
    if (meals.length === 0) {
      if (frozenBar) this.speak(run, this.pick(twinLines.B_done_bar_frozen));
      else this.say(run, 'done');
      yield* this.goHome(run, 'yard');
      return;
    }

    // ยังระแวง: คว้าอาหารแล้ววิ่งกลับไปกินในโพรง
    if (place === 'burrow') {
      if (frozenBar) this.speak(run, this.pick(twinLines.B_done_bar_frozen));
      else this.say(run, 'eat', true);
      monster.speedMultiplier = rules.runSpeedMultiplier;
      yield* this.goHome(run, 'yard');
      yield* this.revealAfter();
      return;
    }
    // กลาง: นั่งกินใกล้โพรง · สนิท: นั่งกินที่ลานหน้าบ้านใกล้ถาด (ร้านยังไม่เปิด) ทีละที่ ตาค่อย ๆ หวานขึ้นตามความชอบที่ได้
    const spot = this.eatSpot(run, place);
    yield* this.walk(run, place === 'yard' ? [spot] : [...[...this.places.route].reverse().slice(0, -1), spot]);
    monster.stand('south');
    this.say(run, 'eat');
    for (const meal of meals) {
      monster.eat();
      yield { kind: 'eat' };
      monster.removeFromTower();
      this.showAffection(run, meal);
      if (HEARTS[meal.reaction] > 0) monster.hearts(HEARTS[meal.reaction]);
      if (meal.set) monster.sparkles();
      this.reactToToppings(run, meal.item);
      if (meal.cleared && id === twinA && !gameState.world.monsters.twins.revealed) {
        // พี่ครบ 100% แต่ประตูยังไม่เปิด หัวเราะคิกคัก แล้วหลอดสลับเป็นของน้อง
        monster.sparkles();
        this.speak(run, twinLines.bar_switch[0]!);
        prepareTwinArt(this.scene);
        monster.perform(TWIN_ANIMS.giggle);
        yield { kind: 'eat' };
        yield { kind: 'ms', left: CLEAR_PAUSE_MS };
      } else if (meal.cleared && id === twinB) {
        // น้องครบ 100% ฉากเฉลยตามมาหลังกลับเข้าโพรง ยังไม่บอกว่าประตูเปิด
        monster.sparkles();
        yield { kind: 'ms', left: CLEAR_PAUSE_MS / 2 };
      } else if (meal.cleared) {
        monster.sparkles();
        this.speak(run, t(`monster.${id}.clear` as TextKey));
        eventBus.emit('notice-text', `${t('monster.cleared_notice')}${info.floor}${t('monster.cleared_notice_end')}`);
        yield { kind: 'ms', left: CLEAR_PAUSE_MS };
      }
      yield { kind: 'ms', left: rules.eatGapMs };
    }
    if (frozenBar) this.speak(run, this.pick(twinLines.B_done_bar_frozen));
    else this.say(run, 'done');
    yield { kind: 'ms', left: rules.eatGapMs };
    if (run.spot !== null) this.spotsTaken.delete(run.spot);
    run.spot = null;
    yield* this.goHome(run, place);
    yield* this.revealAfter();
  }

  /** น้องเพิ่งครบ 100%: นัดฉากเฉลยทันทีหลังกลับเข้าโพรง */
  private *revealAfter(): Generator<Wait, void, void> {
    if (revealDue(gameState.world)) gameState.setWorld(scheduleReveal(gameState.world));
  }

  /** หลังหลอดสลับ พี่แวะมาแกล้งนาน ๆ ที: เดินมาที่ลาน หัวเราะคิกคัก แล้ววิ่งหนีกลับโพรง ไม่กิน */
  private *teaseVisit(run: Run): Generator<Wait, void, void> {
    const { monster } = run;
    gameState.setWorld(markArrived(gameState.world, run.key));
    const front = this.trayFront();
    yield* this.walk(run, [...this.places.route, ...(front ? [front.approach] : [])]);
    monster.stand('south');
    this.speak(run, this.pick(twinLines.A_tease_visit));
    monster.perform(TWIN_ANIMS.giggle);
    yield { kind: 'eat' };
    monster.setRunAnims({ east: TWIN_ANIMS.runEast, west: TWIN_ANIMS.runWest });
    monster.speedMultiplier = rules.runSpeedMultiplier;
    yield* this.goHome(run, 'yard');
  }

  /**
   * ฉากเฉลยแฝด (GDD): โผล่จากโพรงพร้อมกันสีฟางทั้งคู่ → กระดิ่งสองโน้ต → ทายว่าใครชอบกินปลา (สุ่มซ้ายขวา)
   * → น้องสะบัดฟางเป็นขนม่วงเทา → กระโดดดีใจ → ประตูชั้น 5 เปิด · ทายผิดไม่ได้รางวัล วันหลังมาชวนทายใหม่ (kind quiz)
   */
  private *twinScene(run: Run, kind: 'reveal' | 'quiz'): Generator<Wait, void, void> {
    const elder = run.monster;
    const younger = run.partner!;
    gameState.setWorld(markArrived(gameState.world, run.key));
    const view = this.tray();
    const center = view
      ? { x: view.bounds.centerX, y: view.bounds.bottom + twinRules.stageDropPx }
      : (this.places.eatSpots[0] ?? { x: this.places.burrow.x + FALLBACK_EAT[0]!.x, y: this.places.burrow.y + FALLBACK_EAT[0]!.y });
    const elderLeft = this.talkRng.next() < 0.5;
    const left = { x: center.x - twinRules.standApartPx, y: center.y };
    const right = { x: center.x + twinRules.standApartPx, y: center.y };
    const [leftTwin, rightTwin] = elderLeft ? [elder, younger] : [younger, elder];
    elder.walkTo([...this.places.route, elderLeft ? left : right]);
    yield { kind: 'ms', left: PARTNER_DELAY_MS };
    younger.walkTo([...this.places.route, elderLeft ? right : left]);
    yield { kind: 'until', test: () => elder.arrived && younger.arrived };
    elder.stand('south');
    younger.stand('south');
    // รอให้ตัวเอกเดินมาใกล้ก่อนเริ่มทาย ถ้าไม่มาจนดึกก็กลับบ้าน ฉากเฉลยยังรออยู่
    const late = (): boolean => gameState.world.hour >= rules.settleAfterHour;
    const near = (): boolean => Math.hypot(center.x - this.player.x, center.y - this.player.y) < twinRules.quizReachPx;
    yield { kind: 'until', test: () => near() || late() };
    if (!near()) {
      yield* this.twinsHome(run);
      return;
    }
    playTwinBells();
    elder.sparkles();
    younger.sparkles();
    yield { kind: 'ms', left: twinRules.bellsMs };
    if (kind === 'quiz') {
      this.speak(run, twinLines.reveal_quiz.retry_visit, younger);
      yield { kind: 'ms', left: rules.bubbleMs };
    }
    // บทเบาะแสของสองตัวค้างไว้เหนือหัวตลอดเวลาที่เลือก จนกว่าผู้เล่นจะแตะ (ผู้ใช้เลือก 7 พ.ย. 2026) ฟองตัวขวายกสูงกว่าจะได้ไม่ทับกัน
    let choosing = true;
    const hold = (): boolean => choosing;
    const lift = (twin: Monster): number => (twin === rightTwin ? QUIZ_BUBBLE_LIFT_PX : 0);
    this.speak(run, twinLines.reveal_quiz.A, elder, { lift: lift(elder), hold });
    yield { kind: 'ms', left: rules.bubbleMs };
    this.speak(run, twinLines.reveal_quiz.B, younger, { lift: lift(younger), hold });
    yield { kind: 'ms', left: rules.bubbleMs };
    const anchor = (twin: Monster) => () => (twin.sprite.active ? this.toScreen(twin.feetX, twin.feetY - Math.round(twin.art.height / 2)) : null);
    this.twinAnswer = null;
    eventBus.emit('twin-quiz', { prompt: twinLines.reveal_quiz.prompt, anchors: [anchor(leftTwin), anchor(rightTwin)] });
    yield { kind: 'until', test: () => this.twinAnswer !== null || late() };
    choosing = false;
    if (this.twinAnswer === null) {
      eventBus.emit('twin-quiz-close', undefined);
      yield* this.twinsHome(run);
      return;
    }
    const correct = (this.twinAnswer === 0) === elderLeft;
    this.twinAnswer = null;
    if (correct) this.speak(run, twinLines.reveal_quiz.correct, elder);
    else this.speak(run, twinLines.reveal_quiz.wrong, younger);
    yield { kind: 'ms', left: rules.bubbleMs };
    // น้องสะบัดฟางออก เผยขนสีม่วงเทา
    younger.perform(TWIN_ANIMS.shake);
    yield { kind: 'until', test: () => !younger.eating };
    younger.setArt(monsterTable[twinB]!.art as MonsterArt);
    elder.perform(TWIN_ANIMS.jumpA);
    younger.perform(TWIN_ANIMS.jumpB);
    this.speak(run, twinLines.reveal_line[0]!, elder);
    yield { kind: 'until', test: () => !elder.eating && !younger.eating };
    const before = gameState.world.monsters.twins;
    gameState.setWorld(finishTwinScene(gameState.world, kind, correct));
    if (!before.revealed) {
      eventBus.emit('notice-text', `${t('monster.cleared_notice')}${monsterTable[twinA]!.floor}${t('monster.cleared_notice_end')}`);
      yield { kind: 'ms', left: CLEAR_PAUSE_MS };
    }
    if (correct && !before.quizWon) {
      eventBus.emit('notice', 'twins.chime_reward');
      yield { kind: 'ms', left: CLEAR_PAUSE_MS };
    }
    yield* this.twinsHome(run);
  }

  /** แฝดกลับเข้าโพรงด้วยกัน น้องเดินตามหลังพี่ */
  private *twinsHome(run: Run): Generator<Wait, void, void> {
    const elder = run.monster;
    const younger = run.partner!;
    const path = [...[...this.places.route].reverse(), this.places.burrow];
    elder.walkTo(path);
    yield { kind: 'ms', left: PARTNER_DELAY_MS };
    younger.walkTo(path);
    yield { kind: 'until', test: () => elder.arrived && younger.arrived };
    if (VANISH_SPARKLE) {
      elder.sparkles();
      younger.sparkles();
    }
  }
}

