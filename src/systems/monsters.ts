import { createRng, type Rng } from '../core/rng';
import type { TextKey } from '../core/i18n';
import type { Affection, Arrival, ArrivalKind, Monsters, Twins, World } from '../core/state';
import balance from '../data/balance.json';
import monstersJson from '../data/monsters.json';
import type { MonsterData } from '../data/schema';
import { parseDish, recipes } from './cooking';
import { applyTransaction } from './economy';
import { toppingAffectionFactor } from './toppings';
import { isSet, parseSet, setCombo, setTable, tableSlots, withTableSlot } from './sets';
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

export const newTwins = (): Twins => ({ revealed: false, revealDay: 0, quizWon: false });
export const newMonsters = (): Monsters => ({ affection: {}, plannedDay: 0, arrivals: [], twins: newTwins(), tasted: {} });

/** จำว่าเคยเสิร์ฟเมนูนี้ให้ตัวนี้แล้ว (หยิบกินหรืองอน) อัลบั้มจะได้เปิดรสนิยมข้อนั้น */
export function noteTasted(world: World, id: string, recipe: string): World {
  const known = world.monsters.tasted[id] ?? [];
  if (known.includes(recipe)) return world;
  return { ...world, monsters: { ...world.monsters, tasted: { ...world.monsters.tasted, [id]: [...known, recipe] } } };
}

/** รสนิยมข้อนี้ผู้เล่นรู้แล้วหรือยัง: เคยเสิร์ฟเมนูนั้น หรือจีโอเล่าในข่าว (เมนูโปรด เครื่องดื่มโปรด) */
export function tasteKnown(world: World, id: string, recipe: string): boolean {
  if ((world.monsters.tasted[id] ?? []).includes(recipe)) return true;
  const monster = monsterTable[id];
  if (!monster) return false;
  return world.gio.tips.some(
    (tip) =>
      tip.monster === id &&
      ((tip.kind === 'favourite' && monster.favourite.includes(recipe)) ||
        (tip.kind === 'drink' && monster.favouriteDrink === recipe) ||
        (tip.kind === 'signature' && monster.signature.recipe === recipe)),
  );
}

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
  if (monster.favourite.includes(recipe) || monster.favouriteDrink === recipe) return 'favourite';
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

/** เคยมาเยี่ยมแล้ว: มีความชอบ เคยได้กินหรืองอน หรือเคยโผล่มาแล้ว */
export const hasMet = (world: World, id: string): boolean =>
  world.monsters.affection[id] !== undefined ||
  (world.monsters.tasted[id]?.length ?? 0) > 0 ||
  world.monsters.arrivals.some((arrival) => arrival.monster === id && arrival.done);

/** มอนสเตอร์ครู (สเปก 8.1): ความชอบถึงขั้นแล้วสอนสูตรที่ยังไม่รู้ ครั้งเดียว */
export function teachRecipes(world: World, id: string): { world: World; taught: string[] } {
  const lessons = monsterTable[id]?.teaches ?? [];
  if (lessons.length === 0) return { world, taught: [] };
  const share = affectionOf(world, id).points / requiredPoints(id);
  const taught = lessons.filter((lesson) => share >= lesson.at && !world.recipes.known.includes(lesson.recipe)).map((lesson) => lesson.recipe);
  if (taught.length === 0) return { world, taught };
  return { world: { ...world, recipes: { ...world.recipes, known: [...world.recipes.known, ...taught] } }, taught };
}

/** เปอร์เซ็นต์ที่แสดง ก่อนได้เมนูประจำใจหยุดที่ 90% */
export function affectionPercent(world: World, id: string): number {
  return Math.min(PERCENT, (affectionOf(world, id).points / requiredPoints(id)) * PERCENT);
}

export const isCleared = (world: World, id: string): boolean => {
  const affection = affectionOf(world, id);
  return affection.signature && affection.points >= requiredPoints(id) - EPSILON;
};

