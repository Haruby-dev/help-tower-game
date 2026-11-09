import type { World } from '../core/state';
import shopJson from '../data/shop.json';
import type { ShopData } from '../data/schema';
import { createRng } from '../core/rng';
import { canUseCampfire, recipes } from './cooking';
import { applyTransaction } from './economy';
import { addToBag, crops, seedItem } from './farm';
import { carePets, ownHome } from './pets';
import { hasMet, monsterTable } from './monsters';
import { giveBigTable, reputationStars, setTable } from './sets';

const shop = shopJson as ShopData;
/** สุ่มของวันนี้จาก seed ของเซฟกับวันที่ เปิดร้านกี่ครั้งก็ได้ของเดิม */
const DAY_MIX = 7919;
/** หมวดใหม่สุ่มคนละสาย ของสุ่มเดิมของแต่ละวัน (เมล็ด ปุ๋ย สูตร) จึงไม่เปลี่ยน */
const INGREDIENT_STREAM = 101;
const TOPPING_STREAM = 211;

export type ShopTab = 'daily' | 'random';
export type ShopGroup = 'treats' | 'seeds' | 'fertilizer' | 'random_seeds' | 'recipes' | 'ingredients' | 'toppings' | 'farm';

export interface Offer {
  id: string;
  tab: ShopTab;
  group: ShopGroup;
  /** item ของเข้ากระเป๋า · recipe สูตร · table โต๊ะใหญ่ (มีได้ชิ้นเดียว ไม่อยู่ในกระเป๋า) */
  kind: 'item' | 'recipe' | 'table' | 'home';
  /** ไอเท็มในกระเป๋า รหัสสูตร หรือรหัสโต๊ะ */
  target: string;
  price: number;
  currency: 'coins';
  /** จำนวนที่ขายวันนี้ null คือไม่จำกัด */
  stock: number | null;
  /** ราคาคูณเพราะยังไม่มีสัตว์เลี้ยงตัวนี้ */
}

type Rng = ReturnType<typeof createRng>;

const seedOffer = (crop: string, tab: ShopTab, group: ShopGroup): Offer => ({
  id: `${group}:${crop}`,
  tab,
  group,
  kind: 'item',
  target: seedItem(crop),
  price: crops[crop]!.seedPrice!,
  currency: 'coins',
  stock: null,
});

function pick<T>(items: T[], count: number, rng: Rng): T[] {
  const pool = [...items];
  const chosen: T[] = [];
  while (chosen.length < count && pool.length > 0) chosen.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!);
  return chosen;
}

/** จำนวนเต็มสุ่มในช่วง [น้อยสุด, มากสุด] ของไฟล์ข้อมูล */
const between = ([low = 0, high = low]: readonly number[], rng: Rng): number => low + Math.floor(rng.next() * (high - low + 1));

/**
 * สูตรขายถาวร (สเปก 8.1): สลัดผักผลไม้ตั้งแต่แรก · เมนูประจำใจชั้น 2/3/7/8/10 เมื่อเคยเจอมอนสเตอร์ตัวนั้น
 * ของหวานเมื่อชื่อเสียงร้านถึงดาวของชุดนั้น (ไม่สุ่ม)
 */
function onPermanentShelf(world: World, id: string, source: string): boolean {
  if (source === 'shop_permanent') return true;
  if (source === 'shop_heart') {
    return Object.entries(monsterTable).some(([monster, data]) => data.twinOf === undefined && data.signature.recipe === id && hasMet(world, monster));
  }
  if (source !== 'reputation') return false;
  const { stars } = reputationStars(world.sets.reputation);
  return Object.entries(shop.reputationRecipes).some(([level, list]) => Number(level) <= stars && list.includes(id));
}

const recipeOffer = (id: string, tab: ShopTab): Offer => ({
  id: `recipes:${id}`,
  tab,
  group: 'recipes',
  kind: 'recipe',
  target: id,
  price: Math.round(recipes[id]!.price * shop.recipePriceMultiplier),
  currency: 'coins',
  stock: null,
});

