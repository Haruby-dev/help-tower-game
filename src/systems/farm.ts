import type { TextKey } from '../core/i18n';
import type { Rng } from '../core/rng';
import type { BagStack, Farm, PlotState, Tool, World } from '../core/state';
import balance from '../data/balance.json';
import cropsJson from '../data/crops.json';
import type { Crops } from '../data/schema';
import { spendGardenTime } from './gauges';

export const crops = cropsJson as Crops;
const { farm: rules } = balance;

export const produceItem = (crop: string): string => `produce_${crop}`;
export const seedItem = (crop: string): string => `seed_${crop}`;
export const cropOfItem = (item: string): string => item.slice(item.indexOf('_') + 1);
export const isSeed = (item: string): boolean => item.startsWith('seed_');

const emptyPlot = (): PlotState => ({ tilled: false, watered: false, crop: null });

function cropInfo(id: string): Crops[string] {
  const info = crops[id];
  if (!info) throw new Error(`unknown crop ${id}`);
  return info;
}

/** เก็บครบรอบแล้วต้นเหี่ยว ต้องใช้จอบเคลียร์ */
export const isWithered = (plot: PlotState): boolean => {
  if (!plot.crop) return false;
  const { regrowDays, regrowTimes } = cropInfo(plot.crop.id);
  return regrowDays !== null && plot.crop.harvests > regrowTimes;
};

export const isReady = (plot: PlotState): boolean =>
  plot.crop !== null && !isWithered(plot) && plot.crop.daysGrown >= cropInfo(plot.crop.id).growDays;

/** พืชที่ยังไม่ได้น้ำวันนี้หลับอยู่ ผู้เล่นจะได้เห็นว่าแปลงไหนยังไม่ได้รด */
export const isAsleep = (plot: PlotState): boolean => plot.crop !== null && !plot.watered && !isReady(plot) && !isWithered(plot);

/** เวลาโตแบ่งเท่ากัน 4 ระยะ เฟรมสุดท้ายคือพร้อมเก็บ */
export function stageOf(plot: PlotState): number {
  if (!plot.crop) return 0;
  if (isReady(plot)) return rules.stages - 1;
  return Math.min(rules.stages - 2, Math.floor((plot.crop.daysGrown / cropInfo(plot.crop.id).growDays) * (rules.stages - 1)));
}

/** ขึ้นวันใหม่ พืชโตเฉพาะแปลงที่ได้น้ำ ลืมรดก็แค่ไม่โต ไม่มีวันตาย */
export function growFarm(farm: Farm): Farm {
  return {
    plots: farm.plots.map((plot) => ({
      ...plot,
      watered: false,
      crop: plot.crop && plot.watered && !isReady(plot) && !isWithered(plot) ? { ...plot.crop, daysGrown: plot.crop.daysGrown + 1 } : plot.crop,
    })),
  };
}

export function countOf(bag: BagStack[], item: string): number {
  return bag.filter((stack) => stack.item === item).reduce((sum, stack) => sum + stack.count, 0);
}

/** ใส่ของทั้งหมดหรือไม่ใส่เลย ตอบ null เมื่อกระเป๋าไม่พอ ของจึงไม่หาย */
export function addToBag(bag: BagStack[], item: string, count: number): BagStack[] | null {
  let left = count;
  const next = bag.map((stack) => {
    if (stack.item !== item || left === 0) return stack;
    const moved = Math.min(left, rules.bag.stack - stack.count);
    left -= moved;
    return { ...stack, count: stack.count + moved };
  });
  while (left > 0) {
    if (next.length >= rules.bag.slots) return null;
    const moved = Math.min(left, rules.bag.stack);
    next.push({ item, count: moved });
    left -= moved;
  }
  return next;
}

/** ตอบ null เมื่อของไม่พอ */
export function takeFromBag(bag: BagStack[], item: string, count: number): BagStack[] | null {
  if (countOf(bag, item) < count) return null;
  let left = count;
  return bag
    .map((stack) => {
      if (stack.item !== item || left === 0) return stack;
      const moved = Math.min(left, stack.count);
      left -= moved;
      return { ...stack, count: stack.count - moved };
    })
    .filter((stack) => stack.count > 0);
}

