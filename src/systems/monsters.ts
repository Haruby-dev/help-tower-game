import { createRng, type Rng } from '../core/rng';
import type { Affection, Arrival, Monsters, World } from '../core/state';
import balance from '../data/balance.json';
import monstersJson from '../data/monsters.json';
import type { MonsterData } from '../data/schema';
import { parseDish, recipes } from './cooking';
import { applyTransaction } from './economy';
import { removeFromPlate } from './tray';

export const monsterTable = monstersJson as MonsterData;
const rules = balance.monsters;
const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
/** สุ่มแขกของวันจาก seed ของเซฟกับวันที่ เปิดเกมใหม่ก็ได้แขกชุดเดิม */
const VISIT_MIX = 6007;
const SETTLE_MIX = 911;
/** แบ่งช่วงเวลามาเยี่ยมเป็นช่องเท่า ๆ กัน แต่ละตัวมาตอนสุ่มในช่องของตัวเอง ไม่ชิดท้ายช่องเกินไป */
const ARRIVAL_SPREAD = 0.8;
const PERCENT = 100;
const EPSILON = 1e-9;

export type Taste = 'favourite' | 'like' | 'neutral' | 'dislike' | 'belowRank';
export type Tier = 'hungry' | 'warm' | 'close';

export const newMonsters = (): Monsters => ({ affection: {}, plannedDay: 0, arrivals: [] });

/** รหัสแขกแต่ละครั้ง ฉากใช้จำว่าตัวไหนออกมาแล้ว */
export const arrivalKey = (arrival: Arrival): string => `${arrival.day}:${arrival.hour.toFixed(4)}:${arrival.monster}`;

function info(id: string): MonsterData[string] {
  const monster = monsterTable[id];
  if (!monster) throw new Error(`unknown monster ${id}`);
  return monster;
}

/** รสนิยมต่อเมนูนี้ เมนูแรงก์ต่ำกว่าขั้นต่ำของโซนนับเป็นไม่ชอบ (×0) */
export function tasteOf(id: string, recipe: string): Taste {
  const monster = info(id);
  if (monster.dislikes.includes(recipe)) return 'dislike';
  const rank = recipes[recipe]?.rank;
  const minimum = rules.minRankByZone[monster.zone - 1] ?? 'F';
  if (!rank || RANKS.indexOf(rank) < RANKS.indexOf(minimum)) return 'belowRank';
  if (monster.favourite.includes(recipe)) return 'favourite';
  if (monster.likes.includes(recipe)) return 'like';
  return 'neutral';
}

const tasteMultiplier = (taste: Taste): number => (taste === 'belowRank' ? 0 : rules.taste[taste]);

/** ตัวคูณความสะอาดของตัวเอก ตามโบนัสและบทลงโทษของเกจ (70 ขึ้นไป ×1.1 · 30 ลงไป ×0.8) */
export function cleanMultiplier(cleanliness: number): number {
  if (cleanliness >= rules.clean.goodFrom) return rules.clean.good;
  if (cleanliness <= rules.clean.badAtOrBelow) return rules.clean.bad;
  return 1;
}

/**
 * ความชอบที่ได้ = ค่าฐานแรงก์ × รสนิยม × ความหลากหลาย × ดาว × ความสะอาด (GDD)
 * eatenBefore คือจำนวนจานเมนูนี้ที่ตัวนี้กินไปแล้วในการมาครั้งนี้ · เครื่องดื่มค่าฐานน้อยกว่าอาหาร
 */
export function dishPoints(id: string, recipe: string, stars: number, eatenBefore: number, cleanliness: number): number {
  const info = recipes[recipe];
  if (!info) return 0;
  const base = (rules.rankBase[info.rank as keyof typeof rules.rankBase] ?? 0) * (info.category === 'drink' ? rules.drinkBaseShare : 1);
  const variety = rules.variety[Math.min(eatenBefore, rules.variety.length - 1)]!;
  const star = rules.starMultiplier[Math.min(Math.max(stars, 1), rules.starMultiplier.length) - 1]!;
  return base * tasteMultiplier(tasteOf(id, recipe)) * variety * star * cleanMultiplier(cleanliness);
}

