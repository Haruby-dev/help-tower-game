import type { Rng } from '../core/rng';
import type { BagStack, World } from '../core/state';
import balance from '../data/balance.json';
import baitsJson from '../data/baits.json';
import fishJson from '../data/fish.json';
import type { Baits, ChestTier, FishTable } from '../data/schema';
import { chestData, rollChestTier } from './chests';
import { addToBag, countOf, takeFromBag } from './farm';
import { clampGauges } from './gauges';

export const fishTable = fishJson as unknown as FishTable;
export const baits = baitsJson as Baits;
type Fish = FishTable[string];
const { fishing: rules, gauges, cooking } = balance;
const rods = rules.rods as Record<string, { maxRank: string; chestChance: number }>;
const RANKS = Object.keys(cooking.ranks);
const MINUTES_PER_HOUR = 60;
const FISH_PREFIX = 'fish_';
export const NORMAL_BAIT = 'normal';

export const fishItem = (id: string): string => `${FISH_PREFIX}${id}`;
export const fishOfItem = (item: string): string => item.slice(FISH_PREFIX.length);
export const isFish = (item: string): boolean => item.startsWith(FISH_PREFIX) && fishTable[fishOfItem(item)] !== undefined;
export const baitOfItem = (item: string): string | null => Object.entries(baits).find(([, bait]) => bait.item === item)?.[0] ?? null;
export const isBait = (item: string): boolean => baitOfItem(item) !== null;


export const isNight = (hour: number): boolean => hour >= rules.nightFromHour;

export function inSeason(fish: Fish, hour: number, weather: World['weather']): boolean {
  const hourOk = fish.hours === null || (hour >= fish.hours[0] && hour < fish.hours[1]);
  return hourOk && (fish.weather === 'any' || fish.weather === weather);
}

const rankIndex = (rank: string): number => RANKS.indexOf(rank);
const rodAllows = (owned: string[], fish: Fish): boolean =>
  owned.some((rod) => rods[rod] !== undefined && rankIndex(rods[rod].maxRank) >= rankIndex(fish.rank));

/** คันเบ็ดที่ดีที่สุดเป็นตัวกำหนด ฝนตกหรือกลางคืนหีบออกง่ายขึ้น */
export function chestChance(world: World, hour: number): number {
  const base = Math.max(0, ...world.fishing.rods.map((rod) => rods[rod]?.chestChance ?? 0));
  return base + (world.weather === 'rain' || isNight(hour) ? rules.chestBonus : 0);
}

/** ปลาที่ออกตอนนี้กับเหยื่อนี้ เหยื่อพิเศษดึงปลาของมันก่อน ถ้าปลานั้นยังไม่ออกจะได้ปลาทั่วไปแทน */
export function biteCandidates(world: World, bait: string, hour: number): string[] {
  const open = Object.entries(fishTable).filter(([, fish]) => inSeason(fish, hour, world.weather) && rodAllows(world.fishing.rods, fish));
  const special = bait === NORMAL_BAIT ? [] : open.filter(([, fish]) => fish.bait === bait);
  return (special.length > 0 ? special : open.filter(([, fish]) => fish.bait === NORMAL_BAIT)).map(([id]) => id);
}

function pickWeighted(ids: string[], rng: Rng): string {
  const total = ids.reduce((sum, id) => sum + fishTable[id]!.weight, 0);
  let roll = rng.next() * total;
  for (const id of ids) {
    roll -= fishTable[id]!.weight;
    if (roll < 0) return id;
  }
  return ids[ids.length - 1]!;
}

export type Catch = { kind: 'fish'; fish: string } | { kind: 'chest'; tier: ChestTier };

/** ตกปลาอัตโนมัติดึงติดหรือไม่ สุ่มครั้งเดียวต่อครั้งที่ปลากิน */
export const autoHooks = (rng: Rng): boolean => rng.next() < rules.autoCatchChance;

/** หีบมาแทนปลาในครั้งนั้น */
export function rollCatch(world: World, bait: string, hour: number, rng: Rng): Catch | null {
  if (rng.next() < chestChance(world, hour)) return { kind: 'chest', tier: rollChestTier(rng) };
  const ids = biteCandidates(world, bait, hour);
  return ids.length > 0 ? { kind: 'fish', fish: pickWeighted(ids, rng) } : null;
}

export const catchItem = (caught: Catch): string => (caught.kind === 'fish' ? fishItem(caught.fish) : chestData.tiers[caught.tier].item);

export const baitsInBag = (bag: BagStack[]): string[] => Object.entries(baits).filter(([, bait]) => countOf(bag, bait.item) > 0).map(([id]) => id);

/** เหยื่อที่จะใช้จริง: ที่เลือกไว้ถ้ายังมี ไม่งั้นเหยื่อแรกที่ยังเหลือ */
export function chosenBait(bag: BagStack[], selected: string | null): string | null {
  const item = selected ? baits[selected]?.item : undefined;
  if (selected && item && countOf(bag, item) > 0) return selected;
  return baitsInBag(bag)[0] ?? null;
}

/** ตกปลาครั้งหนึ่งรวม 30 นาทีตาม GDD ช่วงรอปลากินนาฬิกาจริงไปแล้ว จึงเดินเวลาเฉพาะส่วนที่ขาด · สุขเพิ่มทุกครั้งที่ตก */
export function spendFishingTime(world: World, castHour: number): World {
  const fishingHours = rules.minutes / MINUTES_PER_HOUR;
  const extra = Math.max(0, castHour + fishingHours - world.hour);
  const values = world.gauges;
  return {
    ...world,
    hour: world.hour + extra,
    gauges: clampGauges({
      ...values,
      fullness: values.fullness - gauges.fullness.awakePerHour * extra,
      cleanliness:
        values.cleanliness - gauges.cleanliness.idlePerHour * extra - (rules.cleanlinessPerHour - gauges.cleanliness.idlePerHour) * fishingHours,
      happiness: values.happiness + rules.happinessGain,
    }),
  };
}

/** ได้ของแล้วเสียเหยื่อ 1 ชิ้น · ปลาหลุดเหยื่อไม่หาย · กระเป๋าเต็มของไม่เข้าและเหยื่อไม่หาย */
export function finishCast(world: World, castHour: number, bait: string, caught: Catch | null): { world: World; stored: boolean } {
  const spent = spendFishingTime(world, castHour);
  const baitItem = baits[bait]?.item;
  if (!caught || !baitItem) return { world: spent, stored: false };
  const paid = takeFromBag(spent.bag, baitItem, 1);
  const bag = paid && addToBag(paid, catchItem(caught), 1);
  if (!bag) return { world: spent, stored: false };
  const caughtCount =
    caught.kind === 'fish' ? { ...spent.fishing.caught, [caught.fish]: (spent.fishing.caught[caught.fish] ?? 0) + 1 } : spent.fishing.caught;
  return { world: { ...spent, bag, fishing: { ...spent.fishing, caught: caughtCount } }, stored: true };
}

/** ผัก 1 ชิ้นทำเหยื่อธรรมดาได้ 3 ชิ้น ตอบ null เมื่อไม่มีผักหรือกระเป๋าไม่พอ */
export function makeBait(world: World, produce: string): World | null {
  const bait = baits[NORMAL_BAIT]!;
  const taken = takeFromBag(world.bag, produce, 1);
  const bag = taken && addToBag(taken, bait.item, bait.yield);
  return bag ? { ...world, bag } : null;
}