/** ถึง 90% แล้วยังไม่ได้กินเมนูประจำใจ จะขอเมนูนั้น · แฝดน้องขอหลังหลอดสลับแล้วเท่านั้น จะได้ไม่หลุดปริศนา */
export function wantsSignature(world: World, id: string): boolean {
  const twinOf = monsterTable[id]?.twinOf;
  if (twinOf && !isCleared(world, twinOf)) return false;
  return !affectionOf(world, id).signature && affectionOf(world, id).points >= requiredPoints(id) * rules.signatureAt - EPSILON;
}

export const signatureOf = (id: string): { recipe: string; stars: number } => info(id).signature;

export const isSignatureDish = (id: string, item: string): boolean => {
  const parts = parseSet(item);
  if (parts) return parts.dishes.some((dish) => isSignatureDish(id, dish));
  const { recipe, stars } = parseDish(item);
  const wanted = info(id).signature;
  return recipe === wanted.recipe && stars >= wanted.stars;
};

/** สูตรของทุกจานในของชิ้นนี้ (ชุดมีหลายจาน อาหารจานเดียวมีสูตรเดียว) */
export const recipesIn = (item: string): string[] => (parseSet(item)?.dishes ?? [item]).map((dish) => parseDish(dish).recipe);

/** รสนิยมต่อชุด: มีเมนูโปรดอย่างน้อย 1 จานเป็นโปรด · มีเมนูที่ชอบเป็นชอบ · ไม่มีเลยไม่หยิบ (ผู้ใช้เลือก 9 พ.ย. 2026) */
function setTaste(id: string, item: string): Taste {
  const tastes = recipesIn(item).map((recipe) => tasteOf(id, recipe));
  if (tastes.includes('favourite')) return 'favourite';
  if (tastes.includes('like')) return 'like';
  return tastes.every((taste) => taste === 'belowRank') ? 'belowRank' : 'dislike';
}

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

/**
 * ความชอบจากของชิ้นนี้ · อาหาร: ท็อปปิ้งถูกประเภทเพิ่มเป็นขั้นเดียวกับราคา ท็อปปิ้งที่ชอบคูณเพิ่มอีกชั้น
 * ชุด: รวมทุกจานตามรสนิยมของแต่ละจาน ชุดคอมโบคูณเพิ่ม (สเปก 6.3) จานที่จะอ้วกไม่ลดความชอบ
 */
function itemPoints(world: World, id: string, item: string, eatenBefore: number): number {
  const parts = parseSet(item);
  if (parts) {
    const total = parts.dishes.reduce((sum, dish) => sum + itemPoints(world, id, dish, 0), 0);
    return total * (setCombo(item) ? setTable.comboAffection : 1);
  }
  const { recipe, stars } = parseDish(item);
  return dishPoints(id, recipe, stars, eatenBefore, world.gauges.cleanliness) * toppingAffectionFactor(item, id);
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
  const cap = affection.signature ? required : required * rules.signatureAt;
  const gained = itemPoints(world, id, item, eatenBefore);
  const points = Math.min(cap, affection.points + gained);
  return { world: put({ ...affection, points }), points: points - affection.points, signature: false, cleared: false };
}

const isDrink = (recipe: string): boolean => recipes[recipe]?.category === 'drink';

/** เพิ่มความชอบโดยไม่เกินเพดาน (90% ก่อนได้เมนูประจำใจ) ใช้กับโบนัสเซ็ต */
function addPoints(world: World, id: string, amount: number): { world: World; added: number } {
  const affection = affectionOf(world, id);
  const required = requiredPoints(id);
  if (isCleared(world, id) || amount <= 0) return { world, added: 0 };
  const cap = affection.signature ? required : required * rules.signatureAt;
  const points = Math.min(cap, affection.points + amount);
  const next = { ...world, monsters: { ...world.monsters, affection: { ...world.monsters.affection, [id]: { ...affection, points } } } };
  return { world: next, added: points - affection.points };
}

