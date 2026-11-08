import type { BagStack, World } from '../core/state';
import type { Recipe, Sets, TraySize } from '../data/schema';
import setsJson from '../data/sets.json';
import { isDish, parseDish, plainDish, recipes } from './cooking';
import { addToBag, countOf, takeFromBag } from './farm';

/**
 * จัดชุด (งานอาหารโซน 1 ขั้นที่ 6 · สเปกข้อ 6 · GDD "ชุดข้าว / สำรับ")
 * วางอาหารที่ทำแล้วอิสระบนถาดสาน เล็ก 2 · กลาง 3 · ใหญ่ 4 ชิ้น ถาดใช้แล้วหมด ได้ของชิ้นเดียว `set_<ขนาด>|<อาหาร>|<อาหาร>` (อาหารเรียงตามรหัส ชุดเหมือนกันจึงซ้อนกัน)
 * ตรงสูตรลับได้ชื่อชุด (คอมโบ) ราคาและความชอบเพิ่ม ชื่อเสียงร้านขึ้น · ของที่ไม่ใช่กับข้าวใส่ได้แต่มอนสเตอร์ทำหน้าจะอ้วก (ยกเว้นในคอมโบ)
 */
export const setTable = setsJson as unknown as Sets;
const SET_PREFIX = 'set_';
const PART_SEPARATOR = '|';
export const TRAY_SIZES: TraySize[] = ['small', 'medium', 'large'];

export const isSet = (item: string): boolean => item.startsWith(SET_PREFIX);

export interface SetParts {
  size: TraySize;
  dishes: string[];
}

export function parseSet(item: string): SetParts | null {
  if (!isSet(item)) return null;
  const [head, ...dishes] = item.split(PART_SEPARATOR);
  const size = head!.slice(SET_PREFIX.length) as TraySize;
  return TRAY_SIZES.includes(size) ? { size, dishes } : null;
}

export const setItem = (size: TraySize, dishes: string[]): string => [`${SET_PREFIX}${size}`, ...[...dishes].sort()].join(PART_SEPARATOR);

const recipeOf = (dish: string): Recipe | undefined => recipes[parseDish(dish).recipe];

/** ชนิดของชิ้นในชุด ใช้ทำป้ายในหน้าจัดชุด: ข้าว · กับข้าว (รวมแกงซุปน้ำพริก) · ของหวาน · เครื่องดื่ม · จานเดียว */
export type PieceKind = 'rice' | 'side' | 'sweet' | 'drink' | 'other';
export function pieceKind(dish: string): PieceKind {
  const recipe = recipeOf(dish);
  if (!recipe) return 'other';
  if (parseDish(dish).recipe === setTable.rice) return 'rice';
  if (recipe.sideDish || recipe.soup) return 'side';
  if (recipe.category === 'sweet') return 'sweet';
  if (recipe.category === 'drink') return 'drink';
  return 'other';
}

/** ของที่ไม่ใช่ข้าวหรือกับข้าว ในชุดอิสระมอนสเตอร์ทำหน้าจะอ้วก (ไม่มีผลเสีย) */
export const isYuckPiece = (dish: string): boolean => {
  const kind = pieceKind(dish);
  return kind !== 'rice' && kind !== 'side';
};

/** ช่องในสูตรคอมโบรับสูตรนี้ไหม (รหัสสูตรตรง ๆ หรือ @กลุ่ม) */
function slotFits(slot: string, recipe: string): boolean {
  if (!slot.startsWith('@')) return slot === recipe;
  const group = setTable.groups[slot.slice(1)];
  const info = recipes[recipe];
  if (!group || !info) return false;
  if ('flag' in group) return info[group.flag] === true;
  if ('recipes' in group) return group.recipes.includes(recipe);
  return group.categories.includes(info.category);
}

/** ทุกช่องของชุดนี้มีสูตรที่รู้แล้วลงได้ (ใช้เลือกชุดที่จีโอใบ้ เช่น ชุดน้ำพริกรอจนรู้สูตรน้ำพริก) */
export const comboReachable = (combo: string, known: readonly string[]): boolean =>
  setTable.combos[combo]?.slots.every((slot) => known.some((recipe) => slotFits(slot, recipe))) ?? false;

/** ความเจาะจงของช่อง: รหัสสูตรตรง 3 · รายชื่อสูตร 2 · ธงหรือหมวด 1 (ตรงหลายชุดขึ้นชุดที่เจาะจงกว่า) */
const slotWeight = (slot: string): number => {
  if (!slot.startsWith('@')) return 3;
  const group = setTable.groups[slot.slice(1)];
  return group && 'recipes' in group ? 2 : 1;
};

/** ทุกชิ้นลงช่องของสูตรได้ครบหนึ่งต่อหนึ่ง (จับคู่แบบลองทุกทาง ชุดใหญ่สุด 4 ชิ้น) */
function matches(slots: string[], recipeIds: string[]): boolean {
  if (slots.length !== recipeIds.length) return false;
  const used = new Array<boolean>(slots.length).fill(false);
  const place = (at: number): boolean => {
    if (at === recipeIds.length) return true;
    for (let slot = 0; slot < slots.length; slot += 1) {
      if (used[slot] || !slotFits(slots[slot]!, recipeIds[at]!)) continue;
      used[slot] = true;
      if (place(at + 1)) return true;
      used[slot] = false;
    }
    return false;
  };
  return place(0);
}