/** วัตถุดิบ: เครื่องปรุงไม่จำกัด นม เนย น้ำผึ้ง จำกัดต่อวัน · สุ่มวันนี้ เชอร์รีกับเหยื่อเรียกหีบ */
function ingredientOffers(world: World): Offer[] {
  const { daily, random } = shop.ingredients;
  const rng = createRng(world.seed + world.day * DAY_MIX + INGREDIENT_STREAM);
  const everyDay = daily.map(
    (entry): Offer => ({
      id: `ingredients:${entry.item}`,
      tab: 'daily',
      group: 'ingredients',
      kind: 'item',
      target: entry.item,
      price: entry.price,
      currency: 'coins',
      stock: entry.perDay ?? null,
    }),
  );
  // สุ่มทุกแถวทุกวันเสมอ ลำดับการสุ่มจึงไม่ขึ้นกับว่าแถวก่อนออกหรือไม่
  const today = random.flatMap((entry): Offer[] => {
    const shows = rng.next() < entry.chance;
    const stock = between(entry.stock, rng);
    return shows
      ? [{ id: `ingredients:${entry.item}`, tab: 'random', group: 'ingredients', kind: 'item', target: entry.item, price: entry.price, currency: 'coins', stock }]
      : [];
  });
  return [...everyDay, ...today];
}

/** ท็อปปิ้ง: สุ่มวันละ 2–3 ชนิด ชนิดละ 5–10 ชิ้น ทุกแถวเป็นของ "วันนี้" */
function toppingOffers(world: World): Offer[] {
  const rng = createRng(world.seed + world.day * DAY_MIX + TOPPING_STREAM);
  const chosen = pick(shop.toppings.items, between(shop.toppings.kinds, rng), rng);
  return shop.toppings.items
    .filter((entry) => chosen.includes(entry))
    .map(
      (entry): Offer => ({
        id: `toppings:${entry.item}`,
        tab: 'random',
        group: 'toppings',
        kind: 'item',
        target: entry.item,
        price: entry.price,
        currency: 'coins',
        stock: between(shop.toppings.stock, rng),
      }),
    );
}

/** บ้านสัตว์เลี้ยง (M8b): ขายเฉพาะตัวที่เจอแล้วและต้องมีบ้าน ราคาตาม pets.json (GDD × 10) ซื้อครั้งเดียว */
const homeOffers = (world: World): Offer[] =>
  carePets()
    .filter((pet) => pet.homePrice !== null && pet.care?.home && world.pets[pet.id] !== undefined)
    .map((pet) => ({ id: `farm:${pet.care!.home!}`, tab: 'daily', group: 'farm', kind: 'home', target: pet.care!.home!, price: pet.homePrice!, currency: 'coins', stock: null }));

/** สัตว์ที่อยู่บ้านหลังนี้ */
export const petOfHome = (home: string): string | null => carePets().find((pet) => pet.care?.home === home)?.id ?? null;

const bigTableOffer = (): Offer => ({
  id: `farm:${setTable.bigTable.item}`,
  tab: 'daily',
  group: 'farm',
  kind: 'table',
  target: setTable.bigTable.item,
  price: setTable.bigTable.price,
  currency: 'coins',
  stock: null,
});

/**
 * ขายทุกวัน: แมวเลีย 4 รส เมล็ดพืชเริ่มเกม ปุ๋ยระดับ 2 สูตรขายถาวร วัตถุดิบ และโต๊ะใหญ่
 * สุ่มวันนี้: เมล็ดจากร้าน 3 ชนิด ปุ๋ยระดับ 3 (บางวัน) สูตรที่ยังไม่รู้และทำที่กองไฟได้ 2 สูตร วัตถุดิบบางอย่าง และท็อปปิ้ง
 */