export const affectionOf = (world: World, id: string): Affection => world.monsters.affection[id] ?? { points: 0, signature: false };

export const requiredPoints = (id: string): number => info(id).points;

/** เปอร์เซ็นต์ที่แสดง ก่อนได้เมนูประจำใจหยุดที่ 90% */
export function affectionPercent(world: World, id: string): number {
  return Math.min(PERCENT, (affectionOf(world, id).points / requiredPoints(id)) * PERCENT);
}

export const isCleared = (world: World, id: string): boolean => {
  const affection = affectionOf(world, id);
  return affection.signature && affection.points >= requiredPoints(id) - EPSILON;
};

/** ถึง 90% แล้วยังไม่ได้กินเมนูประจำใจ จะขอเมนูนั้น */
export const wantsSignature = (world: World, id: string): boolean =>
  !affectionOf(world, id).signature && affectionOf(world, id).points >= requiredPoints(id) * rules.signatureAt - EPSILON;

export const signatureOf = (id: string): { recipe: string; stars: number } => info(id).signature;

export const isSignatureDish = (id: string, item: string): boolean => {
  const { recipe, stars } = parseDish(item);
  const wanted = info(id).signature;
  return recipe === wanted.recipe && stars >= wanted.stars;
};

/** ระดับความชอบที่ใช้เลือกบทพูด: หิว (พูดห้วน) · อุ่น (สุภาพ) · สนิท (เรียกว่าเชฟ) */
export function tierOf(world: World, id: string): Tier {
  const percent = affectionPercent(world, id);
  if (percent >= rules.closeFrom) return 'close';
  return percent >= rules.warmFrom ? 'warm' : 'hungry';
}

export interface Fed {
  world: World;
  points: number;
  signature: boolean;
  cleared: boolean;
}

/** กินอาหาร 1 ที่ · ก่อนได้เมนูประจำใจความชอบหยุดที่ 90% · ได้เมนูประจำใจตอนขอจึงครบ 100% และได้ดาวน้ำตาลเป็นรางวัล */
export function feed(world: World, id: string, item: string, eatenBefore: number): Fed {
  const affection = affectionOf(world, id);
  const required = requiredPoints(id);
  if (isCleared(world, id)) return { world, points: 0, signature: false, cleared: false };
  const put = (next: Affection): World => ({ ...world, monsters: { ...world.monsters, affection: { ...world.monsters.affection, [id]: next } } });
  if (wantsSignature(world, id) && isSignatureDish(id, item)) {
    const done = put({ points: required, signature: true });
    const rewarded = rules.clearStars > 0 ? applyTransaction(done, 'stars', rules.clearStars, 'wallet.monster_clear', 'wallet.category_monster') : done;
    return { world: rewarded, points: required - affection.points, signature: true, cleared: true };
  }
  const { recipe, stars } = parseDish(item);
  const cap = affection.signature ? required : required * rules.signatureAt;
  const gained = dishPoints(id, recipe, stars, eatenBefore, world.gauges.cleanliness);
  const points = Math.min(cap, affection.points + gained);
  return { world: put({ ...affection, points }), points: points - affection.points, signature: false, cleared: false };
}

/** แขกที่มาได้: อยู่ในโซนที่ปลดแล้ว ยังไม่ครบ 100% และมีภาพแล้ว (ตัวที่ยังไม่มีภาพรอจนกว่าฝั่งวางแผนส่งมา) */
export function eligibleMonsters(world: World): string[] {
  return Object.entries(monsterTable)
    .filter(([id, monster]) => monster.zone <= rules.unlockedZones && monster.art !== null && !isCleared(world, id))
    .sort((a, b) => a[1].floor - b[1].floor)
    .map(([id]) => id);
}

/** จำนวนแขกพรุ่งนี้ = 1 + (ของที่ขายได้วันนี้ ÷ 4 ปัดลง) สูงสุด 6 ตัว */
export const visitorCount = (sold: number): number => Math.min(rules.maxVisitors, rules.visitorsBase + Math.floor(sold / rules.soldPerVisitor));

function shuffle<T>(items: T[], rng: Rng): T[] {
  const pool = [...items];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng.next() * (index + 1));
    [pool[index], pool[other]] = [pool[other]!, pool[index]!];
  }
  return pool;
}

