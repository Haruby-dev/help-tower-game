import type { Rng } from '../core/rng';
import type { BagStack } from '../core/state';
import balance from '../data/balance.json';

const { stars: rules } = balance;
/** ผักดาว 2–3 เก็บในกระเป๋าเป็น `produce_tomato@2` ผัก 1 ดาวใช้รหัสเดิม เซฟเก่าจึงเป็น 1 ดาวเองโดยไม่ต้องแปลงของ */
const SEPARATOR = '@';
const DISH_PREFIX = 'dish_';
export const MAX_STARS = rules.max;

/** ของที่มีดาวใน MVP คือผักจากแปลง (และอาหาร ซึ่งเก็บดาวไว้ในรหัสของตัวเอง) เครื่องปรุง ไข่ นม น้ำผึ้ง ปลา ไม่มีดาว */
export const carriesStars = (item: string): boolean => baseItem(item).startsWith('produce_');

/** รหัสของโดยไม่มีดาว ใช้หาชื่อ ภาพ ราคา และสูตร */
export const baseItem = (item: string): string => {
  const split = item.indexOf(SEPARATOR);
  return split === -1 ? item : item.slice(0, split);
};

export const withStars = (item: string, stars: number): string => {
  const base = baseItem(item);
  return stars <= 1 ? base : `${base}${SEPARATOR}${Math.min(stars, MAX_STARS)}`;
};

/** ดาวของของชิ้นนี้ ของที่ไม่มีดาวตอบ null · อาหารอ่านจากท้ายรหัส dish_<สูตร>_<ดาว> */
export function starsOf(item: string): number | null {
  if (item.startsWith(DISH_PREFIX)) {
    const stars = Number(item.slice(item.lastIndexOf('_') + 1));
    return Number.isInteger(stars) && stars >= 1 ? stars : null;
  }
  if (!carriesStars(item)) return null;
  const split = item.indexOf(SEPARATOR);
  return split === -1 ? 1 : Number(item.slice(split + 1));
}

/** โอกาสได้ 1 / 2 / 3 ดาวตามระดับปุ๋ย (ไม่ใส่ปุ๋ยนับเป็นระดับ 1) · ทักษะ E ย้ายโอกาส 10% จากดาวต่ำสุดที่ออกได้ไปดาวถัดไป */
export function starChances(tier: number, skillE = false): number[] {
  const table = rules.rolls[String(Math.max(1, tier)) as keyof typeof rules.rolls];
  if (!table) throw new Error(`unknown fertilizer tier ${tier}`);
  const chances = [...table];
  if (skillE) {
    const low = chances.findIndex((chance) => chance > 0);
    if (low >= 0 && low + 1 < chances.length) {
      const moved = Math.min(rules.skillShift, chances[low]!);
      chances[low] = chances[low]! - moved;
      chances[low + 1] = chances[low + 1]! + moved;
    }
  }
  return chances;
}

/** สุ่มดาวผัก 1 ชิ้นตอนเก็บเกี่ยว */
export function rollCropStars(tier: number, rng: Rng, skillE = false): number {
  const chances = starChances(tier, skillE);
  let roll = rng.next();
  for (let index = 0; index < chances.length; index += 1) {
    roll -= chances[index]!;
    if (roll < 0) return index + 1;
  }
  // ปัดเศษทศนิยมแล้วเลยท้ายตาราง ใช้ดาวสูงสุดที่ออกได้
  return chances.reduce((best, chance, index) => (chance > 0 ? index + 1 : best), 1);
}

/** ดาวของอาหาร = ดาวต่ำสุดของวัตถุดิบที่มีดาว ไม่มีวัตถุดิบมีดาวเลยเป็น 1 ดาว · เกจสุขช่วงสุขมีโอกาส 10% ได้เพิ่ม 1 ดาว สุ่มครั้งเดียวทั้งรอบ */
export function dishStars(ingredientStars: number[], happiness: number, rng: Rng): number {
  const base = ingredientStars.length > 0 ? Math.min(...ingredientStars) : 1;
  return happiness >= rules.happyBonusFrom && rng.next() < rules.happyBonusChance ? Math.min(MAX_STARS, base + 1) : base;
}

/** ดาวที่มีในกระเป๋าของวัตถุดิบนี้ เรียงจากน้อยไปมาก พร้อมจำนวน */
export function starLevels(bag: BagStack[], ingredient: string): { stars: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const stack of bag) {
    if (baseItem(stack.item) !== ingredient) continue;
    const stars = starsOf(stack.item) ?? 1;
    counts.set(stars, (counts.get(stars) ?? 0) + stack.count);
  }
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([stars, count]) => ({ stars, count }));
}

/** ค่าเริ่มของตัวเลือกดาว: ดาวต่ำสุดที่มีพอทำ 1 จาน ผักดีจะได้ไม่ถูกใช้โดยไม่ตั้งใจ ถ้าไม่มีดาวไหนพอใช้ดาวต่ำสุดที่มี */
export function defaultStarPick(bag: BagStack[], ingredient: string, need: number): number {
  const levels = starLevels(bag, ingredient);
  return (levels.find((level) => level.count >= need) ?? levels[0])?.stars ?? 1;
}
