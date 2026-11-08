import type { BagStack, Tray, World } from '../core/state';
import balance from '../data/balance.json';
import { MYSTERY, isDish, parseDish } from './cooking';
import { addToBag, countOf, takeFromBag } from './farm';
import { fitsTowerTray, isSet } from './sets';

const { tray: rules } = balance;

export const plateCount = (level: number): number => rules.levels[Math.min(level, rules.levels.length - 1)]!.plates.length;

/** ภาพถาดของระดับนี้ในทะเบียน */
export const trayArt = (level: number): string => rules.levels[Math.min(level, rules.levels.length - 1)]!.id;

/** กลางจานในภาพถาด เรียงตามที่มอนสเตอร์เดินดู */
export const platePoints = (level: number): [number, number][] => rules.levels[Math.min(level, rules.levels.length - 1)]!.plates as [number, number][];

export const newTray = (): Tray => ({ level: 0, plates: Array.from({ length: plateCount(0) }, () => null) });

/** วางบนถาดได้เฉพาะอาหารที่ทำสำเร็จ (รวมเครื่องดื่ม) และชุดถาดเล็ก อาหารปริศนาไม่วาง ชุดถาดกลางกับใหญ่วางบนโต๊ะใหญ่ */
export const canServe = (item: string): boolean => (isSet(item) ? fitsTowerTray(item) : isDish(item) && parseDish(item).recipe !== MYSTERY);

/** จานที่จะใส่ของนี้: จานที่มีเมนูเดียวกัน (ดาวเท่ากัน) อยู่แล้ว หรือจานว่างใบแรก */
export function plateFor(tray: Tray, item: string): number | null {
  const same = tray.plates.findIndex((plate) => plate?.item === item);
  if (same >= 0) return same;
  const empty = tray.plates.findIndex((plate) => plate === null);
  return empty >= 0 ? empty : null;
}

const withPlate = (tray: Tray, index: number, plate: BagStack | null): Tray => ({
  ...tray,
  plates: tray.plates.map((current, at) => (at === index ? plate : current)),
});

/** ย้ายอาหารจากกระเป๋าลงถาด ตอบ null เมื่อไม่มีจานว่างหรือของไม่พอ */
export function putOnTray(world: World, item: string, count: number): World | null {
  if (!canServe(item) || count < 1) return null;
  const index = plateFor(world.tray, item);
  if (index === null) return null;
  const bag = takeFromBag(world.bag, item, count);
  if (!bag) return null;
  const current = world.tray.plates[index];
  return { ...world, bag, tray: withPlate(world.tray, index, { item, count: (current?.count ?? 0) + count }) };
}

/** เอาอาหารคืนจากจานเข้ากระเป๋า ตอบ null เมื่อกระเป๋าไม่พอ อาหารจึงยังอยู่บนถาด */
export function takeBackFromTray(world: World, index: number, count: number): World | null {
  const plate = world.tray.plates[index];
  if (!plate || count < 1) return null;
  const moved = Math.min(count, plate.count);
  const bag = addToBag(world.bag, plate.item, moved);
  if (!bag) return null;
  const left = plate.count - moved;
  return { ...world, bag, tray: withPlate(world.tray, index, left > 0 ? { ...plate, count: left } : null) };
}

/** มอนสเตอร์หยิบจากจาน ตอบจำนวนที่หยิบได้จริง (ผู้เล่นอาจเอาคืนไประหว่างนั้น) */
export function removeFromPlate(tray: Tray, index: number, item: string, count: number): { tray: Tray; taken: number } {
  const plate = tray.plates[index];
  if (!plate || plate.item !== item) return { tray, taken: 0 };
  const taken = Math.min(count, plate.count);
  const left = plate.count - taken;
  return { tray: withPlate(tray, index, left > 0 ? { ...plate, count: left } : null), taken };
}

export const servingsOnTray = (tray: Tray): number => tray.plates.reduce((sum, plate) => sum + (plate?.count ?? 0), 0);

export const dishesInBag = (bag: BagStack[]): BagStack[] => bag.filter((stack) => canServe(stack.item));

export const bagCount = (bag: BagStack[], item: string): number => countOf(bag, item);