// ---------- แฝดขี้แกล้งชั้น 5 (GDD) ----------
const twinRule = rules.twins;

export const isTwin = (id: string): boolean => id === twinRule.a || id === twinRule.b;
export const twinA = twinRule.a;
export const twinB = twinRule.b;
/** พี่ครบ 100% แล้ว ประตูยังไม่เปิด หลอดสลับเป็นของน้อง */
export const twinsSwitched = (world: World): boolean => isCleared(world, twinRule.a);

/** ประตูชั้นของมอนสเตอร์ตัวนี้เปิดแล้ว: ครบ 100% · แฝดชั้น 5 เปิดหลังฉากเฉลยจบ */
export const floorOpen = (world: World, id: string): boolean => (isTwin(id) ? world.monsters.twins.revealed : isCleared(world, id));
/** น้องครบ 100% แล้วแต่ยังไม่ได้เล่นฉากเฉลย */
export const revealDue = (world: World): boolean => !world.monsters.twins.revealed && isCleared(world, twinRule.b);
/** เฉลยแล้วและทายถูกแล้ว ชั้น 5 ไม่มาเยี่ยมอีก */
const twinsDone = (world: World): boolean => world.monsters.twins.revealed && world.monsters.twins.quizWon;

/** หลอดความชอบที่แสดง ("100% หลอก"): ก่อนเฉลยแสดงของพี่ พี่ครบแล้วแสดงของน้องที่แอบสะสมไว้ */
export function barOwner(world: World, id: string): string {
  if (!isTwin(id) || world.monsters.twins.revealed) return id;
  return twinsSwitched(world) ? twinRule.b : twinRule.a;
}

/** ชื่อที่แสดง: ก่อนเฉลยทั้งคู่ชื่อหางกระดิ่ง หลังเฉลยเป็นหางกระดิ่งพี่กับหางกระดิ่งน้อง */
export function nameKey(world: World, id: string): TextKey {
  if (!isTwin(id)) return `monster.${id}.name` as TextKey;
  if (!world.monsters.twins.revealed) return `monster.${twinRule.a}.name` as TextKey;
  return (id === twinRule.a ? `monster.${twinRule.a}.name_revealed` : `monster.${twinRule.b}.name`) as TextKey;
}

/** บทพูดของแฝดน้องใช้ของพี่ (ปลอมตัวเป็นตัวเดียวกัน) */
export const voiceOf = (id: string): string => monsterTable[id]?.twinOf ?? id;

/**
 * ชั้น 5 ถูกสุ่มมาเยี่ยมแล้ว เลือกว่าใครมา: ก่อนหลอดสลับพี่หรือน้องอย่างละครึ่ง (ไม่มีวันมาพร้อมกัน)
 * หลังสลับส่วนใหญ่น้อง พี่แวะมาแกล้ง 1 ใน 5 · น้องครบแล้วเป็นฉากเฉลย · เฉลยแล้วแต่ยังทายไม่ถูก มาชวนทายใหม่
 */
export function twinArrival(world: World, rng: Rng): { monster: string; kind?: ArrivalKind } {
  const { a, b } = twinRule;
  if (world.monsters.twins.revealed) return { monster: a, kind: 'quiz' };
  if (isCleared(world, b)) return { monster: a, kind: 'reveal' };
  if (twinsSwitched(world)) return rng.next() < twinRule.teaseChance ? { monster: a, kind: 'tease' } : { monster: b };
  return { monster: rng.next() < twinRule.firstPick ? a : b };
}

