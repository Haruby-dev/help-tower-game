import type { World } from '../core/state';
import shopJson from '../data/shop.json';
import type { ShopData } from '../data/schema';
import { createRng } from '../core/rng';
import { canUseCampfire, recipes } from './cooking';
import { applyTransaction } from './economy';
import { addToBag, crops, seedItem } from './farm';

const shop = shopJson as ShopData;
/** สุ่มของวันนี้จาก seed ของเซฟกับวันที่ เปิดร้านกี่ครั้งก็ได้ของเดิม */
const DAY_MIX = 7919;

export type ShopTab = 'daily' | 'random';
export type ShopGroup = 'treats' | 'seeds' | 'fertilizer' | 'random_seeds' | 'recipes';

export interface Offer {
  id: string;
  tab: ShopTab;
  group: ShopGroup;
  kind: 'item' | 'recipe';
  /** ไอเท็มในกระเป๋า หรือรหัสสูตร */
  target: string;
  price: number;
  currency: 'coins';
}

const seedOffer = (crop: string, tab: ShopTab, group: ShopGroup): Offer => ({
  id: `${group}:${crop}`,
  tab,
  group,
  kind: 'item',
  target: seedItem(crop),
  price: crops[crop]!.seedPrice!,
  currency: 'coins',
});

function pick<T>(items: T[], count: number, rng: ReturnType<typeof createRng>): T[] {
  const pool = [...items];
  const chosen: T[] = [];
  while (chosen.length < count && pool.length > 0) chosen.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!);
  return chosen;
}

/** ขายทุกวัน: แมวเลีย 4 รส เมล็ดพืชเริ่มเกม และปุ๋ยระดับ 2 · สุ่มวันนี้: เมล็ดจากร้าน 3 ชนิด ปุ๋ยระดับ 3 (บางวัน) และสูตรที่ยังไม่รู้และทำที่กองไฟได้ 2 สูตร */
export function offersFor(world: World): Offer[] {
  const treats = shop.treats.map(
    (treat): Offer => ({ id: `treats:${treat.item}`, tab: 'daily', group: 'treats', kind: 'item', target: treat.item, price: treat.price, currency: 'coins' }),
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
  const recipeOffers = pick(unknown, shop.randomRecipes, rng).map(
    (id): Offer => ({
      id: `recipes:${id}`,
      tab: 'random',
      group: 'recipes',
      kind: 'recipe',
      target: id,
      price: Math.round(recipes[id]!.price * shop.recipePriceMultiplier),
      currency: 'coins',
    }),
  );
  // ปุ๋ยสุ่มหลังของเดิม ของสุ่มเดิมของแต่ละวันจึงไม่เปลี่ยน
  const fertilizers = shop.fertilizers
    .filter((entry) => entry.tab === 'daily' || rng.next() < entry.chance)
    .map((entry): Offer => ({ id: `fertilizer:${entry.item}`, tab: entry.tab, group: 'fertilizer', kind: 'item', target: entry.item, price: entry.price, currency: 'coins' }));
  const daily = fertilizers.filter((offer) => offer.tab === 'daily');
  const random = fertilizers.filter((offer) => offer.tab === 'random');
  return [...treats, ...starter, ...daily, ...randomSeeds, ...random, ...recipeOffers];
}

export const tasteOfTreat = (item: string): ShopData['treats'][number]['taste'] | null =>
  shop.treats.find((treat) => treat.item === item)?.taste ?? null;

/** สูตรซื้อได้ครั้งเดียว ของอื่นซื้อได้ตามจำนวนที่เงินพอ */
export const maxQuantity = (world: World, offer: Offer): number => {
  if (offer.kind === 'recipe') return world.recipes.known.includes(offer.target) ? 0 : 1;
  return Math.floor(world.wallet.coins / offer.price);
};

/** เหรียญไม่พอ กระเป๋าเต็ม หรือรู้สูตรแล้ว ตอบ null เงินจึงไม่หาย · ทุกการซื้อเขียนรายการในกระเป๋าเงิน */
export function buyOffer(world: World, offer: Offer, quantity: number): World | null {
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  const cost = offer.price * quantity;
  if (cost > world.wallet.coins) return null;
  let next: World;
  if (offer.kind === 'recipe') {
    if (quantity !== 1 || world.recipes.known.includes(offer.target)) return null;
    next = { ...world, recipes: { ...world.recipes, known: [...world.recipes.known, offer.target] } };
  } else {
    const bag = addToBag(world.bag, offer.target, quantity);
    if (!bag) return null;
    next = { ...world, bag };
  }
  return applyTransaction(next, offer.currency, -cost, 'wallet.shop_buy', 'wallet.category_shop');
}