/** แขกหนึ่งวัน เวลามากระจายตลอดช่วง 12:00–20:00 แต่ละตัวต่างกัน */
export function arrivalsFor(world: World, day: number, count: number): Arrival[] {
  const rng = createRng(world.seed + day * VISIT_MIX);
  const chosen = shuffle(eligibleMonsters(world), rng).slice(0, count);
  const span = (rules.visitToHour - rules.visitFromHour) / Math.max(1, chosen.length);
  return chosen
    .map((monster, index) => ({ monster, day, hour: rules.visitFromHour + span * (index + rng.next() * ARRIVAL_SPREAD), done: false }))
    .sort((a, b) => a.hour - b.hour);
}

/** จีโอกลับจากเร่ขายแล้ว มอนสเตอร์ที่ได้กลิ่นอาหารจะมาวันถัดไป ตามจำนวนของที่ขายได้ · เรียกซ้ำได้ ไม่วางแผนซ้ำ */
export function planVisits(world: World): World {
  const report = world.gio.report;
  if (!report) return world;
  const day = report.day + 1;
  if (world.day > day || world.monsters.plannedDay >= day) return world;
  const sold = report.sold.reduce((sum, stack) => sum + stack.count, 0);
  const arrivals = [...world.monsters.arrivals, ...arrivalsFor(world, day, visitorCount(sold))];
  return { ...world, monsters: { ...world.monsters, plannedDay: day, arrivals } };
}

/** แขกที่ถึงเวลามาแล้วและยังไม่ได้มา */
export const dueArrivals = (world: World): Arrival[] =>
  world.monsters.arrivals.filter((arrival) => arrival.day === world.day && !arrival.done && arrival.hour <= world.hour);

export function markArrived(world: World, key: string): World {
  const arrivals = world.monsters.arrivals.map((arrival) => (arrivalKey(arrival) === key ? { ...arrival, done: true } : arrival));
  return { ...world, monsters: { ...world.monsters, arrivals } };
}

/** ปุ่มทดสอบ: มอนสเตอร์ที่มาได้ตัวแรกมาเยี่ยมตอนนี้เลย ตอบ null เมื่อไม่มีตัวไหนมาได้ */
export function summonNow(world: World): World | null {
  const monster = eligibleMonsters(world)[0];
  if (!monster) return null;
  const arrival: Arrival = { monster, day: world.day, hour: world.hour, done: false };
  return { ...world, monsters: { ...world.monsters, arrivals: [...world.monsters.arrivals, arrival] } };
}

export type Reaction = 'signature' | 'favourite' | 'like' | 'neutral';

export interface PlateTake {
  plate: number;
  item: string;
  count: number;
  reaction: Reaction;
}

export interface VisitPlan {
  takes: PlateTake[];
  /** จานที่ไม่ชอบหรือแรงก์ต่ำกว่าขั้นต่ำ ทำหน้างอนแล้วเดินผ่าน */
  pouts: number[];
  /** ถึง 90% แต่ไม่มีเมนูประจำใจบนถาด จะบอกว่าอยากกินอะไร */
  asks: string | null;
}

const between = (rng: Rng, min: number, max: number): number => min + Math.floor(rng.next() * (max - min + 1));

/**
 * ตัดสินใจครั้งเดียวตอนถึงถาด หยิบ 1–5 ที่ เมนูประจำใจ (ตอนขอ) ก่อน แล้วเมนูโปรดเป็นหอคอย 3–5 ที่ แล้วเมนูที่ชอบ จานละ 1 ที่ แล้วเมนูเฉย ๆ
 * มีเมนูโปรดบนถาด ความอยากกินอย่างน้อยเท่าขนาดหอคอย แต่ไม่เกิน 5 ที่ตาม GDD
 */
