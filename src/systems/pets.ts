import type { BagStack, PetState, World } from '../core/state';
import petsJson from '../data/pets.json';
import { petsSchema } from '../data/schema';
import { isDish, parseDish } from './cooking';
import { addToBag, takeFromBag } from './farm';
import { baseItem, starsOf } from './stars';

/**
 * สัตว์เลี้ยง M8b ตามตาราง GDD "สัตว์เลี้ยง 5 ตัวใน MVP"
 * เจอบาดเจ็บในเกตของตัวเอง → พากลับบ้าน → รักษาวันละครั้งจนครบวัน → มีบ้านแล้วอยู่ด้วย
 * อยู่ด้วยแล้วให้อาหารกับลูบทุกวันได้แต้มผูกพัน ผลผลิตออกทุกเช้าตามระดับ รอให้ไปเก็บที่ตัวสัตว์
 */
export const pets = petsSchema.parse(petsJson);

export type PetInfo = (typeof pets.pets)[number];
export type PetCare = NonNullable<PetInfo['care']>;

const petTable = new Map(pets.pets.map((pet) => [pet.id, pet]));

/** สัตว์ที่ดูแลได้แล้วในเกมนี้ (มีภาพและวิธีดูแล) */
export const carePets = (): PetInfo[] => pets.pets.filter((pet) => pet.art && pet.care !== undefined);

export const petInfo = (id: string): PetInfo | null => petTable.get(id) ?? null;

/** สัตว์ที่บาดเจ็บอยู่ในเกตชั้นนี้ (ยังไม่เคยพากลับบ้าน) */
export function injuredPetIn(world: World, floor: number): PetInfo | null {
  return carePets().find((pet) => pet.gate === floor && world.pets[pet.id] === undefined) ?? null;
}

/** พาสัตว์ที่บาดเจ็บกลับบ้าน เริ่มรักษา */
export function takePetHome(world: World, id: string): World {
  if (world.pets[id] || !petInfo(id)?.care) return world;
  const state: PetState = { stage: 'treating', treatedDays: 0, lastTreatDay: 0, boosted: false, homeOwned: false, bond: 0, fedDay: 0, pettedDay: 0, stored: 0 };
  return { ...world, pets: { ...world.pets, [id]: state } };
}

/** ของในกระเป๋าที่ใช้แทนของที่ต้องการได้: ผักดาวไหนก็ได้ (ดาวต่ำก่อน) · `dish:<สูตร>` อาหารสูตรนั้นดาวไหนก็ได้ */
function stacksFor(bag: BagStack[], need: string): BagStack[] {
  const matches = need.startsWith('dish:')
    ? bag.filter((stack) => isDish(stack.item) && parseDish(stack.item).recipe === need.slice('dish:'.length))
    : bag.filter((stack) => baseItem(stack.item) === need);
  return [...matches].sort((a, b) => (starsOf(a.item) ?? 1) - (starsOf(b.item) ?? 1));
}

const haveCount = (bag: BagStack[], need: string): number => stacksFor(bag, need).reduce((sum, stack) => sum + stack.count, 0);

function takeNeed(bag: BagStack[], need: string, count: number): BagStack[] | null {
  let left = count;
  let next = bag;
  for (const stack of stacksFor(bag, need)) {
    if (left <= 0) break;
    const take = Math.min(left, stack.count);
    const taken = takeFromBag(next, stack.item, take);
    if (!taken) return null;
    next = taken;
    left -= take;
  }
  return left === 0 ? next : null;
}

/** ของที่ยังขาดสำหรับรักษาวันนี้ (ว่างคือพร้อม) */
export function missingForTreat(world: World, id: string): { item: string; need: number; have: number }[] {
  const care = petInfo(id)?.care;
  if (!care) return [];
  return Object.entries(care.treat)
    .map(([item, need]) => ({ item, need, have: haveCount(world.bag, item) }))
    .filter((row) => row.have < row.need);
}

/** วันที่ต้องรักษาให้ครบ (ใช้ของช่วยแล้วลด 1 วัน) */
export const daysToHeal = (id: string, state: PetState): number => Math.max(1, (petInfo(id)?.treatDays ?? 1) - (state.boosted ? 1 : 0));

export const treatedToday = (world: World, id: string): boolean => world.pets[id]?.lastTreatDay === world.day;

