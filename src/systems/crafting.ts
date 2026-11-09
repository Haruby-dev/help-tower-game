import type { Crafting, World } from '../core/state';
import balance from '../data/balance.json';
import linesJson from '../data/lines.json';
import setsJson from '../data/sets.json';
import type { Workbench } from '../data/schema';
import workbenchJson from '../data/workbench.json';
import { addToBag, countOf, takeFromBag } from './farm';
import { baseItem } from './stars';

/**
 * งานประดิษฐ์ (งานอาหารโซน 1 ขั้นที่ 4 · docs/crafting_design_2026-11-06.md)
 * ของแต่ละอย่างทำตรงที่ที่ใช้ โต๊ะช่างเก่าข้างบ้านทำแก้วไม้ไผ่ ถาดสาน 3 ขนาด ถาดตาก และลอบ
 * วัสดุ: เกี่ยวข้าวได้ฟางข้าว · เขย่าต้นกล้วยวันละครั้งได้ใบตองกับเชือกกาบกล้วย · ไม้ไผ่มาจากเกต 2 (M8) ตอนนี้เสกจากการ์ดเดฟ
 */
export const workbenchTable = workbenchJson as Workbench;
const rules = balance.crafting;
const firstLines = linesJson.player.firstItem as Record<string, string>;

export type StationId = keyof Crafting['stations'];

export const newCrafting = (): Crafting => ({ bananaDay: 0, noticed: [], stations: { ...rules.startStations }, drying: [], traps: [], mortar: false });

const isStation = (id: string): id is StationId => id === 'drying_tray' || id === 'trap';

/** ทำได้ · ของไม่พอ · มีแล้ว (ทำครั้งเดียว) · ครบจำนวนแล้ว · ยังไม่ปลด (ต้องได้ชิ้นแรกก่อน) */
export type CraftStatus = 'ok' | 'missing' | 'owned' | 'max' | 'locked';

/** จำนวนที่มีของของที่ทำได้ (ถาดตากกับลอบนับจากที่วางไว้ ของอื่นนับในกระเป๋า) */
export function ownedCount(world: World, id: string): number {
  return isStation(id) ? world.crafting.stations[id] : countOf(world.bag, id);
}

export function craftStatus(world: World, id: string): CraftStatus {
  const recipe = workbenchTable[id];
  if (!recipe) return 'locked';
  const owned = ownedCount(world, id);
  if (recipe.afterFirst && owned === 0) return 'locked';
  if (recipe.once && owned > 0) return 'owned';
  if (recipe.max !== undefined && owned >= recipe.max) return 'max';
  const enough = Object.entries(recipe.materials).every(([item, need]) => countOf(world.bag, item) >= need);
  return enough ? 'ok' : 'missing';
}

/** ทำของ 1 ครั้งที่โต๊ะช่าง ตอบ null เมื่อทำไม่ได้หรือกระเป๋าใส่ไม่ได้ ของจึงไม่หาย */
export function craft(world: World, id: string): World | null {
  const recipe = workbenchTable[id];
  if (!recipe || craftStatus(world, id) !== 'ok') return null;
  let bag = world.bag;
  for (const [item, need] of Object.entries(recipe.materials)) {
    const taken = takeFromBag(bag, item, need);
    if (!taken) return null;
    bag = taken;
  }
  if (isStation(id)) {
    const stations = { ...world.crafting.stations, [id]: Math.min(recipe.max ?? Infinity, world.crafting.stations[id] + recipe.gives) };
    return { ...world, bag, crafting: { ...world.crafting, stations } };
  }
  const added = addToBag(bag, id, recipe.gives);
  return added ? { ...world, bag: added } : null;
}

/** ต้นกล้วยเขย่าได้วันละครั้ง */
export const canShakeBanana = (world: World): boolean => world.crafting.bananaDay !== world.day;

/** เขย่าต้นกล้วย ได้ใบตองกับเชือกกาบกล้วย ตอบ null เมื่อเขย่าแล้ววันนี้หรือกระเป๋าเต็ม */
export function shakeBanana(world: World): World | null {
  if (!canShakeBanana(world)) return null;
  let bag: World['bag'] | null = world.bag;
  for (const [item, count] of Object.entries(rules.banana)) bag = bag && addToBag(bag, item, count);
  if (!bag) return null;
  return { ...world, bag, crafting: { ...world.crafting, bananaDay: world.day } };
}

/** ของแถมตอนเกี่ยวพืชชนิดนี้ (ข้าว → ฟางข้าว 1 ต่อช่อง) */
export const harvestExtras = (crop: string): [string, number][] => Object.entries((rules.harvestExtras as Record<string, Record<string, number>>)[crop] ?? {});

/** บทของตัวเอกตอนได้ของนี้ครั้งแรก null คือของที่ไม่มีบท */
export const firstItemLine = (item: string): string | null => firstLines[baseItem(item)] ?? null;

/** ถาดสานจำไว้ว่าเคยมีแล้ว (ไม่มีบทพูด) แท็บจัดชุดจึงยังอยู่เป็นสีเทาเมื่อใช้ถาดหมด (ผู้ใช้ตัดสิน 10 พ.ย. 2026) */
export const WOVEN_TRAYS: readonly string[] = Object.values(setsJson.trays).map((tray) => tray.item);

/** เคยมีถาดสานแล้ว (เซฟเก่าที่ยังไม่ได้จำ ดูจากถาดหรือชุดในกระเป๋าแทน) */
export const hadWovenTray = (world: World): boolean => WOVEN_TRAYS.some((item) => world.crafting.noticed.includes(item));

/** ของใหม่ที่เพิ่งเข้ากระเป๋าและยังไม่เคยพูดถึง ตอบบทที่ต้องพูดและโลกที่จำว่าพูดแล้ว (ถาดสานจำไว้เฉย ๆ ไม่มีบท) */
export function noticeNewItems(world: World): { world: World; lines: string[] } {
  const fresh = [...new Set(world.bag.map((stack) => baseItem(stack.item)))].filter(
    (item) => (firstItemLine(item) !== null || WOVEN_TRAYS.includes(item)) && !world.crafting.noticed.includes(item),
  );
  if (fresh.length === 0) return { world, lines: [] };
  return {
    world: { ...world, crafting: { ...world.crafting, noticed: [...world.crafting.noticed, ...fresh] } },
    lines: fresh.flatMap((item) => firstItemLine(item) ?? []),
  };
}

/** ปุ่มทดสอบ: ถาดตากใบแรกที่ตัวเอกคิดทำเองหลังเกต 2 (ระบบเกตมาใน M8) */
export function giveFirstDryingTray(world: World): World {
  if (world.crafting.stations.drying_tray > 0) return world;
  return { ...world, crafting: { ...world.crafting, stations: { ...world.crafting.stations, drying_tray: 1 } } };
}
