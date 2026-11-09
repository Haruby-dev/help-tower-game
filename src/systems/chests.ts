import type { Rng } from '../core/rng';
import type { Cosmetics, World } from '../core/state';
import chestsJson from '../data/chests.json';
import cosmeticsJson from '../data/cosmetics.json';
import cropsJson from '../data/crops.json';
import type { Chests, ChestTier, CosmeticTable, Crops, Rarity } from '../data/schema';
import { applyTransaction } from './economy';
import { addToBag, seedItem, takeFromBag } from './farm';

export const chestData = chestsJson as unknown as Chests;
export const cosmeticTable = cosmeticsJson as CosmeticTable;
type Entry = Chests['pool'][number];
type Category = Entry['category'];

const TIERS: ChestTier[] = ['wooden', 'silver', 'golden'];
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare'];
const CATEGORIES = Object.keys(chestData.categories) as Category[];
const SHOP_SEEDS = Object.entries(cropsJson as Crops)
  .filter(([, crop]) => crop.source === 'shop')
  .map(([id]) => id);

export const chestTierOfItem = (item: string): ChestTier | null => TIERS.find((tier) => chestData.tiers[tier].item === item) ?? null;
export const isChest = (item: string): boolean => chestTierOfItem(item) !== null;

function weighted<T>(choices: [T, number][], rng: Rng): T {
  const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * total;
  for (const [choice, weight] of choices) {
    roll -= weight;
    if (roll < 0) return choice;
  }
  return choices[choices.length - 1]![0];
}

const between = (rng: Rng, min: number, max: number): number => min + Math.floor(rng.next() * (max - min + 1));

export const rollChestTier = (rng: Rng): ChestTier => weighted(TIERS.map((tier) => [tier, chestData.tiers[tier].chance]), rng);

const tierAllows = (entry: Entry, tier: ChestTier): boolean => TIERS.indexOf(tier) >= TIERS.indexOf(entry.minTier ?? 'wooden');

/** สุ่มหมวด แล้วสุ่มความหายาก 70 25 5 ถ้าหมวดนั้นไม่มีของระดับนั้นในหีบนี้ ใช้ระดับใกล้ที่สุดแทน */
function rollEntry(tier: ChestTier, rng: Rng, force: { category?: Category; minRarity?: Rarity }): Entry {
  const category = force.category ?? weighted(CATEGORIES.map((name) => [name, chestData.categories[name][tier]]), rng);
  const lowest = RARITIES.indexOf(force.minRarity ?? 'common');
  const rarity = weighted(RARITIES.slice(lowest).map((name) => [name, chestData.rarity[name]]), rng);
  const candidates = chestData.pool.filter((entry) => entry.category === category && tierAllows(entry, tier));
  const order = [...RARITIES].sort((a, b) => Math.abs(RARITIES.indexOf(a) - RARITIES.indexOf(rarity)) - Math.abs(RARITIES.indexOf(b) - RARITIES.indexOf(rarity)));
  for (const name of order) {
    if (RARITIES.indexOf(name) < lowest) continue;
    const found = candidates.filter((entry) => entry.rarity === name);
    if (found.length > 0) return found[Math.floor(rng.next() * found.length)]!;
  }
  return candidates[Math.floor(rng.next() * candidates.length)]!;
}

export type Reward =
  | { kind: 'coins'; amount: number }
  | { kind: Entry['kind']; item: string; count: number; duplicateStars: number }
  /** เศษม้วนสูตร item คือรหัสสูตร have คือเศษที่มีหลังได้ชิ้นนี้ learned ครบแล้วได้สูตร */
  | { kind: 'fragment'; item: string; have: number; need: number; learned: boolean };

/**
 * เศษม้วนสูตร (สเปก 8.1): หีบทุกใบได้ 1 ชิ้นจนครบทุกสูตร สุ่มตามน้ำหนักจากสูตรที่ยังไม่ครบ
 * สูตรหายาก (ข้าวต้มปลา) ได้เศษอย่างอื่นติดกันครบจำนวนแล้ว ใบถัดไปได้เศษสูตรนั้นแน่
 */