/** แปลงผัก 1 ชิ้นเป็นเมล็ด 2–3 เมล็ด ตอบ null เมื่อไม่มีผักหรือกระเป๋าไม่พอ */
export function convertToSeeds(world: World, crop: string, rng: Rng): World | null {
  const taken = takeFromBag(world.bag, produceItem(crop), 1);
  if (!taken) return null;
  const { min, max } = rules.seedsPerProduce;
  const bag = addToBag(taken, seedItem(crop), min + Math.floor(rng.next() * (max - min + 1)));
  return bag ? { ...world, bag } : null;
}

export type FarmAction = 'till' | 'plant' | 'water' | 'harvest' | 'dig';

/** เครื่องมือนี้ทำอะไรกับแปลงนี้ได้ */
export function actionFor(plot: PlotState, tool: Tool, seed: string | null, bag: BagStack[]): FarmAction | null {
  if (tool === 'hoe') {
    if (plot.crop) return 'dig';
    return plot.tilled ? null : 'till';
  }
  if (tool === 'can') {
    if (!plot.tilled || plot.watered || isReady(plot) || isWithered(plot)) return null;
    return 'water';
  }
  if (tool === 'sickle') return isReady(plot) ? 'harvest' : null;
  if (tool !== 'seeds') return null;
  return plot.tilled && !plot.crop && seed !== null && countOf(bag, seedItem(seed)) > 0 ? 'plant' : null;
}

export const ACTION_LABEL: Record<FarmAction, TextKey> = {
  till: 'action.till',
  plant: 'action.plant',
  water: 'action.water',
  harvest: 'action.harvest',
  dig: 'action.dig',
};

export const yieldOf = (plot: PlotState): number => {
  if (!plot.crop) return 0;
  const info = cropInfo(plot.crop.id);
  return plot.crop.harvests > 0 && info.regrowYield !== null ? info.regrowYield : info.firstYield;
};

export const canStoreHarvest = (world: World, index: number): boolean => {
  const plot = world.farm.plots[index];
  return Boolean(plot?.crop && addToBag(world.bag, produceItem(plot.crop.id), yieldOf(plot)));
};

function afterHarvest(plot: PlotState): PlotState {
  const crop = plot.crop!;
  const { growDays, regrowDays } = cropInfo(crop.id);
  if (regrowDays === null) return emptyPlot();
  return { ...plot, crop: { ...crop, daysGrown: growDays - regrowDays, harvests: crop.harvests + 1 } };
}

/** ทำงาน 1 ช่อง ตอบ null เมื่อทำไม่ได้ เช่น กระเป๋าเต็มตอนเก็บเกี่ยว ผักจึงยังอยู่ที่แปลง */
/** rng ใส่มาเมื่อให้มีโอกาสได้เมล็ดตอนเก็บเกี่ยว กระเป๋าเต็มก็ไม่ได้เมล็ด แต่ผลผลิตยังเก็บได้ */
export function applyFarmAction(world: World, index: number, action: FarmAction, seed: string | null, rng?: Rng): World | null {
  const plot = world.farm.plots[index];
  if (!plot) return null;
  let next: PlotState;
  let bag = world.bag;
  if (action === 'till') {
    next = { ...plot, tilled: true };
  } else if (action === 'water') {
    next = { ...plot, watered: true };
  } else if (action === 'dig') {
    next = emptyPlot();
  } else if (action === 'plant') {
    if (!seed) return null;
    const taken = takeFromBag(bag, seedItem(seed), 1);
    if (!taken) return null;
    bag = taken;
    next = { ...plot, crop: { id: seed, daysGrown: 0, harvests: 0 } };
  } else {
    if (!plot.crop || !isReady(plot)) return null;
    const stored = addToBag(bag, produceItem(plot.crop.id), yieldOf(plot));
    if (!stored) return null;
    bag = stored;
    if (rng && rng.next() < rules.seedDropChance) bag = addToBag(bag, seedItem(plot.crop.id), 1) ?? bag;
    next = afterHarvest(plot);
  }
  const plots = world.farm.plots.map((candidate, candidateIndex) => (candidateIndex === index ? next : candidate));
  return spendGardenTime({ ...world, bag, farm: { plots } });
}
