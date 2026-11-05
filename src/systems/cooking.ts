import type { BagStack, Cooking, CookingSlot, World } from '../core/state';
import balance from '../data/balance.json';
import recipesJson from '../data/recipes.json';
import type { Recipe, Recipes } from '../data/schema';
import { addToBag, countOf, takeFromBag } from './farm';
import { fishGroupOf, fishGroupRank } from './fishing';
import type { Rng } from '../core/rng';
import { baseItem, carriesStars, defaultStarPick, dishStars, starsOf, withStars } from './stars';

export const recipes = recipesJson as Recipes;
const { cooking: rules, gauges } = balance;
const MINUTES_PER_HOUR = 60;
const CAMPFIRE = 'campfire';

export const MYSTERY = 'mystery';
const DISH_PREFIX = 'dish_';
export const isDish = (item: string): boolean => item.startsWith(DISH_PREFIX);
export const isIngredient = (item: string): boolean => item.startsWith('ing_');
export const isRawProduce = (item: string): boolean => baseItem(item).startsWith('produce_');

export const dishItem = (recipe: string, stars: number): string => `${DISH_PREFIX}${recipe}_${stars}`;

export function parseDish(item: string): { recipe: string; stars: number } {
  const body = item.slice(DISH_PREFIX.length);
  const split = body.lastIndexOf('_');
  return { recipe: body.slice(0, split), stars: Number(body.slice(split + 1)) };
}

const rankOf = (recipe: Recipe): { minutes: number; fullness: number; equipment: string } => {
  const rank = rules.ranks[recipe.rank as keyof typeof rules.ranks];
  if (!rank) throw new Error(`unknown rank ${recipe.rank}`);
  return rank;
};

export const canUseCampfire = (recipe: Recipe): boolean => recipe.category === 'drink' || rankOf(recipe).equipment === CAMPFIRE;

export const minutesFor = (recipe: Recipe): number => (recipe.category === 'drink' ? rules.drink.minutes : rankOf(recipe).minutes);

/** ดาวที่ผู้เล่นเลือกต่อวัตถุดิบที่มีดาว (คีย์คือวัตถุดิบในสูตร เช่น produce_strawberry) ที่ไม่ได้เลือกใช้ค่าเริ่ม */
export type StarPicks = Record<string, number>;

/** ดาวที่ใช้จริงของวัตถุดิบนี้ ค่าเริ่มคือดาวต่ำสุดที่มีพอทำ 1 จาน */
export const pickedStars = (bag: BagStack[], item: string, need: number, picks: StarPicks): number => picks[item] ?? defaultStarPick(bag, item, need);

/** รหัสของในกระเป๋าที่จะหยิบสำหรับวัตถุดิบในสูตร ผักใส่ดาวที่เลือก ของอื่นใช้รหัสเดิม */
const stockItem = (bag: BagStack[], item: string, need: number, picks: StarPicks): string =>
  carriesStars(item) ? withStars(item, pickedStars(bag, item, need, picks)) : item;

/** ดาวของอาหารก่อนสุ่มโบนัสเกจสุข = ดาวต่ำสุดของวัตถุดิบที่มีดาว */
export function baseDishStars(bag: BagStack[], recipe: Recipe, picks: StarPicks = {}): number {
  const levels = Object.entries(recipe.ingredients)
    .filter(([item]) => carriesStars(item))
    .map(([item, need]) => pickedStars(bag, item, need, picks));
  return levels.length > 0 ? Math.min(...levels) : 1;
}

/** จำนวนที่มีสำหรับวัตถุดิบในสูตร ปลาแรงก์ F นับปลาแรงก์ F ทุกชนิดในกระเป๋า · ผักนับเฉพาะดาวที่เลือก */
export function haveFor(bag: BagStack[], item: string, picks: StarPicks = {}, need = 1): number {
  if (carriesStars(item)) return countOf(bag, stockItem(bag, item, need, picks));
  if (!fishGroupRank(item)) return countOf(bag, item);
  return countOf(bag, item) + bag.filter((stack) => fishGroupOf(stack.item) === item).reduce((sum, stack) => sum + stack.count, 0);
}