function rollFragment(world: World, rng: Rng): { world: World; reward: Reward | null } {
  const { perRecipe, recipes: weights, rare } = chestData.fragments;
  const { known, fragments } = world.recipes;
  const open = Object.entries(weights).filter(([id]) => !known.includes(id) && (fragments[id] ?? 0) < perRecipe);
  if (open.length === 0) return { world, reward: null };
  const rareOpen = open.some(([id]) => id === rare.recipe);
  const recipe = rareOpen && world.chests.sinceRareFragment >= rare.after ? rare.recipe : weighted(open, rng);
  const have = (fragments[recipe] ?? 0) + 1;
  const learned = have >= perRecipe;
  const next: World = {
    ...world,
    recipes: { ...world.recipes, fragments: { ...fragments, [recipe]: have }, known: learned ? [...known, recipe] : known },
    chests: { ...world.chests, sinceRareFragment: !rareOpen || recipe === rare.recipe ? 0 : world.chests.sinceRareFragment + 1 },
  };
  return { world: next, reward: { kind: 'fragment', item: recipe, have, need: perRecipe, learned } };
}

const ownedCosmetic = (cosmetics: Cosmetics, id: string): boolean => {
  const slot = cosmeticTable[id]?.slot;
  return slot !== undefined && cosmetics.owned[slot].includes(id);
};

function addCosmetic(cosmetics: Cosmetics, id: string): Cosmetics {
  const slot = cosmeticTable[id]!.slot;
  return { ...cosmetics, owned: { ...cosmetics.owned, [slot]: [...cosmetics.owned[slot], id] } };
}

/** เปิดหีบ 1 ใบ ของซ้ำกลายเป็นดาวน้ำตาล เงินทุกบาทเขียนรายการในกระเป๋าเงิน ตอบ null เมื่อกระเป๋าไม่พอ ของจึงไม่หาย */
export function openChest(world: World, item: string, rng: Rng): { world: World; rewards: Reward[] } | null {
  const tier = chestTierOfItem(item);
  let bag = tier ? takeFromBag(world.bag, item, 1) : null;
  if (!tier || !bag) return null;
  const info = chestData.tiers[tier];
  const forceCosmetic = info.guarantee === 'cosmetic' || world.chests.sinceCosmetic >= chestData.pityAfter;
  let { cosmetics, toys, stash } = world;
  let gotCosmetic = false;
  let stars = 0;
  const coins = between(rng, info.coins[0], info.coins[1]);
  const rewards: Reward[] = [{ kind: 'coins', amount: coins }];

  for (let roll = 0; roll < info.rolls; roll += 1) {
    const force = roll > 0 ? {} : forceCosmetic ? { category: 'cosmetics' as const } : info.guarantee === 'uncommon' ? { minRarity: 'uncommon' as const } : {};
    const entry = rollEntry(tier, rng, force);
    const count = between(rng, entry.min, entry.max);
    let given = entry.item;
    let duplicateStars = 0;
    if (entry.kind === 'bag' || entry.kind === 'seed_bag') {
      if (entry.kind === 'seed_bag') given = seedItem(SHOP_SEEDS[Math.floor(rng.next() * SHOP_SEEDS.length)]!);
      bag = addToBag(bag, given, count);
      if (!bag) return null;
    } else if (entry.kind === 'toy') {
      if (toys.includes(given)) duplicateStars = info.duplicateStars;
      else toys = [...toys, given];
    } else if (entry.kind === 'cosmetic') {
      gotCosmetic = true;
      if (ownedCosmetic(cosmetics, given)) duplicateStars = info.duplicateStars;
      else cosmetics = addCosmetic(cosmetics, given);
    } else {
      stash = { ...stash, [given]: (stash[given] ?? 0) + count };
    }
    stars += duplicateStars;
    rewards.push({ kind: entry.kind, item: given, count, duplicateStars });
  }

  let next: World = { ...world, bag, cosmetics, toys, stash, chests: { ...world.chests, sinceCosmetic: gotCosmetic ? 0 : world.chests.sinceCosmetic + 1 } };
  // เศษม้วนสูตรสุ่มหลังของอื่น ของเดิมในหีบจึงเหมือนเดิม
  const fragment = rollFragment(next, rng);
  next = fragment.world;
  if (fragment.reward) rewards.push(fragment.reward);
  next = applyTransaction(next, 'coins', coins, 'wallet.chest', 'wallet.category_chest');
  if (stars > 0) next = applyTransaction(next, 'stars', stars, 'wallet.chest_duplicate', 'wallet.category_chest');
  return { world: next, rewards };
}
