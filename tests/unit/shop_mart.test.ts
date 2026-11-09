import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import type { World } from '../../src/core/state';
import { applyTransaction } from '../../src/systems/economy';
import { countOf } from '../../src/systems/farm';
import { chestChance, rollCatch } from '../../src/systems/fishing';
import { newWorld } from '../../src/systems/gauges';
import { SAVE_VERSION, parseSaveFile, toSaveFile } from '../../src/systems/save';
import { buyOffer, maxQuantity, offersFor, stockLeft, type Offer } from '../../src/systems/shop';

const rich = (world: World, coins: number): World => applyTransaction(world, 'coins', coins, 'wallet.test_income', 'wallet.category_test');
const offer = (world: World, id: string): Offer => {
  const found = offersFor(world).find((entry) => entry.id === id);
  if (!found) throw new Error(`no offer ${id}`);
  return found;
};
const DAYS = 200;
const days = (world: World): World[] => Array.from({ length: DAYS }, (_, index) => ({ ...world, day: index + 1 }));

describe('Geo Mart ingredients (zone1 food update 7.1)', () => {
  it('sells salt, sugar and fish sauce every day at 10 with no limit', () => {
    const world = newWorld();
    for (const item of ['ing_salt', 'ing_sugar', 'ing_fish_sauce']) {
      expect(offer(world, `ingredients:${item}`)).toMatchObject({ tab: 'daily', price: 10, stock: null });
    }
  });

  it('sells milk 2, butter 1 and honey 1 a day at double price before the matching pet', () => {
    const world = newWorld();
    expect(offer(world, 'ingredients:ing_milk')).toMatchObject({ tab: 'daily', price: 240, stock: 2, pricierUntil: 'mumu' });
    expect(offer(world, 'ingredients:ing_butter')).toMatchObject({ price: 400, stock: 1, pricierUntil: 'mumu' });
    expect(offer(world, 'ingredients:ing_honey')).toMatchObject({ price: 240, stock: 1, pricierUntil: 'boomboom' });
  });

  it('stops selling milk after 2 a day and sells again the next day', () => {
    let world = rich(newWorld(), 10_000);
    const milk = offer(world, 'ingredients:ing_milk');
    expect(maxQuantity(world, milk)).toBe(2);
    expect(buyOffer(world, milk, 3)).toBeNull();
    world = buyOffer(world, milk, 1)!;
    world = buyOffer(world, milk, 1)!;
    expect(stockLeft(world, milk)).toBe(0);
    expect(maxQuantity(world, milk)).toBe(0);
    expect(buyOffer(world, milk, 1)).toBeNull();
    const tomorrow = { ...world, day: world.day + 1 };
    expect(stockLeft(tomorrow, offer(tomorrow, 'ingredients:ing_milk'))).toBe(2);
  });

  it('sometimes sells cherry (3–5, 100) and on about 30% of days the chest bait (5, 10,000)', () => {
    const offers = days(newWorld()).map((world) => offersFor(world));
    const cherries = offers.map((list) => list.find((entry) => entry.id === 'ingredients:ing_cherry')).filter((entry) => entry !== undefined);
    const lures = offers.map((list) => list.find((entry) => entry.id === 'ingredients:bait_chest')).filter((entry) => entry !== undefined);
    expect(cherries.length).toBeGreaterThan(0);
    expect(cherries.length).toBeLessThan(DAYS);
    for (const cherry of cherries) {
      expect(cherry).toMatchObject({ tab: 'random', price: 100 });
      expect(cherry.stock).toBeGreaterThanOrEqual(3);
      expect(cherry.stock).toBeLessThanOrEqual(5);
    }
    expect(lures.length / DAYS).toBeGreaterThan(0.2);
    expect(lures.length / DAYS).toBeLessThan(0.4);
    for (const lure of lures) expect(lure).toMatchObject({ tab: 'random', price: 10_000, stock: 5 });
  });
});

