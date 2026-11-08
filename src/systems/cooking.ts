import type { BagStack, Cooking, CookingSlot, World } from '../core/state';
import balance from '../data/balance.json';
import ingredientsJson from '../data/ingredients.json';
import recipesJson from '../data/recipes.json';
import type { Ingredients, Recipe, Recipes } from '../data/schema';
import { addToBag, countOf, takeFromBag } from './farm';
import { fishOfItem, fishTable, isFish } from './fishing';
import type { Rng } from '../core/rng';
import { baseItem, carriesStars, defaultStarPick, dishStars, withStars } from './stars';

export const recipes = recipesJson as Recipes;
const ingredientTable = ingredientsJson as Ingredients;
const { cooking: rules, gauges } = balance;
const MINUTES_PER_HOUR = 60;
const CAMPFIRE = 'campfire';

export const MYSTERY = 'mystery';
const DISH_PREFIX = 'dish_';
export const isDish = (item: string): boolean => item.startsWith(DISH_PREFIX);
export const isIngredient = (item: string): boolean => item.startsWith('ing_');
export const isRawProduce = (item: string): boolean => baseItem(item).startsWith('produce_');

export const dishItem = (recipe: string, stars: number): string => `${DISH_PREFIX}${recipe}_${stars}`;
/** อาหารที่แต่งแล้วเก็บท็อปปิ้งต่อท้ายรหัส `dish_<สูตร>_<ดาว>~<ท็อปปิ้ง>.<ท็อปปิ้ง>` (systems/toppings.ts) อาหารเก่าไม่มีส่วนนี้ */
export const TOPPING_SEPARATOR = '~';
/** รหัสอาหารโดยไม่มีท็อปปิ้ง */
export const plainDish = (item: string): string => item.split(TOPPING_SEPARATOR)[0]!;

export function parseDish(item: string): { recipe: string; stars: number } {
  const body = plainDish(item).slice(DISH_PREFIX.length);
  const split = body.lastIndexOf('_');
  return { recipe: body.slice(0, split), stars: Number(body.slice(split + 1)) };
}

const rankOf = (recipe: Recipe): { minutes: number; fullness: number; equipment: string } => {
  const rank = rules.ranks[recipe.rank as keyof typeof rules.ranks];
  if (!rank) throw new Error(`unknown rank ${recipe.rank}`);
  return rank;
};

/** น้ำพริกกับทอดมันทำที่ครกหินเก่าเท่านั้น (zone1 food update 2) */
export const canUseCampfire = (recipe: Recipe): boolean =>
  recipe.method !== 'mortar' && (recipe.category === 'drink' || rankOf(recipe).equipment === CAMPFIRE);

/** ภาชนะ ท่า และภาพกองไฟของวิธีทำสูตรนี้ (balance.cooking.methods) */
export const cookMethodOf = (id: string): (typeof rules.methods)[Recipe['method']] | null => {
  const recipe = recipes[id];
  return recipe ? rules.methods[recipe.method] : null;
};

/** สูตรที่นับในสมุด ข้าวสวยเป็นส่วนประกอบชุด ไม่นับ */
export const countsAsRecipe = (recipe: Recipe): boolean => !recipe.setPart;

const groupOf = (item: string): Ingredients[string] | undefined => {
  if (!isIngredient(item)) return undefined;
  const entry = ingredientTable[item.slice('ing_'.length)];
  return entry?.fish || entry?.anyOf ? entry : undefined;
};

/** วัตถุดิบในสูตรนี้เป็นกลุ่ม (ปลาชนิดไหนก็ได้ หมึกชนิดไหนก็ได้ ลูกชิ้นปลาหรือกุ้ง) */
export const isIngredientGroup = (item: string): boolean => groupOf(item) !== undefined;

/** ของในกระเป๋านี้ใช้เป็นวัตถุดิบในสูตรได้ไหม · "ปลา" นับเฉพาะปลา ไม่นับกุ้ง ปู หมึก */
export function fitsIngredient(item: string, stock: string): boolean {
  if (stock === item) return true;
  const group = groupOf(item);
  if (!group) return false;
  if (group.anyOf) return group.anyOf.includes(baseItem(stock));
  if (!group.fish || !isFish(stock)) return false;
  const fish = fishTable[fishOfItem(stock)]!;
  return fish.kind === group.fish.kind && (group.fish.rank === undefined || fish.rank === group.fish.rank);
}

/** ของในกระเป๋าที่ใช้แทนวัตถุดิบในสูตรได้ ตามลำดับในกระเป๋า (ของที่ใส่ก่อนถูกใช้ก่อน) */
export const stockFitting = (bag: BagStack[], item: string): string[] => [...new Set(bag.filter((stack) => fitsIngredient(item, stack.item)).map((stack) => stack.item))];

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

/** จำนวนที่มีสำหรับวัตถุดิบในสูตร กลุ่มวัตถุดิบนับทุกชนิดในกลุ่ม · ผักนับเฉพาะดาวที่เลือก */
export function haveFor(bag: BagStack[], item: string, picks: StarPicks = {}, need = 1): number {
  if (carriesStars(item)) return countOf(bag, stockItem(bag, item, need, picks));
  if (!isIngredientGroup(item)) return countOf(bag, item);
  return stockFitting(bag, item).reduce((sum, kind) => sum + countOf(bag, kind), 0);
}

/** หยิบตามลำดับในกระเป๋า ของในกลุ่มที่ใส่ก่อนถูกใช้ก่อน */
function takeFor(bag: BagStack[], item: string, count: number): BagStack[] | null {
  if (!isIngredientGroup(item)) return takeFromBag(bag, item, count);
  if (haveFor(bag, item) < count) return null;
  let left: BagStack[] = bag;
  let need = count;
  for (const kind of stockFitting(bag, item)) {
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

/** ทำครั้งเดียว เวลาเดียว (ผู้ใช้ตัดสิน 8 พ.ย. 2026 19:24): ทำกี่จานก็ใช้เวลาของแรงก์ครั้งเดียว ไม่คูณจำนวนจาน */
export const batchMinutes = (recipe: Recipe, _count: number): number => minutesFor(recipe);

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