/** หยิบตามลำดับในกระเป๋า ปลาที่ใส่ก่อนถูกใช้ก่อน */
function takeFor(bag: BagStack[], item: string, count: number): BagStack[] | null {
  if (!fishGroupRank(item)) return takeFromBag(bag, item, count);
  if (haveFor(bag, item) < count) return null;
  let left: BagStack[] = bag;
  let need = count;
  for (const kind of [item, ...new Set(bag.filter((stack) => fishGroupOf(stack.item) === item).map((stack) => stack.item))]) {
    const moved = Math.min(need, countOf(left, kind));
    if (moved > 0) left = takeFromBag(left, kind, moved)!;
    need -= moved;
  }
  return left;
}

/** ทำได้มากสุดกี่จาน นับจากชุดวัตถุดิบครบที่มีในกระเป๋า (ผักนับเฉพาะดาวที่เลือก) ไม่มีเพดานอื่น */
export function maxBatch(bag: BagStack[], recipe: Recipe, picks: StarPicks = {}): number {
  return Math.min(...Object.entries(recipe.ingredients).map(([item, count]) => Math.floor(haveFor(bag, item, picks, count) / count)));
}

/** วัตถุดิบที่ใช้ทั้งรอบ */
export const batchIngredients = (recipe: Recipe, count: number): Record<string, number> =>
  Object.fromEntries(Object.entries(recipe.ingredients).map(([item, need]) => [item, need * count]));

/** เวลาทำทั้งรอบ คูณจำนวนจานตรง ๆ ไม่มีส่วนลด */
export const batchMinutes = (recipe: Recipe, count: number): number => minutesFor(recipe) * count;

export function hasIngredients(bag: BagStack[], recipe: Recipe, picks: StarPicks = {}): boolean {
  return Object.entries(recipe.ingredients).every(([item, count]) => haveFor(bag, item, picks, count) >= count);
}

/** วัตถุดิบทั้งรอบเป็นรหัสของจริงในกระเป๋า (ผักใส่ดาวที่เลือก) */
function stockFor(bag: BagStack[], recipe: Recipe, count: number, picks: StarPicks): Record<string, number> {
  return Object.fromEntries(Object.entries(recipe.ingredients).map(([item, need]) => [stockItem(bag, item, need, picks), need * count]));
}

function takeAll(bag: BagStack[], items: Record<string, number>): BagStack[] | null {
  let left: BagStack[] | null = bag;
  for (const [item, count] of Object.entries(items)) {
    left = left && takeFor(left, item, count);
  }
  return left;
}

/** ปลาที่ผสมเองนับเป็นปลาแรงก์ของมัน จะได้ตรงกับสูตรที่เขียนว่าปลาแรงก์ F */
function asRecipeItems(mix: Record<string, number>): Record<string, number> {
  const items: Record<string, number> = {};
  for (const [item, count] of Object.entries(mix)) {
    const key = fishGroupOf(item) ?? baseItem(item);
    items[key] = (items[key] ?? 0) + count;
  }
  return items;
}

export function canCook(world: World, id: string, picks: StarPicks = {}): boolean {
  const recipe = recipes[id];
  return Boolean(recipe && !world.cooking.slot && canUseCampfire(recipe) && hasIngredients(world.bag, recipe, picks));
}

function put(world: World, bag: BagStack[], slot: CookingSlot): World {
  return { ...world, bag, cooking: { slot } };
}

/** หยิบวัตถุดิบ × จำนวนจานตอนเริ่ม ดาวอาหาร = ดาวต่ำสุดของผักที่เลือก สุ่มโบนัสเกจสุขครั้งเดียวทั้งรอบ */
export function startCooking(world: World, id: string, count: number, picks: StarPicks, rng: Rng): World | null {
  const recipe = recipes[id];
  if (!recipe || !world.recipes.known.includes(id) || !canCook(world, id, picks)) return null;
  if (!Number.isInteger(count) || count < 1 || count > maxBatch(world.bag, recipe, picks)) return null;
  const stars = dishStars([baseDishStars(world.bag, recipe, picks)], world.gauges.happiness, rng);
  const bag = takeAll(world.bag, stockFor(world.bag, recipe, count, picks));
  return bag && put(world, bag, { recipe: id, stars, minutesLeft: batchMinutes(recipe, count), count });
}