export function planVisit(world: World, id: string, rng: Rng): VisitPlan {
  const plates = world.tray.plates.map((plate, index) => ({ plate, index })).filter((entry) => entry.plate !== null);
  const pouts: number[] = [];
  const byTaste = new Map<Taste, { index: number; item: string; count: number }[]>();
  let signaturePlate: { index: number; item: string } | null = null;
  const asking = wantsSignature(world, id);
  for (const { plate, index } of plates) {
    if (asking && signaturePlate === null && isSignatureDish(id, plate!.item)) {
      signaturePlate = { index, item: plate!.item };
      continue;
    }
    const taste = tasteOf(id, parseDish(plate!.item).recipe);
    if (taste === 'dislike' || taste === 'belowRank') pouts.push(index);
    else byTaste.set(taste, [...(byTaste.get(taste) ?? []), { index, item: plate!.item, count: plate!.count }]);
  }
  let appetite = between(rng, rules.appetiteMin, rules.appetiteMax);
  const favourites = byTaste.get('favourite') ?? [];
  const tower = favourites.length > 0 ? between(rng, rules.towerMin, rules.towerMax) : 0;
  appetite = Math.min(rules.appetiteMax, Math.max(appetite, tower));
  const takes: PlateTake[] = [];
  if (signaturePlate) {
    takes.push({ plate: signaturePlate.index, item: signaturePlate.item, count: 1, reaction: 'signature' });
    appetite -= 1;
  }
  for (const entry of favourites) {
    const count = Math.min(appetite, tower, entry.count);
    if (count > 0) takes.push({ plate: entry.index, item: entry.item, count, reaction: 'favourite' });
    appetite -= count;
  }
  for (const taste of ['like', 'neutral'] as const) {
    for (const entry of byTaste.get(taste) ?? []) {
      if (appetite <= 0) break;
      takes.push({ plate: entry.index, item: entry.item, count: 1, reaction: taste });
      appetite -= 1;
    }
  }
  return { takes, pouts, asks: asking && !signaturePlate ? signatureOf(id).recipe : null };
}

export interface Taken {
  world: World;
  /** ความชอบที่ได้ต่อที่ ตามลำดับที่กิน */
  gains: number[];
  taken: number;
  cleared: boolean;
}

/** หยิบจากจานแล้วกินทีละที่ ความชอบเข้าทันที (ภาพค่อย ๆ เล่นตามทีหลัง) · eaten นับจานต่อเมนูในการมาครั้งนี้ */
export function takePlate(world: World, id: string, take: PlateTake, eaten: Record<string, number>): Taken {
  const removed = removeFromPlate(world.tray, take.plate, take.item, take.count);
  let next: World = { ...world, tray: removed.tray };
  const gains: number[] = [];
  let cleared = false;
  const recipe = parseDish(take.item).recipe;
  for (let serving = 0; serving < removed.taken; serving += 1) {
    const fed = feed(next, id, take.item, eaten[recipe] ?? 0);
    next = fed.world;
    gains.push(fed.points);
    cleared ||= fed.cleared;
    eaten[recipe] = (eaten[recipe] ?? 0) + 1;
  }
  return { world: next, gains, taken: removed.taken, cleared };
}

/** แขกที่ไม่ได้มาให้เห็น (เป็นลมข้ามเวลา นอนก่อน หรือเลยเวลา) กินจากถาดเองโดยไม่มีภาพ */
export function settleVisits(world: World): World {
  const stale = (arrival: Arrival): boolean => arrival.day < world.day || (arrival.day === world.day && world.hour >= rules.settleAfterHour);
  const old = world.monsters.arrivals.some((arrival) => arrival.day < world.day);
  if (!old && !world.monsters.arrivals.some((arrival) => !arrival.done && stale(arrival))) return world;
  let next = world;
  world.monsters.arrivals.forEach((arrival, index) => {
    if (arrival.done || !stale(arrival)) return;
    next = markArrived(next, arrivalKey(arrival));
    if (isCleared(next, arrival.monster)) return;
    const eaten: Record<string, number> = {};
    for (const take of planVisit(next, arrival.monster, createRng(world.seed + arrival.day * SETTLE_MIX + index)).takes) {
      next = takePlate(next, arrival.monster, take, eaten).world;
    }
  });
  // แขกของวันก่อน ๆ ไม่ต้องเก็บไว้แล้ว
  return { ...next, monsters: { ...next.monsters, arrivals: next.monsters.arrivals.filter((arrival) => arrival.day >= world.day) } };
}