/** ชุดคอมโบของอาหารชุดนี้บนถาดขนาดนี้ null คือชุดอิสระ (วางลำดับไหนก็ได้ ตรงหลายชุดขึ้นชุดที่เจาะจงกว่า) */
export function comboOf(size: TraySize, dishes: string[]): string | null {
  const recipeIds = dishes.map((dish) => parseDish(plainDish(dish)).recipe);
  let best: { id: string; weight: number } | null = null;
  for (const [id, combo] of Object.entries(setTable.combos)) {
    if (combo.tray !== size || !matches(combo.slots, recipeIds)) continue;
    const weight = combo.slots.reduce((sum, slot) => sum + slotWeight(slot), 0);
    if (!best || weight > best.weight) best = { id, weight };
  }
  return best?.id ?? null;
}

export const setCombo = (item: string): string | null => {
  const parts = parseSet(item);
  return parts ? comboOf(parts.size, parts.dishes) : null;
};

/** ตัวคูณราคาของชุด: อิสระ ×1.0 · อิสระมีข้าว ×1.1 · คอมโบ ×1.2 / ×1.35 / ×1.5 · ชุดอิสระที่มีของจะอ้วกไม่ได้โบนัส */
export function setBonus(item: string): number {
  const parts = parseSet(item);
  if (!parts) return 1;
  if (comboOf(parts.size, parts.dishes)) return setTable.bonus.combo[parts.size];
  if (parts.dishes.some(isYuckPiece)) return 1;
  return parts.dishes.some((dish) => pieceKind(dish) === 'rice') ? setTable.bonus.freeRice : setTable.bonus.free;
}

/** ชุดถาดเล็กวางบนจานถาดหอคอยได้ ถาดกลางกับใหญ่วางได้แค่บนโต๊ะใหญ่ */
export const fitsTowerTray = (item: string): boolean => parseSet(item)?.size === 'small';
export const needsBigTable = (item: string): boolean => {
  const parts = parseSet(item);
  return parts !== null && setTable.trays[parts.size].bigTable;
};

/** อาหารที่จัดลงชุดได้ (อาหารที่ทำสำเร็จทุกจาน ยกเว้นอาหารปริศนา) */
export const setCandidates = (bag: BagStack[]): BagStack[] =>
  bag.filter((stack) => isDish(stack.item) && recipeOf(stack.item) !== undefined && !isSet(stack.item));

/** ดาวชื่อเสียงร้าน 1–5 กับคะแนนที่ยังขาดถึงดาวถัดไป (null คือดาวเต็มแล้ว) */
export function reputationStars(points: number): { stars: number; toNext: number | null } {
  const steps = setTable.reputation.stars;
  let stars = 1;
  steps.forEach((from, index) => {
    if (points >= from) stars = index + 1;
  });
  const next = steps[stars];
  return { stars, toNext: next === undefined ? null : next - points };
}

export interface MadeSet {
  world: World;
  item: string;
  combo: string | null;
  /** ครั้งแรกที่จัดคอมโบนี้ (บันทึกลงสมุดสูตร ได้ชื่อเสียง +30) */
  first: boolean;
}

/** จัดชุด: ใช้ถาด 1 ใบกับอาหารชิ้นละ 1 ได้ชุด 1 ชิ้น ตอบ null เมื่อของไม่ครบหรือกระเป๋าเต็ม (ของไม่หาย) */
export function makeSet(world: World, size: TraySize, dishes: string[]): MadeSet | null {
  const tray = setTable.trays[size];
  if (dishes.length < 1 || dishes.length > tray.pieces) return null;
  if (dishes.some((dish) => !isDish(dish) || recipeOf(dish) === undefined || isSet(dish))) return null;
  let bag = takeFromBag(world.bag, tray.item, 1);
  if (!bag) return null;
  const counts = new Map<string, number>();
  for (const dish of dishes) counts.set(dish, (counts.get(dish) ?? 0) + 1);
  for (const [dish, count] of counts) {
    if (countOf(bag, dish) < count) return null;
    bag = takeFromBag(bag, dish, count)!;
  }
  const item = setItem(size, dishes);
  const added = addToBag(bag, item, 1);
  if (!added) return null;
  const combo = dishes.length === tray.pieces ? comboOf(size, dishes) : null;
  const first = combo !== null && !world.sets.combos.includes(combo);
  const gained = combo ? setTable.reputation.combo[size] + (first ? setTable.reputation.firstCombo : 0) : 0;
  const sets = {
    ...world.sets,
    reputation: world.sets.reputation + gained,
    combos: first ? [...world.sets.combos, combo!] : world.sets.combos,
  };
  return { world: { ...world, bag: added, sets }, item, combo, first };
}

// ---------- โต๊ะใหญ่ ----------

/** วางชุดถาดกลางหรือใหญ่บนโต๊ะใหญ่ (ถือได้ 1 ชุด) */
export function putOnBigTable(world: World, item: string): World | null {
  const table = world.sets.bigTable;
  if (!table.owned || table.set !== null || !needsBigTable(item)) return null;
  const bag = takeFromBag(world.bag, item, 1);
  if (!bag) return null;
  return { ...world, bag, sets: { ...world.sets, bigTable: { ...table, set: item } } };
}

/** เก็บชุดคืนจากโต๊ะใหญ่ ตอบ null เมื่อกระเป๋าเต็ม */
export function takeFromBigTable(world: World): World | null {
  const table = world.sets.bigTable;
  if (!table.set) return null;
  const bag = addToBag(world.bag, table.set, 1);
  if (!bag) return null;
  return { ...world, bag, sets: { ...world.sets, bigTable: { ...table, set: null } } };
}

/** ปุ่มทดสอบ: โต๊ะใหญ่ (ซื้อได้ในจีโอมาร์ทในขั้นที่ 7) */
export const giveBigTable = (world: World): World => ({ ...world, sets: { ...world.sets, bigTable: { ...world.sets.bigTable, owned: true } } });
