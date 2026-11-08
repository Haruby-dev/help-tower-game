import type { BagStack, World } from '../core/state';
import balance from '../data/balance.json';
import monstersJson from '../data/monsters.json';
import type { MonsterData, Recipe, Toppings } from '../data/schema';
import toppingsJson from '../data/toppings.json';
import { TOPPING_SEPARATOR, isDish, parseDish, plainDish, recipes } from './cooking';
import { addToBag, countOf, takeFromBag } from './farm';
import { baseItem, starsOf } from './stars';

/**
 * ท็อปปิ้ง (งานอาหารโซน 1 ขั้นที่ 3 · GDD "ท็อปปิ้ง")
 * อาหารที่แต่งแล้วเก็บท็อปปิ้งไว้ในรหัส `dish_<สูตร>_<ดาว>~<ท็อปปิ้ง>.<ท็อปปิ้ง>` เรียงตาม toppings.json จานที่แต่งเหมือนกันจึงซ้อนในช่องเดียว
 * ใส่ได้ไม่เกิน 3 ชิ้นต่อจาน (นับทุกชิ้น) ชิ้นที่ถูกประเภทได้โบนัสราคาและความชอบชิ้นละขั้น · ผิดประเภทใส่ได้แต่ไม่ได้โบนัสและมอนสเตอร์ทำหน้าจะอ้วก
 */
export const toppingTable = toppingsJson as Toppings;
const rules = balance.toppings;
const monsters = monstersJson as MonsterData;
const ORDER = Object.keys(toppingTable);
const PIECE_SEPARATOR = '.';

/** ท็อปปิ้งบนจานนี้ (ชิ้นละหนึ่งรายการ) อาหารที่ยังไม่แต่งตอบรายการว่าง */
export function toppingsOf(item: string): string[] {
  if (!isDish(item)) return [];
  const at = item.indexOf(TOPPING_SEPARATOR);
  return at === -1 ? [] : item.slice(at + 1).split(PIECE_SEPARATOR).filter((id) => toppingTable[id] !== undefined);
}

/** รหัสอาหารพร้อมท็อปปิ้ง เรียงตามลำดับใน toppings.json */
export function withToppings(item: string, toppings: string[]): string {
  const plain = plainDish(item);
  if (toppings.length === 0) return plain;
  const sorted = [...toppings].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return `${plain}${TOPPING_SEPARATOR}${sorted.join(PIECE_SEPARATOR)}`;
}

/** ของคาวรับท็อปปิ้งคาว ของหวานรับท็อปปิ้งหวาน เครื่องดื่มรับท็อปปิ้งเครื่องดื่มและท็อปปิ้งหวาน */
export function fitsType(recipe: Recipe, topping: string): boolean {
  const type = toppingTable[topping]?.type;
  if (recipe.category === 'savory') return type === 'savory';
  if (recipe.category === 'sweet') return type === 'sweet';
  return type === 'drink' || type === 'sweet';
}

/** ผักใช้ดาวไหนก็ได้ (ใช้ดาวต่ำก่อน) ของอื่นใช้รหัสตรง ๆ */
const fitting = (bag: BagStack[], item: string): string[] =>
  [...new Set(bag.filter((stack) => baseItem(stack.item) === item).map((stack) => stack.item))].sort((a, b) => (starsOf(a) ?? 1) - (starsOf(b) ?? 1));

export const toppingStock = (bag: BagStack[], topping: string): number => {
  const item = toppingTable[topping]?.item;
  return item ? fitting(bag, item).reduce((sum, stock) => sum + countOf(bag, stock), 0) : 0;
};

function takeTopping(bag: BagStack[], topping: string, amount: number): BagStack[] | null {
  const item = toppingTable[topping]?.item;
  if (!item || toppingStock(bag, topping) < amount) return null;
  let next = bag;
  let left = amount;
  for (const stock of fitting(bag, item)) {
    const moved = Math.min(left, countOf(next, stock));
    if (moved === 0) continue;
    next = takeFromBag(next, stock, moved)!;
    left -= moved;
    if (left === 0) break;
  }
  return next;
}

