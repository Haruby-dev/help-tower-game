import Phaser from 'phaser';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { createRng } from '../core/rng';
import { gameState, type World } from '../core/state';
import balance from '../data/balance.json';
import dialogueJson from '../data/dialogue.json';
import type { Dialogue } from '../data/schema';
import { Monster } from '../entities/Monster';
import { parseDish, recipes } from '../systems/cooking';
import {
  affectionOf,
  affectionPercent,
  arrivalKey,
  dueArrivals,
  eatPlaceFor,
  isCleared,
  newVisitMemo,
  markArrived,
  monsterTable,
  planVisit,
  requiredPoints,
  takePlate,
  tierOf,
  type EatPlace,
  type Reaction,
} from '../systems/monsters';
import { servingsOnTray } from '../systems/tray';
import { foodMoundKey, type MonsterArt } from './monsterArt';
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

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly places: VisitPlaces,
    private readonly tray: () => TrayView | null,
    private readonly toScreen: ToScreen,
  ) {}

  update(deltaMs: number, time: number, player: Point): void {
    if (!gameState.started) return;
    const world = gameState.world;
    for (const arrival of dueArrivals(world)) {
      const key = arrivalKey(arrival);
      if (!this.runs.has(key)) this.spawn(key, Math.round(arrival.hour * 1000), arrival.monster);
    }
    const paused = !gameState.clockRunning;
    const step = deltaMs * visitTestHooks.speed;
    for (const run of [...this.runs.values()]) {
      run.monster.sprite.anims.timeScale = visitTestHooks.speed * run.monster.speedMultiplier;
      run.monster.update(step, paused, time);
      if (!paused) this.advance(run, step);
      if (run.done) this.remove(run);
    }
    this.updateTags(player);
  }

  destroy(): void {
    for (const run of this.runs.values()) {
      run.monster.destroy();
      eventBus.emit('monster-tag', { id: run.key, hidden: true });
    }
    this.runs.clear();
    this.trayOwner = null;
    this.spotsTaken.clear();
  }

  private spawn(key: string, seed: number, id: string): void {
    const art = monsterTable[id]?.art;
    if (!art || !this.scene.textures.exists(`${art.sheet}_hungry_stand`)) {
      // ไม่มีภาพ (ข้อมูลผิด) นับว่ามาแล้ว จะได้ไม่ค้าง
      gameState.setWorld(markArrived(gameState.world, key));
      return;
    }
    const world = gameState.world;
    const affection = affectionOf(world, id);
    const monster = new Monster(this.scene, id, art as MonsterArt, this.places.burrow, affectionPercent(world, id), isCleared(world, id), createRng(Date.now() + seed));
    const run: Run = { key, seed, monster, script: undefined as never, wait: null, done: false, shownPoints: affection.points, shownCleared: isCleared(world, id), spot: null };
    run.script = this.visit(run);
    this.runs.set(key, run);
    this.next(run);
  }

  private remove(run: Run): void {
    if (this.trayOwner === run) this.trayOwner = null;
    if (run.spot !== null) this.spotsTaken.delete(run.spot);
    run.monster.destroy();
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
    for (const run of this.runs.values()) {
      const { monster } = run;
      const near = Math.hypot(monster.feetX - player.x, monster.feetY - player.y) < rules.labelReachPx;
      if (!near) {
        if (this.tagShown.delete(run.key)) eventBus.emit('monster-tag', { id: run.key, hidden: true });
        continue;
      }
      this.tagShown.add(run.key);
      const percent = run.shownCleared ? 100 : Math.min(100, (run.shownPoints / requiredPoints(monster.id)) * 100);
      eventBus.emit('monster-tag', {
        id: run.key,
        hidden: false,
        name: t(`monster.${monster.id}.name` as TextKey),
        percent: Math.floor(percent),
        // ป้ายชื่ออยู่ใต้เท้า ฟองคำพูดอยู่เหนือหัว จะได้ไม่ทับกัน
        anchor: () => (monster.sprite.active ? this.toScreen(monster.feetX, monster.feetY + TAG_DROP_PX) : null),
      });
    }
  }

  private say(run: Run, beat: Beat, always = false): void {
    if (!always && this.talkRng.next() >= rules.talkChance) return;
    const lines = dialogue.monsters[run.monster.id]?.[beat];
    const tier = tierOf(gameState.world, run.monster.id);
    const pool = lines?.[tier] ?? lines?.any;
    if (!pool || pool.length === 0) return;
    this.speak(run, pool[Math.floor(this.talkRng.next() * pool.length)]!);
  }

  private speak(run: Run, text: string): void {
    const { monster } = run;
    eventBus.emit('speech', { speaker: run.key, text, anchor: () => (monster.sprite.active ? this.toScreen(monster.feetX, monster.headY) : null) });
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
        // เส้นเลือดงอนขึ้นก่อน บทพูดไม่ชอบ (ถ้าสุ่มได้) ตามมาหลังเส้นเลือดจาง จะได้ไม่ทับกัน
        monster.pout();
        yield { kind: 'ms', left: POUT_MS };
        this.say(run, 'dislike');
        continue;
      }
      const take = plan.takes.find((entry) => entry.plate === index);
      if (!take) continue;
      const result = takePlate(gameState.world, id, take, memo);
      gameState.setWorld(result.world);
      if (result.taken === 0) continue;
      const recipe = parseDish(take.item).recipe;
      // หอคอยใช้กองอาหารเล็กบนจานบางแบบเดิม (ผู้ใช้เลือก 6 พ.ย. 2026) ภาพอาหารจิ๋วใช้บนจานถาด
      monster.addToTower(foodMoundKey(this.scene, recipe, recipes[recipe]?.icon), result.taken);
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
    if (meals.length === 0) {
      this.say(run, 'done');
      yield* this.goHome(run, 'yard');
      return;
    }

    // ยังระแวง: คว้าอาหารแล้ววิ่งกลับไปกินในโพรง
    if (place === 'burrow') {
      this.say(run, 'eat', true);
      monster.speedMultiplier = rules.runSpeedMultiplier;
      yield* this.goHome(run, 'yard');
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
      if (meal.cleared) {
        monster.sparkles();
        this.speak(run, t(`monster.${id}.clear` as TextKey));
        eventBus.emit('notice-text', `${t('monster.cleared_notice')}${info.floor}${t('monster.cleared_notice_end')}`);
        yield { kind: 'ms', left: CLEAR_PAUSE_MS };
      }
      yield { kind: 'ms', left: rules.eatGapMs };
    }
    this.say(run, 'done');
    yield { kind: 'ms', left: rules.eatGapMs };
    if (run.spot !== null) this.spotsTaken.delete(run.spot);
    run.spot = null;
    yield* this.goHome(run, place);
  }
}