/** น้องเพิ่งครบ 100% ระหว่างมาเยี่ยม: ฉากเฉลยตามมาทันทีหลังน้องกลับเข้าโพรง */
export function scheduleReveal(world: World): World {
  if (!revealDue(world) || world.monsters.arrivals.some((arrival) => arrival.kind === 'reveal' && !arrival.done)) return world;
  const arrival: Arrival = { monster: twinRule.a, day: world.day, hour: world.hour, done: false, kind: 'reveal' };
  return { ...world, monsters: { ...world.monsters, arrivals: [...world.monsters.arrivals, arrival] } };
}

/** ฉากเฉลยจบ ประตูชั้น 5 เปิด · ทายถูกได้กระดิ่งลมแฝด */
export function finishTwinScene(world: World, kind: 'reveal' | 'quiz', correct: boolean): World {
  const twins = world.monsters.twins;
  const next: Twins = {
    revealed: true,
    revealDay: kind === 'reveal' && !twins.revealed ? world.day : twins.revealDay,
    quizWon: twins.quizWon || correct,
  };
  return { ...world, monsters: { ...world.monsters, twins: next } };
}

/** แขกที่มาได้: อยู่ในโซนที่ปลดแล้ว ยังไม่ครบ 100% และมีภาพแล้ว (ตัวที่ยังไม่มีภาพรอจนกว่าฝั่งวางแผนส่งมา) · ชั้น 5 นับเป็นตัวเดียว (พี่) จนกว่าแฝดจะจบครบ */
export function eligibleMonsters(world: World): string[] {
  return Object.entries(monsterTable)
    .filter(([id, monster]) => monster.zone <= rules.unlockedZones && monster.art !== null && !monster.twinOf && (isTwin(id) ? !twinsDone(world) : !isCleared(world, id)))
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
  const chosen = shuffle(eligibleMonsters(world), rng)
    .slice(0, count)
    .map((monster) => (isTwin(monster) ? twinArrival(world, rng) : { monster }));
  const span = (rules.visitToHour - rules.visitFromHour) / Math.max(1, chosen.length);
  return chosen
    .map((pick, index) => ({ ...pick, day, hour: rules.visitFromHour + span * (index + rng.next() * ARRIVAL_SPREAD), done: false }))
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
  const first = eligibleMonsters(world)[0];
  if (!first) return null;
  const pick = isTwin(first) ? twinArrival(world, createRng(world.seed + world.day * VISIT_MIX + Math.round(world.hour * 60))) : { monster: first };
  const arrival: Arrival = { ...pick, day: world.day, hour: world.hour, done: false };
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
    const taste = isSet(plate!.item) ? setTaste(id, plate!.item) : tasteOf(id, parseDish(plate!.item).recipe);
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
  // มีทั้งเมนูโปรดและเครื่องดื่มโปรด: อาหารเป็นหอคอยแต่เว้นที่ไว้ 1 แก้วให้ครบเซ็ต "เข้ากันสุดๆ!"
  const food = favourites.filter((entry) => isSet(entry.item) || !isDrink(parseDish(entry.item).recipe));
  const drink = favourites.filter((entry) => !isSet(entry.item) && isDrink(parseDish(entry.item).recipe));
  const pairing = food.length > 0 && drink.length > 0;
  for (const entry of food) {
    // ชุดหยิบครั้งละ 1 ชุด นับเป็น 1 ที่
    const count = isSet(entry.item) ? Math.min(1, appetite) : Math.min(appetite - (pairing ? 1 : 0), tower, entry.count);
    if (count > 0) takes.push({ plate: entry.index, item: entry.item, count, reaction: 'favourite' });
    appetite -= Math.max(0, count);
  }
  for (const entry of drink) {
    const count = Math.min(appetite, pairing ? 1 : tower, entry.count);
    if (count > 0) takes.push({ plate: entry.index, item: entry.item, count, reaction: 'favourite' });
    appetite -= Math.max(0, count);
  }
  for (const taste of ['like', 'neutral'] as const) {
    for (const entry of byTaste.get(taste) ?? []) {
      if (isSet(entry.item) && taste === 'neutral') continue;
      if (appetite <= 0) break;
      takes.push({ plate: entry.index, item: entry.item, count: 1, reaction: taste });
      appetite -= 1;
    }
  }
  return { takes, pouts, asks: asking && !signaturePlate ? signatureOf(id).recipe : null };
}

