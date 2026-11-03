import type { BagStack, Cooking, CookingSlot, World } from '../core/state';
import balance from '../data/balance.json';
import recipesJson from '../data/recipes.json';
import type { Recipe, Recipes } from '../data/schema';
import { addToBag, countOf, takeFromBag } from './farm';
import { fishGroupOf, fishGroupRank } from './fishing';

export const recipes = recipesJson as Recipes;
const { cooking: rules, gauges } = balance;
const MINUTES_PER_HOUR = 60;
const CAMPFIRE = 'campfire';

export const MYSTERY = 'mystery';
const DISH_PREFIX = 'dish_';
export const isDish = (item: string): boolean => item.startsWith(DISH_PREFIX);
export const isIngredient = (item: string): boolean => item.startsWith('ing_');
export const isRawProduce = (item: string): boolean => item.startsWith('produce_');

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

/** 3 ดาวรอจนกว่าวัตถุดิบจะมีดาว */
export const starsFor = (happiness: number): number => (happiness >= rules.twoStarHappiness ? 2 : 1);

/** จำนวนที่มีสำหรับวัตถุดิบในสูตร ปลาแรงก์ F นับปลาแรงก์ F ทุกชนิดในกระเป๋า */
export function haveFor(bag: BagStack[], item: string): number {
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

export function hasIngredients(bag: BagStack[], recipe: Recipe): boolean {
  return Object.entries(recipe.ingredients).every(([item, count]) => haveFor(bag, item) >= count);
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
    const key = fishGroupOf(item) ?? item;
    items[key] = (items[key] ?? 0) + count;
  }
  return items;
}

export function canCook(world: World, id: string): boolean {
  const recipe = recipes[id];
  return Boolean(recipe && !world.cooking.slot && canUseCampfire(recipe) && hasIngredients(world.bag, recipe));
}

function put(world: World, bag: BagStack[], slot: CookingSlot): World {
  return { ...world, bag, cooking: { slot } };
}

export function startCooking(world: World, id: string): World | null {
  const recipe = recipes[id];
  if (!recipe || !world.recipes.known.includes(id) || !canCook(world, id)) return null;
  const bag = takeAll(world.bag, recipe.ingredients);
  return bag && put(world, bag, { recipe: id, stars: starsFor(world.gauges.happiness), minutesLeft: minutesFor(recipe) });
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

/** ตรงสูตรจะปลดสูตรนั้น ผิดได้อาหารปริศนา วัตถุดิบหมดทั้งสองแบบ */
export function startExperiment(world: World, mix: Record<string, number>): World | null {
  if (world.cooking.slot || Object.keys(mix).length === 0) return null;
  const bag = takeAll(world.bag, mix);
  if (!bag) return null;
  const id = matchRecipe(mix);
  if (!id) return put(world, bag, { recipe: MYSTERY, stars: 1, minutesLeft: rules.mystery.minutes });
  const recipe = recipes[id]!;
  const known = world.recipes.known.includes(id) ? world.recipes.known : [...world.recipes.known, id];
  return {
    ...put(world, bag, { recipe: id, stars: starsFor(world.gauges.happiness), minutesLeft: minutesFor(recipe) }),
    recipes: { ...world.recipes, known },
  };
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

/** ตอบ null เมื่อยังไม่สุกหรือกระเป๋าเต็ม อาหารจึงยังรออยู่ที่กองไฟ ไม่หาย */
export function collectDish(world: World): World | null {
  const { slot } = world.cooking;
  if (!slot || !isCooked(slot)) return null;
  const bag = addToBag(world.bag, dishItem(slot.recipe, slot.stars), 1);
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
