import type { Rng } from '../core/rng';
import type { DryingSlot, World } from '../core/state';
import type { Recipe, Stations } from '../data/schema';
import stationsJson from '../data/stations.json';
import { baseDishStars, dishItem, firstStock, maxTimes, minutesFor, recipes, takeIngredients } from './cooking';
import { addToBag } from './farm';
import { spendMinutes } from './gauges';

/**
 * สถานีแปรรูป (งานอาหารโซน 1 ขั้นที่ 5 · สเปกข้อ 5)
 * ถาดตาก: ถาดละ 1 ชนิด ไม่เกิน 10 ชิ้น ตากได้ทั้งวัน (ผู้ใช้เลือก 9 พ.ย. 2026) เก็บได้วันถัดไป 06:00
 * ลอบ: วางในน้ำได้ตั้งแต่ 17:00 (ผู้ใช้เลือก) เก็บเช้าวันถัดไป ได้ 1 ตัวต่อลอบต่อคืน กุ้ง 70% ปู 30% อากาศไม่มีผล
 * ครกหินเก่า: มินิเกมตำ ดาวของมินิเกมใช้กับอาหารเท่านั้น (ผู้ใช้เลือก) ลูกชิ้นกับผงได้จำนวนเท่าเดิมเสมอ
 */
export const stationTable = stationsJson as Stations;
const { drying, trap, mortar } = stationTable;

/** ของที่วางไว้ตั้งแต่วัน day ถึงเวลาเก็บแล้วหรือยัง (วันถัดไปตั้งแต่ readyHour) */
const readyAfterNight = (world: World, day: number, readyHour: number): boolean => world.day > day + 1 || (world.day > day && world.hour >= readyHour);

// ---------- ถาดตาก ----------

export const dryingSlot = (world: World, index: number): DryingSlot | null => world.crafting.drying[index] ?? null;

export const isDryingReady = (world: World, index: number): boolean => {
  const slot = dryingSlot(world, index);
  return slot !== null && readyAfterNight(world, slot.day, drying.readyHour);
};

/** ตากได้มากสุดกี่ชิ้น (ไม่เกิน 10 และไม่เกินของที่มี) */
export const maxDrying = (world: World, recipe: string): number => {
  const info = drying.recipes[recipe];
  return info ? Math.min(drying.maxPieces, maxTimes(world.bag, info.in)) : 0;
};

/** วางของตากบนถาดใบที่ index หยิบของจากกระเป๋าทันที ตอบ null เมื่อถาดไม่ว่างหรือของไม่พอ */
export function startDrying(world: World, index: number, recipe: string, count: number): World | null {
  const info = drying.recipes[recipe];
  if (!info || index >= world.crafting.stations.drying_tray || dryingSlot(world, index)) return null;
  if (!Number.isInteger(count) || count < 1 || count > maxDrying(world, recipe)) return null;
  const first = Object.keys(info.in)[0]!;
  const shows = firstStock(world.bag, first);
  const bag = takeIngredients(world.bag, info.in, count);
  if (!bag) return null;
  const slots = [...world.crafting.drying];
  while (slots.length <= index) slots.push(null);
  slots[index] = { recipe, count, day: world.day, shows };
  return { ...world, bag, crafting: { ...world.crafting, drying: slots } };
}

/** เก็บของแห้งจากถาดใบที่ index ตอบ null เมื่อยังไม่แห้งหรือกระเป๋าเต็ม (ของรออยู่บนถาด) */
export function collectDrying(world: World, index: number): { world: World; item: string; count: number } | null {
  const slot = dryingSlot(world, index);
  if (!slot || !isDryingReady(world, index)) return null;
  const item = drying.recipes[slot.recipe]!.out;
  const bag = addToBag(world.bag, item, slot.count);
  if (!bag) return null;
  const slots = world.crafting.drying.map((entry, at) => (at === index ? null : entry));
  return { world: { ...world, bag, crafting: { ...world.crafting, drying: slots } }, item, count: slot.count };
}

// ---------- ลอบ ----------

export const trapSet = (world: World, index: number): { day: number } | null => world.crafting.traps[index] ?? null;

export const canSetTrap = (world: World): boolean => world.hour >= trap.fromHour;

export const isTrapReady = (world: World, index: number): boolean => {
  const set = trapSet(world, index);
  return set !== null && readyAfterNight(world, set.day, trap.readyHour);
};

/** วางลอบใบที่ index ลงน้ำ ได้ตั้งแต่ 17:00 */
export function setTrap(world: World, index: number): World | null {
  if (index >= world.crafting.stations.trap || trapSet(world, index) || !canSetTrap(world)) return null;
  const traps = [...world.crafting.traps];
  while (traps.length <= index) traps.push(null);
  traps[index] = { day: world.day };
  return { ...world, crafting: { ...world.crafting, traps } };
}

/** สุ่มของในลอบ กุ้ง 70% ปู 30% */
export function trapCatch(rng: Rng): string {
  const total = trap.catch.reduce((sum, entry) => sum + entry.chance, 0);
  let roll = rng.next() * total;
  for (const entry of trap.catch) {
    roll -= entry.chance;
    if (roll < 0) return entry.item;
  }
  return trap.catch[trap.catch.length - 1]!.item;
}