/** จานของโต๊ะใหญ่ในแผนการหยิบเป็นเลขติดลบ ช่อง 0 = −1 ช่อง 1 = −2 … (ถาดหอคอยใช้เลขจาน 0 ขึ้นไป) */
export const bigTablePlate = (slot: number): number => -1 - slot;
/** ช่องโต๊ะใหญ่ของจานนี้ หรือ null ถ้าเป็นจานถาดหอคอย */
export const tableSlotOf = (plate: number): number | null => (plate < 0 ? -1 - plate : null);

function removeFromBigTable(world: World, slot: number, item: string): { tray: World['tray']; sets: World['sets']; taken: number } {
  if (tableSlots(world)[slot] !== item) return { tray: world.tray, sets: world.sets, taken: 0 };
  return { tray: world.tray, sets: withTableSlot(world, slot, null), taken: 1 };
}

const TABLE_RANK = { signature: 0, favourite: 1, like: 2 } as const;

/**
 * ชุดบนโต๊ะใหญ่: หยิบด้วยกฎเดียวกับถาดหอคอย (มีจานที่ชอบอย่างน้อย 1 จาน) มาครั้งหนึ่งหยิบจากโต๊ะได้ 1 ชุด
 * เลือกชุดที่มีเมนูประจำใจก่อน แล้วชุดที่มีเมนูโปรด แล้วชุดที่ชอบ เท่ากันเอาช่องซ้ายก่อน ตอบสิ่งที่หยิบ หรือ null
 */
export function planBigTable(world: World, id: string, plan: VisitPlan): PlateTake | null {
  if (isCleared(world, id)) return null;
  const taken = plan.takes.reduce((sum, take) => sum + take.count, 0);
  if (taken >= rules.appetiteMax) return null;
  let best: PlateTake | null = null;
  for (const [slot, item] of tableSlots(world).entries()) {
    if (!item) continue;
    const reaction = wantsSignature(world, id) && isSignatureDish(id, item) ? 'signature' : setTaste(id, item);
    if (reaction !== 'signature' && reaction !== 'favourite' && reaction !== 'like') continue;
    if (best && TABLE_RANK[best.reaction as keyof typeof TABLE_RANK] <= TABLE_RANK[reaction]) continue;
    best = { plate: bigTablePlate(slot), item, count: 1, reaction };
  }
  return best;
}

/** สิ่งที่จำไว้ระหว่างการมาครั้งหนึ่ง: จานที่กินต่อเมนู (ความหลากหลาย) และความชอบจากเมนูโปรดกับเครื่องดื่มโปรดที่ใช้คิดโบนัสเซ็ต */
export interface VisitMemo {
  eaten: Record<string, number>;
  favouriteFood: number | null;
  favouriteDrink: number | null;
  set: boolean;
}

export const newVisitMemo = (): VisitMemo => ({ eaten: {}, favouriteFood: null, favouriteDrink: null, set: false });

export interface Taken {
  world: World;
  /** ความชอบที่ได้ต่อที่ ตามลำดับที่กิน */
  gains: number[];
  taken: number;
  cleared: boolean;
  /** จานนี้ทำให้ครบเซ็ตเมนูโปรดกับเครื่องดื่มโปรด (ครั้งแรกของการมาครั้งนี้) ขึ้นคำว่า "เข้ากันสุดๆ!" แม้ความชอบชนเพดานแล้ว */
  set: boolean;
  /** ความชอบที่ได้เพิ่มจากโบนัสเซ็ต (ชนเพดาน 90% อาจเป็น 0) */
  setBonus: number;
  /** สูตรที่มอนสเตอร์ครูสอนเพราะความชอบถึงขั้นตอนหยิบครั้งนี้ */
  taught: string[];
}