/** ของที่ผสมต้องตรงสูตรทุกอย่าง และเป็นเมนูที่กองไฟทำได้ */
export function matchRecipe(raw: Record<string, number>): string | null {
  const mix = asRecipeItems(raw);
  const kinds = Object.keys(mix);
  const found = Object.entries(recipes).find(
    ([, recipe]) =>
      canUseCampfire(recipe) &&
      Object.keys(recipe.ingredients).length === kinds.length &&
      kinds.every((item) => recipe.ingredients[item] === mix[item]),
  );
  return found ? found[0] : null;
}

/** ตรงสูตรจะปลดสูตรนั้น ผิดได้อาหารปริศนา วัตถุดิบหมดทั้งสองแบบ · ดาวคิดจากผักที่ใส่จริง */
export function startExperiment(world: World, mix: Record<string, number>, rng: Rng): World | null {
  if (world.cooking.slot || Object.keys(mix).length === 0) return null;
  const bag = takeAll(world.bag, mix);
  if (!bag) return null;
  const id = matchRecipe(mix);
  if (!id) return put(world, bag, { recipe: MYSTERY, stars: 1, minutesLeft: rules.mystery.minutes, count: 1 });
  const recipe = recipes[id]!;
  const known = world.recipes.known.includes(id) ? world.recipes.known : [...world.recipes.known, id];
  return {
    ...put(world, bag, { recipe: id, stars: mixStars(mix, world.gauges.happiness, rng), minutesLeft: minutesFor(recipe), count: 1 }),
    recipes: { ...world.recipes, known },
  };
}

function mixStars(mix: Record<string, number>, happiness: number, rng: Rng): number {
  const levels = Object.keys(mix).flatMap((item) => (carriesStars(item) ? [starsOf(item) ?? 1] : []));
  return dishStars(levels, happiness, rng);
}

export function tickCooking(cooking: Cooking, hours: number): Cooking {
  const { slot } = cooking;
  if (!slot || slot.minutesLeft <= 0) return cooking;
  return { slot: { ...slot, minutesLeft: Math.max(0, slot.minutesLeft - hours * MINUTES_PER_HOUR) } };
}

/** นอนข้ามคืน อาหารที่ค้างไว้สุกเสมอ */
export function finishOvernight(cooking: Cooking): Cooking {
  return cooking.slot ? { slot: { ...cooking.slot, minutesLeft: 0 } } : cooking;
}

export const isCooked = (slot: CookingSlot | null): boolean => slot !== null && slot.minutesLeft <= 0;

/** เก็บทุกจานในรอบพร้อมกัน · ตอบ null เมื่อยังไม่สุกหรือกระเป๋าใส่ไม่พอ อาหารจึงยังรออยู่ที่กองไฟ ไม่หาย */
export function collectDish(world: World): World | null {
  const { slot } = world.cooking;
  if (!slot || !isCooked(slot)) return null;
  const bag = addToBag(world.bag, dishItem(slot.recipe, slot.stars), slot.count);
  if (!bag) return null;
  if (slot.recipe === MYSTERY) {
    const happiness = Math.max(gauges.min, world.gauges.happiness - rules.mystery.happinessPenalty);
    return { ...world, bag, cooking: { slot: null }, gauges: { ...world.gauges, happiness } };
  }
  const best = Math.max(world.recipes.bestStars[slot.recipe] ?? 0, slot.stars);
  return {
    ...world,
    bag,
    cooking: { slot: null },
    recipes: { ...world.recipes, bestStars: { ...world.recipes.bestStars, [slot.recipe]: best } },
  };
}

export function fullnessOf(item: string): number | null {
  if (isRawProduce(item)) return rules.rawFullness;
  if (!isDish(item)) return null;
  const { recipe: id } = parseDish(item);
  if (id === MYSTERY) return rules.mystery.fullness;
  const recipe = recipes[id];
  if (!recipe) return null;
  return recipe.category === 'drink' ? rules.drink.fullness : rankOf(recipe).fullness;
}

export function eatItem(world: World, item: string): World | null {
  const fullness = fullnessOf(item);
  const bag = takeFromBag(world.bag, item, 1);
  if (fullness === null || !bag) return null;
  return { ...world, bag, gauges: { ...world.gauges, fullness: Math.min(gauges.max, world.gauges.fullness + fullness) } };
}