describe('Geo Mart toppings (7.2)', () => {
  it('sells 2–3 kinds a day, 5–10 of each, all tagged today, at the agreed prices', () => {
    const prices: Record<string, number> = { ing_fried_garlic: 50, ing_toasted_sesame: 50, ing_coconut_jelly: 60, ing_rainbow_sprinkles: 80, ing_whipped_cream: 100 };
    const seen = new Set<string>();
    for (const world of days(newWorld())) {
      const toppings = offersFor(world).filter((entry) => entry.group === 'toppings');
      expect(toppings.length).toBeGreaterThanOrEqual(2);
      expect(toppings.length).toBeLessThanOrEqual(3);
      for (const topping of toppings) {
        seen.add(topping.target);
        expect(topping.tab).toBe('random');
        expect(topping.price).toBe(prices[topping.target]);
        expect(topping.stock).toBeGreaterThanOrEqual(5);
        expect(topping.stock).toBeLessThanOrEqual(10);
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(prices).sort());
  });

  it('keeps today’s toppings and stock all day', () => {
    const world = newWorld();
    const list = (w: World) => offersFor(w).filter((entry) => entry.group === 'toppings').map((entry) => `${entry.target}:${entry.stock}`).join();
    expect(list(world)).toBe(list({ ...world, hour: 21 }));
  });
});

describe('Geo Mart other categories (7.3)', () => {
  it('sells the big table once for 6,000 and it never goes into the bag', () => {
    let world = rich(newWorld(), 10_000);
    const table = offer(world, 'farm:big_table');
    expect(table).toMatchObject({ kind: 'table', tab: 'daily', price: 6000 });
    world = buyOffer(world, table, 1)!;
    expect(world.sets.bigTable.owned).toBe(true);
    expect(world.wallet.coins).toBe(4000);
    expect(countOf(world.bag, 'big_table')).toBe(0);
    expect(maxQuantity(world, table)).toBe(0);
    expect(buyOffer(world, table, 1)).toBeNull();
  });

  it('puts the permanent recipe (fruit and veg salad) on the every-day rows, apart from the 2 random recipes', () => {
    const recipes = offersFor(newWorld()).filter((entry) => entry.group === 'recipes');
    expect(recipes.filter((entry) => entry.tab === 'daily').map((entry) => entry.target)).toEqual(['fruit_veg_salad']);
    expect(recipes.filter((entry) => entry.tab === 'random')).toHaveLength(2);
  });

  it('adds lime 400 and coriander 80 to the every-day seeds', () => {
    const world = newWorld();
    expect(offer(world, 'seeds:lime').price).toBe(400);
    expect(offer(world, 'seeds:coriander').price).toBe(80);
  });
});

describe('chest bait (7.4)', () => {
  it('gives a chest 30% of casts, 32% at night or in rain; other baits keep the rod chance', () => {
    const day = { ...newWorld(), weather: 'sunny' as const };
    expect(chestChance(day, 10, 'chest')).toBeCloseTo(0.3);
    expect(chestChance(day, 20, 'chest')).toBeCloseTo(0.32);
    expect(chestChance({ ...day, weather: 'rain' }, 10, 'chest')).toBeCloseTo(0.32);
    expect(chestChance(day, 10, 'normal')).toBeCloseTo(0.03);
  });

  it('gives a normal fish when no chest comes', () => {
    const world = { ...newWorld(), weather: 'sunny' as const };
    const rng = createRng(7);
    let chests = 0;
    const tries = 2000;
    for (let index = 0; index < tries; index += 1) {
      const caught = rollCatch(world, 'chest', 10, rng);
      expect(caught).not.toBeNull();
      if (caught!.kind === 'chest') chests += 1;
    }
    expect(chests / tries).toBeGreaterThan(0.26);
    expect(chests / tries).toBeLessThan(0.34);
  });
});

describe('save version 22', () => {
  it('adds an empty shop purchase record to an old save', () => {
    const file = toSaveFile(newWorld());
    const { shop: _shop, ...oldWorld } = file.world;
    const parsed = parseSaveFile({ ...file, version: 21, world: oldWorld })!;
    expect(SAVE_VERSION).toBe(22);
    expect(parsed.version).toBe(22);
    expect(parsed.world.shop).toEqual({ day: 0, bought: {} });
  });
});