/** เหตุที่ใส่ท็อปปิ้งนี้เพิ่มไม่ได้ (ชิ้นที่วางแล้ว placed ทุกจานใช้ dishes ชิ้นต่อการแตะ) null คือใส่ได้ · ครบ 3 ชิ้นแล้วทุกอย่างเป็น "ใส่ครบแล้ว" */
export type ToppingBlock = 'full' | 'soupOnly' | 'oneSpoon' | 'notEnough';
export function toppingBlock(bag: BagStack[], recipe: Recipe, placed: string[], topping: string, dishes: number): ToppingBlock | null {
  const info = toppingTable[topping];
  if (!info) return 'notEnough';
  if (placed.length >= rules.maxPieces) return 'full';
  if (info.soupOnly && !recipe.soup) return 'soupOnly';
  if (info.perDish !== undefined && placed.filter((id) => id === topping).length >= info.perDish) return 'oneSpoon';
  const used = placed.filter((id) => id === topping).length * dishes;
  if (toppingStock(bag, topping) - used < dishes) return 'notEnough';
  return null;
}

export interface ToppingEffect {
  /** ชิ้นที่ถูกประเภท ได้โบนัส */
  counted: number;
  /** โบนัสราคาและความชอบ (0.3 = +30%) */
  bonus: number;
  /** มีชิ้นผิดประเภทที่คนกินไม่ได้ชอบ หน้าจะอ้วก ไม่มีผลเสีย */
  yuck: boolean;
  /** มีท็อปปิ้งที่คนกินชอบ ความชอบคูณเพิ่มและประกายหัวใจ */
  favourite: boolean;
  /** ผงนัวบนของคาว มอนสเตอร์สังเกตเห็น มีประกายและอาจพูด "นัวว~!" */
  noticed: boolean;
}

/** ผลของท็อปปิ้งบนจานนี้ favourite คือท็อปปิ้งที่คนกินชอบ (ขายให้จีโอไม่มี) */
export function toppingEffect(recipe: Recipe, toppings: string[], favourite: string | null = null): ToppingEffect {
  let counted = 0;
  let bonus = 0;
  let yuck = false;
  let liked = false;
  let noticed = false;
  for (const id of toppings) {
    const info = toppingTable[id];
    if (!info) continue;
    if (id === favourite) liked = true;
    if (!fitsType(recipe, id)) {
      if (id !== favourite) yuck = true;
      continue;
    }
    counted += 1;
    bonus += info.bonus ?? rules.pieceBonus;
    if (info.twinkle) noticed = true;
  }
  return { counted, bonus, yuck, favourite: liked, noticed };
}

/** ผลของท็อปปิ้งบนอาหารชิ้นนี้ ไม่ใช่อาหารหรือไม่ได้แต่งตอบไม่มีผล */
export function dishToppingEffect(item: string, favourite: string | null = null): ToppingEffect {
  const recipe = isDish(item) ? recipes[parseDish(item).recipe] : undefined;
  if (!recipe) return { counted: 0, bonus: 0, yuck: false, favourite: false, noticed: false };
  return toppingEffect(recipe, toppingsOf(item), favourite);
}

/** ตัวคูณราคาขายของอาหารที่แต่งแล้ว */
export const toppingPriceFactor = (item: string): number => 1 + dishToppingEffect(item).bonus;

export const favouriteToppingOf = (monster: string): string | null => monsters[monster]?.favouriteTopping ?? null;

/** ตัวคูณความชอบของจานนี้ต่อมอนสเตอร์ตัวนี้ (ขั้นความเยอะ แล้วคูณท็อปปิ้งที่ชอบ) */
export function toppingAffectionFactor(item: string, monster: string): number {
  const effect = dishToppingEffect(item, favouriteToppingOf(monster));
  return (1 + effect.bonus) * (effect.favourite ? rules.favouriteMultiplier : 1);
}

/**
 * แต่งอาหารที่เพิ่งทำ count จาน ด้วยท็อปปิ้งชุดเดียวกัน ทุกจานใช้ท็อปปิ้งจานละ 1 ชิ้นต่อการแตะ (ผู้ใช้เลือก 9 พ.ย. 2026)
 * ตอบ null เมื่อของไม่พอหรือกระเป๋าใส่ไม่ได้ ของจึงไม่หาย
 */
export function decorateDishes(world: World, item: string, count: number, toppings: string[]): World | null {
  const plain = plainDish(item);
  if (toppings.length === 0) return world;
  let bag = takeFromBag(world.bag, plain, count);
  if (!bag) return null;
  const needs = new Map<string, number>();
  for (const id of toppings) needs.set(id, (needs.get(id) ?? 0) + count);
  for (const [id, amount] of needs) {
    bag = takeTopping(bag, id, amount);
    if (!bag) return null;
  }
  const added = addToBag(bag, withToppings(plain, toppings), count);
  return added ? { ...world, bag: added } : null;
}