/** รักษาครบวันแล้ว: ตัวที่ต้องมีบ้านรอบ้าน ตัวที่อยู่ริมบ่อหรือในบ่ออยู่ด้วยเลย */
function afterTreat(id: string, state: PetState): PetState {
  if (state.treatedDays < daysToHeal(id, state)) return state;
  const needsHome = petInfo(id)?.care?.home !== null;
  return { ...state, stage: needsHome && !state.homeOwned ? 'needs_home' : 'living' };
}

export type TreatResult = { world: World; healed: boolean; boosted: boolean } | 'done_today' | 'missing' | null;

/**
 * รักษาวันนี้ด้วยของในกระเป๋า (บับเบิ้ลรักษาด้วยการอาบน้ำ ใช้ treatByBath)
 * มีของช่วยให้หายเร็ว (ดอกเดซี่ ดอกไม้หวาน สมุนไพรริมบึง) ใช้ให้เองครั้งเดียว
 */
export function treatPet(world: World, id: string): TreatResult {
  const state = world.pets[id];
  const care = petInfo(id)?.care;
  if (!state || !care || state.stage !== 'treating' || care.bath) return null;
  if (state.lastTreatDay === world.day) return 'done_today';
  if (missingForTreat(world, id).length > 0) return 'missing';
  let bag: BagStack[] | null = world.bag;
  for (const [item, need] of Object.entries(care.treat)) {
    bag = takeNeed(bag, item, need);
    if (!bag) return 'missing';
  }
  return finishTreat({ ...world, bag }, id, state);
}

function finishTreat(world: World, id: string, state: PetState): { world: World; healed: boolean; boosted: boolean } {
  let bag = world.bag;
  let boosted = false;
  if (!state.boosted) {
    const helper = pets.speedUpItems.find((item) => haveCount(bag, item) > 0);
    const taken = helper ? takeNeed(bag, helper, 1) : null;
    if (taken) {
      bag = taken;
      boosted = true;
    }
  }
  const next = afterTreat(id, { ...state, treatedDays: state.treatedDays + 1, lastTreatDay: world.day, boosted: state.boosted || boosted });
  return { world: { ...world, bag, pets: { ...world.pets, [id]: next } }, healed: next.stage !== 'treating', boosted };
}

/** อาบน้ำที่บ่อเสร็จ: สัตว์ที่รักษาด้วยการอาบน้ำด้วยกัน (บับเบิ้ล) นับวันนี้ */
export function treatByBath(world: World): World {
  let next = world;
  for (const pet of carePets()) {
    const state = next.pets[pet.id];
    if (!state || state.stage !== 'treating' || !pet.care?.bath || state.lastTreatDay === next.day) continue;
    next = finishTreat(next, pet.id, state).world;
  }
  return next;
}

/** ซื้อบ้านแล้ว: ตัวที่หายแล้วย้ายเข้าบ้านทันที ตัวที่ยังรักษาอยู่ย้ายเข้าเมื่อหาย */
export function ownHome(world: World, id: string): World {
  const state = world.pets[id];
  if (!state || state.homeOwned) return world;
  const next: PetState = { ...state, homeOwned: true, stage: state.stage === 'needs_home' ? 'living' : state.stage };
  return { ...world, pets: { ...world.pets, [id]: next } };
}

/** ตัวที่ต้องมีบ้านและยังไม่มี (ขายบ้านในร้านเฉพาะตัวที่เจอแล้ว) */
export const homeForSale = (world: World, id: string): boolean => {
  const state = world.pets[id];
  return state !== undefined && !state.homeOwned && (petInfo(id)?.care?.home ?? null) !== null;
};

/** ทุ่งสัตว์เลี้ยงเปิดเมื่อมีบ้านหลังแรก */
export const meadowOpen = (world: World): boolean => Object.values(world.pets).some((state) => state.homeOwned);

/** ระดับผูกพัน 1–5 จากแต้ม (GDD 30 / 80 / 150 / 250) */
export const bondLevel = (bond: number): number => 1 + pets.bondLevels.filter((need) => bond >= need).length;

/** อาหารสัตว์: ผักสดชิ้นไหนก็ได้ (ดาวต่ำก่อน) */
const feedStack = (bag: BagStack[]): BagStack | null =>
  [...bag].filter((stack) => baseItem(stack.item).startsWith('produce_')).sort((a, b) => (starsOf(a.item) ?? 1) - (starsOf(b.item) ?? 1))[0] ?? null;