/** หยิบจากจานแล้วกินทีละที่ ความชอบเข้าทันที (ภาพค่อย ๆ เล่นตามทีหลัง) · ครบเซ็ตครั้งแรกได้โบนัส (setBonus − 1) × ความชอบของคู่นั้น */
export function takePlate(world: World, id: string, take: PlateTake, memo: VisitMemo): Taken {
  const slot = tableSlotOf(take.plate);
  const removed = slot !== null ? removeFromBigTable(world, slot, take.item) : { ...removeFromPlate(world.tray, take.plate, take.item, take.count), sets: world.sets };
  const recipe = isSet(take.item) ? take.item : parseDish(take.item).recipe;
  let next: World = { ...world, tray: removed.tray, sets: removed.sets };
  if (removed.taken > 0) for (const tasted of recipesIn(take.item)) next = noteTasted(next, id, tasted);
  const gains: number[] = [];
  let cleared = false;
  for (let serving = 0; serving < removed.taken; serving += 1) {
    const fed = feed(next, id, take.item, memo.eaten[recipe] ?? 0);
    next = fed.world;
    gains.push(fed.points);
    cleared ||= fed.cleared;
    memo.eaten[recipe] = (memo.eaten[recipe] ?? 0) + 1;
    if (take.reaction === 'favourite' && !isSet(take.item)) {
      if (isDrink(recipe)) memo.favouriteDrink ??= fed.points;
      else memo.favouriteFood ??= fed.points;
    }
  }
  let setBonus = 0;
  let set = false;
  if (!memo.set && memo.favouriteFood !== null && memo.favouriteDrink !== null) {
    memo.set = true;
    set = true;
    const added = addPoints(next, id, (rules.setBonus - 1) * (memo.favouriteFood + memo.favouriteDrink));
    next = added.world;
    setBonus = added.added;
  }
  const lesson = teachRecipes(next, id);
  return { world: lesson.world, gains, taken: removed.taken, cleared, set, setBonus, taught: lesson.taught };
}

/** ที่กินตามความชอบตอนมาถึง: ยังระแวงคว้าแล้ววิ่งกลับโพรง · กลางนั่งกินใกล้โพรง · สนิทนั่งกินที่ลานหน้าบ้าน (ร้านยังไม่เปิด) */
export type EatPlace = 'burrow' | 'nearBurrow' | 'yard';
export function eatPlaceFor(world: World, id: string): EatPlace {
  const tier = tierOf(world, id);
  if (tier === 'hungry') return 'burrow';
  return tier === 'warm' ? 'nearBurrow' : 'yard';
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
    // แฝดแวะมาแกล้ง ฉากเฉลย และชวนทายไม่กินจากถาด ฉากเฉลยที่ไม่ได้เห็นยังรออยู่ ชั้น 5 ครั้งหน้าจะเป็นฉากเฉลย
    if (arrival.kind || isCleared(next, arrival.monster)) return;
    const memo = newVisitMemo();
    const plan = planVisit(next, arrival.monster, createRng(world.seed + arrival.day * SETTLE_MIX + index));
    for (const plate of plan.pouts) {
      const item = next.tray.plates[plate]?.item;
      if (item) for (const recipe of recipesIn(item)) next = noteTasted(next, arrival.monster, recipe);
    }
    for (const take of plan.takes) {
      next = takePlate(next, arrival.monster, take, memo).world;
    }
    const table = planBigTable(next, arrival.monster, plan);
    if (table) next = takePlate(next, arrival.monster, table, memo).world;
  });
  // แขกของวันก่อน ๆ ไม่ต้องเก็บไว้แล้ว
  return { ...next, monsters: { ...next.monsters, arrivals: next.monsters.arrivals.filter((arrival) => arrival.day >= world.day) } };
}