export function offersFor(world: World): Offer[] {
  const treats = shop.treats.map(
    (treat): Offer => ({ id: `treats:${treat.item}`, tab: 'daily', group: 'treats', kind: 'item', target: treat.item, price: treat.price, currency: 'coins', stock: null }),
  );
  const starter = Object.entries(crops)
    // พืชเริ่มเกมกับพืชที่ขายทุกวัน (มะนาว ผักชี)
    .filter(([, crop]) => (crop.source === 'start' || crop.source === 'daily') && crop.seedPrice !== null)
    .map(([id]) => seedOffer(id, 'daily', 'seeds'));
  const rng = createRng(world.seed + world.day * DAY_MIX);
  const shopCrops = Object.entries(crops)
    .filter(([, crop]) => crop.source === 'shop' && crop.seedPrice !== null)
    .map(([id]) => id);
  const randomSeeds = pick(shopCrops, shop.randomSeeds, rng).map((id) => seedOffer(id, 'random', 'random_seeds'));
  const unknown = Object.entries(recipes)
    .filter(([id, recipe]) => recipe.source === 'shop' && canUseCampfire(recipe) && !world.recipes.known.includes(id))
    .map(([id]) => id)
    .sort();
  const recipeOffers = pick(unknown, shop.randomRecipes, rng).map((id) => recipeOffer(id, 'random'));
  // สูตรขายถาวรอยู่เหนือสูตรสุ่ม (ขั้นที่ 7) ซื้อแล้วหายจากชั้นเหมือนสูตรอื่น
  const permanent = Object.entries(recipes)
    .filter(([id, recipe]) => onPermanentShelf(world, id, recipe.source))
    .map(([id]) => recipeOffer(id, 'daily'));
  // ปุ๋ยสุ่มหลังของเดิม ของสุ่มเดิมของแต่ละวันจึงไม่เปลี่ยน
  const fertilizers = shop.fertilizers
    .filter((entry) => entry.tab === 'daily' || rng.next() < entry.chance)
    .map(
      (entry): Offer => ({ id: `fertilizer:${entry.item}`, tab: entry.tab, group: 'fertilizer', kind: 'item', target: entry.item, price: entry.price, currency: 'coins', stock: null }),
    );
  const daily = fertilizers.filter((offer) => offer.tab === 'daily');
  const random = fertilizers.filter((offer) => offer.tab === 'random');
  return [...treats, ...starter, ...daily, ...randomSeeds, ...random, ...permanent, ...recipeOffers, ...ingredientOffers(world), ...toppingOffers(world), bigTableOffer(), ...homeOffers(world)];
}

export const tasteOfTreat = (item: string): ShopData['treats'][number]['taste'] | null =>
  shop.treats.find((treat) => treat.item === item)?.taste ?? null;

/** ซื้อของจำนวนจำกัดไปแล้วกี่ชิ้นวันนี้ */
export const boughtToday = (world: World, offer: Offer): number => (world.shop.day === world.day ? (world.shop.bought[offer.id] ?? 0) : 0);

/** เหลือขายวันนี้กี่ชิ้น ของไม่จำกัดตอบ Infinity */
export const stockLeft = (world: World, offer: Offer): number => (offer.stock === null ? Infinity : Math.max(0, offer.stock - boughtToday(world, offer)));

/** สูตรที่รู้แล้วกับโต๊ะที่มีแล้วซื้อซ้ำไม่ได้ */
export const alreadyOwned = (world: World, offer: Offer): boolean =>
  (offer.kind === 'recipe' && world.recipes.known.includes(offer.target)) ||
  (offer.kind === 'table' && world.sets.bigTable.owned) ||
  (offer.kind === 'home' && world.pets[petOfHome(offer.target) ?? '']?.homeOwned === true);

/** สูตรกับโต๊ะซื้อได้ครั้งเดียว ของอื่นซื้อได้ตามจำนวนที่เงินพอและของที่เหลือวันนี้ */
export const maxQuantity = (world: World, offer: Offer): number => {
  if (offer.kind !== 'item') return alreadyOwned(world, offer) || offer.price > world.wallet.coins ? 0 : 1;
  return Math.min(Math.floor(world.wallet.coins / offer.price), stockLeft(world, offer));
};

/** เหรียญไม่พอ กระเป๋าเต็ม ของหมด หรือมีแล้ว ตอบ null เงินจึงไม่หาย · ทุกการซื้อเขียนรายการในกระเป๋าเงิน */
export function buyOffer(world: World, offer: Offer, quantity: number): World | null {
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  const cost = offer.price * quantity;
  if (cost > world.wallet.coins || quantity > stockLeft(world, offer) || alreadyOwned(world, offer)) return null;
  let next: World;
  if (offer.kind === 'recipe') {
    if (quantity !== 1) return null;
    next = { ...world, recipes: { ...world.recipes, known: [...world.recipes.known, offer.target] } };
  } else if (offer.kind === 'table') {
    if (quantity !== 1) return null;
    next = giveBigTable(world);
  } else if (offer.kind === 'home') {
    const pet = petOfHome(offer.target);
    if (quantity !== 1 || !pet) return null;
    next = ownHome(world, pet);
  } else {
    const bag = addToBag(world.bag, offer.target, quantity);
    if (!bag) return null;
    next = { ...world, bag };
  }
  if (offer.stock !== null) {
    const bought = world.shop.day === world.day ? world.shop.bought : {};
    next = { ...next, shop: { day: world.day, bought: { ...bought, [offer.id]: boughtToday(world, offer) + quantity } } };
  }
  return applyTransaction(next, offer.currency, -cost, 'wallet.shop_buy', 'wallet.category_shop');
}