/** ยกลอบขึ้นฝั่ง ได้ 1 ตัว ตอบ null เมื่อยังไม่ถึงเช้าหรือกระเป๋าเต็ม (ลอบยังอยู่ในน้ำ) */
export function collectTrap(world: World, index: number, rng: Rng): { world: World; item: string } | null {
  if (!isTrapReady(world, index)) return null;
  const item = trapCatch(rng);
  const bag = addToBag(world.bag, item, 1);
  if (!bag) return null;
  const traps = world.crafting.traps.map((entry, at) => (at === index ? null : entry));
  return { world: { ...world, bag, crafting: { ...world.crafting, traps } }, item };
}

// ---------- ครกหินเก่า ----------

/** สิ่งที่ตำได้: ของ (ลูกชิ้น ผง) หรืออาหาร (น้ำพริก ทอดมัน ต้องรู้สูตรแล้ว) */
export type MortarJob = { kind: 'item'; id: string } | { kind: 'dish'; id: string };

/** อาหารที่ทำที่ครก (method mortar) ที่รู้สูตรแล้ว */
export const mortarDishes = (world: World): string[] => world.recipes.known.filter((id) => recipes[id]?.method === 'mortar');

export const mortarJobs = (world: World): MortarJob[] => [
  ...Object.keys(mortar.items).map((id): MortarJob => ({ kind: 'item', id })),
  ...mortarDishes(world).map((id): MortarJob => ({ kind: 'dish', id })),
];

export const jobIngredients = (job: MortarJob): Record<string, number> =>
  job.kind === 'item' ? mortar.items[job.id]!.in : (recipes[job.id] as Recipe).ingredients;

/** ได้ของกี่ชิ้นต่อการตำ 1 ชุด */
export const jobGives = (job: MortarJob): number => (job.kind === 'item' ? mortar.items[job.id]!.gives : 1);

export const jobOutput = (job: MortarJob, stars: number): string => (job.kind === 'item' ? mortar.items[job.id]!.out : dishItem(job.id, stars));

/** เวลาในเกมต่อรอบ: อาหารตามแรงก์ (น้ำพริก ทอดมัน แรงก์ E 25 นาที) ลูกชิ้นกับผง 15 นาที */
export const jobMinutes = (job: MortarJob): number => (job.kind === 'item' ? mortar.itemMinutes : minutesFor(recipes[job.id] as Recipe));

export const maxPounds = (world: World, job: MortarJob): number => maxTimes(world.bag, jobIngredients(job));

/** เวลาที่วงหดถึงขอบครกของการตำครั้งที่ beat (0 คือครั้งแรก) ช้าไปเร็ว 1.2 → 0.8 วินาที */
export function ringMs(beat: number): number {
  const last = Math.max(1, mortar.pounds - 1);
  return mortar.firstRingMs + ((mortar.lastRingMs - mortar.firstRingMs) * Math.min(beat, last)) / last;
}

export type PoundJudge = 'perfect' | 'good' | 'miss';

/** ตัดสินการตำจากความคลาดเคลื่อน (มิลลิวินาทีจากตอนวงแตะขอบ) */
export function judgePound(offsetMs: number): PoundJudge {
  const off = Math.abs(offsetMs);
  if (off <= mortar.perfectMs) return 'perfect';
  if (off <= mortar.goodMs) return 'good';
  return 'miss';
}

export const poundPoints = (judge: PoundJudge): number => (judge === 'miss' ? 0 : mortar.points[judge]);

/** คะแนนรวม 12 เต็ม: 10 ขึ้นไป 3 ดาว · 6–9 2 ดาว · น้อยกว่านั้น 1 ดาว */
export function poundStars(total: number): number {
  return [...mortar.stars].sort((a, b) => b.from - a.from).find((step) => total >= step.from)?.stars ?? 1;
}

/**
 * ตำเสร็จ: หยิบวัตถุดิบ count ชุด ได้ของ · อาหารได้ดาว = ดาวต่ำสุดระหว่างดาววัตถุดิบกับดาวมินิเกม · เวลาในเกมผ่านไปตามงาน
 * ตอบ null เมื่อของไม่พอหรือกระเป๋าเต็ม
 */
export function finishPounding(world: World, job: MortarJob, count: number, minigameStars: number): { world: World; item: string; count: number; stars: number } | null {
  if (!Number.isInteger(count) || count < 1 || count > maxPounds(world, job)) return null;
  if (job.kind === 'dish' && !world.recipes.known.includes(job.id)) return null;
  const ingredients = jobIngredients(job);
  const stars = job.kind === 'dish' ? Math.min(baseDishStars(world.bag, recipes[job.id] as Recipe), minigameStars) : 1;
  const taken = takeIngredients(world.bag, ingredients, count);
  if (!taken) return null;
  const item = jobOutput(job, stars);
  const amount = jobGives(job) * count;
  const bag = addToBag(taken, item, amount);
  if (!bag) return null;
  let next: World = { ...world, bag };
  if (job.kind === 'dish') {
    const best = Math.max(world.recipes.bestStars[job.id] ?? 0, stars);
    next = { ...next, recipes: { ...next.recipes, bestStars: { ...next.recipes.bestStars, [job.id]: best } } };
  }
  return { world: spendMinutes(next, jobMinutes(job)), item, count: amount, stars };
}

/** เจอครกหินเก่า (ตอนนี้จากปุ่มทดสอบ) ได้สูตรทอดมันกับลูกชิ้นปิ้งด้วย */
export function findMortar(world: World): World {
  if (world.crafting.mortar) return world;
  const known = [...new Set([...world.recipes.known, ...mortar.teaches])];
  return { ...world, recipes: { ...world.recipes, known }, crafting: { ...world.crafting, mortar: true } };
}