export const canFeed = (world: World, id: string): boolean => world.pets[id]?.stage === 'living' && world.pets[id]!.fedDay !== world.day && feedStack(world.bag) !== null;

export type CareResult = { world: World; kind: 'fed' | 'petted' | 'collected'; item?: string; count?: number } | 'full' | null;

/**
 * ดูแลสัตว์ที่อยู่ด้วย ปุ่มเดียวทำทีละอย่าง: เก็บผลผลิต → ให้อาหาร (ผักสด 1 ชิ้น) → ลูบ
 * ทำครบแล้ววันนี้ตอบ null
 */
export function careForPet(world: World, id: string): CareResult {
  const state = world.pets[id];
  const care = petInfo(id)?.care;
  if (!state || !care || state.stage !== 'living') return null;
  if (state.stored > 0 && care.produce) {
    const bag = addToBag(world.bag, care.produce, state.stored);
    if (!bag) return 'full';
    return { world: { ...world, bag, pets: { ...world.pets, [id]: { ...state, stored: 0 } } }, kind: 'collected', item: care.produce, count: state.stored };
  }
  if (state.fedDay !== world.day) {
    const food = feedStack(world.bag);
    if (food) {
      const bag = takeFromBag(world.bag, food.item, 1)!;
      const next = { ...state, fedDay: world.day, bond: state.bond + pets.bondPerCare.fed };
      return { world: { ...world, bag, pets: { ...world.pets, [id]: next } }, kind: 'fed', item: food.item };
    }
  }
  if (state.pettedDay !== world.day) {
    const next = { ...state, pettedDay: world.day, bond: state.bond + pets.bondPerCare.petted };
    return { world: { ...world, pets: { ...world.pets, [id]: next } }, kind: 'petted' };
  }
  return null;
}

/** สิ่งที่ปุ่มกระทำจะทำกับสัตว์ตัวนี้ตอนนี้ (ใช้เลือกบทพูดและป้ายปุ่ม) */
export function petActionOf(world: World, id: string): 'treat' | 'bath' | 'collect' | 'feed' | 'pet' | null {
  const state = world.pets[id];
  const care = petInfo(id)?.care;
  if (!state || !care) return null;
  if (state.stage === 'treating') return care.bath ? 'bath' : 'treat';
  if (state.stage !== 'living') return 'pet';
  if (state.stored > 0 && care.produce) return 'collect';
  if (canFeed(world, id)) return 'feed';
  return state.pettedDay !== world.day ? 'pet' : null;
}

/**
 * ตอนเช้า: สัตว์ที่อยู่ด้วยให้ผลผลิตตามระดับ (สะสมไม่เกิน maxStoredDays วัน)
 * หนึบหนับรดน้ำแปลงที่พรวนแล้วแต่ยังแห้งตามระดับ
 */
export function petsMorning(world: World): World {
  let farm = world.farm;
  const next: Record<string, PetState> = { ...world.pets };
  for (const [id, state] of Object.entries(world.pets)) {
    const care = petInfo(id)?.care;
    if (!care || state.stage !== 'living') continue;
    const level = bondLevel(state.bond);
    if (care.produce) {
      const perDay = pets.produceByLevel[level - 1] ?? 1;
      next[id] = { ...state, stored: Math.min(state.stored + perDay, perDay * pets.maxStoredDays) };
    }
    if (care.waters) {
      let left = care.waters[level - 1] ?? 0;
      farm = { ...farm, plots: farm.plots.map((plot) => (left > 0 && plot.tilled && !plot.watered ? (left--, { ...plot, watered: true }) : plot)) };
    }
  }
  return { ...world, farm, pets: next };
}

/** อาบน้ำกับบับเบิ้ลที่อยู่ด้วยแล้ว สะอาดเพิ่มตามระดับ (GDD +20 → +40) */
export function bathBonus(world: World): number {
  let bonus = 0;
  for (const [id, state] of Object.entries(world.pets)) {
    const care = petInfo(id)?.care;
    if (state.stage === 'living' && care?.cleanBonus) bonus += care.cleanBonus[bondLevel(state.bond) - 1] ?? 0;
  }
  return bonus;
}

/** หิวแล้ว: อยู่ด้วยแต่วันนี้ยังไม่ได้กิน (ใช้เลือกบทพูด) */
export const petHungry = (world: World, id: string): boolean => world.pets[id]?.stage === 'living' && world.pets[id]!.fedDay !== world.day;
