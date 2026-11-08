import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import type { World } from '../../src/core/state';
import { baseDishStars, collectDish, dishItem, recipes, startCooking } from '../../src/systems/cooking';
import { actionFor, applyFarmAction, canStoreHarvest, countOf, harvestStacks } from '../../src/systems/farm';
import { newWorld } from '../../src/systems/gauges';
import { saleValue } from '../../src/systems/gio';
import { parseSaveFile, SAVE_VERSION } from '../../src/systems/save';
import { buyOffer, offersFor } from '../../src/systems/shop';
import { baseItem, defaultStarPick, dishStars, rollCropStars, starChances, starLevels, starsOf, withStars } from '../../src/systems/stars';
import crops from '../../src/data/crops.json';

const NO_BONUS = { next: () => 0.99, between: (min: number) => min };
const rolls = (tier: number, skillE = false, count = 20000): number[] => {
  const rng = createRng(42);
  const seen = [0, 0, 0];
  for (let index = 0; index < count; index += 1) seen[rollCropStars(tier, rng, skillE) - 1]! += 1;
  return seen.map((value) => value / count);
};

describe('crop star rolls (star system doc §1)', () => {
  it('follows the table for each fertilizer tier', () => {
    expect(starChances(1)).toEqual([1, 0, 0]);
    expect(starChances(2)).toEqual([0.8, 0.2, 0]);
    expect(starChances(3)).toEqual([0, 0.7, 0.3]);
  });

  it('moves 10% from the lowest result to the next with skill E', () => {
    expect(starChances(1, true).map((chance) => Math.round(chance * 100))).toEqual([90, 10, 0]);
    expect(starChances(2, true).map((chance) => Math.round(chance * 100))).toEqual([70, 30, 0]);
    expect(starChances(3, true).map((chance) => Math.round(chance * 100))).toEqual([0, 60, 40]);
  });

  it('rolls close to the table with a seeded rng, and never 1 star on tier 3', () => {
    expect(rolls(1)).toEqual([1, 0, 0]);
    const tier2 = rolls(2);
    expect(tier2[0]).toBeCloseTo(0.8, 1);
    expect(tier2[2]).toBe(0);
    const tier3 = rolls(3);
    expect(tier3[0]).toBe(0);
    expect(tier3[1]).toBeCloseTo(0.7, 1);
    expect(tier3[2]).toBeCloseTo(0.3, 1);
  });
});

describe('star items', () => {
  it('keeps 1-star produce under its old id, so old saves are 1 star without changing items', () => {
    expect(withStars('produce_tomato', 1)).toBe('produce_tomato');
    expect(withStars('produce_tomato', 3)).toBe('produce_tomato@3');
    expect(baseItem('produce_tomato@3')).toBe('produce_tomato');
    expect(starsOf('produce_tomato')).toBe(1);
    expect(starsOf('produce_tomato@2')).toBe(2);
    expect(starsOf('dish_home_kaprao_3')).toBe(3);
    expect(starsOf('ing_egg')).toBeNull();
    expect(starsOf('fish_tilapia')).toBeNull();
  });

  it('lists the star levels in the bag, low first, and picks the lowest level that has enough', () => {
    const bag = [
      { item: 'produce_strawberry@3', count: 2 },
      { item: 'produce_strawberry', count: 1 },
      { item: 'produce_strawberry@2', count: 3 },
    ];
    expect(starLevels(bag, 'produce_strawberry')).toEqual([
      { stars: 1, count: 1 },
      { stars: 2, count: 3 },
      { stars: 3, count: 2 },
    ]);
    expect(defaultStarPick(bag, 'produce_strawberry', 2)).toBe(2);
    expect(defaultStarPick(bag, 'produce_strawberry', 1)).toBe(1);
  });

  it('sells produce higher with more stars, like dishes', () => {
    const price = crops.tomato.sellPrice;
    expect(saleValue('produce_tomato')).toBe(price);
    expect(saleValue('produce_tomato@2')).toBe(Math.round(price * 1.2));
    expect(saleValue('produce_tomato@3')).toBe(Math.round(price * 1.5));
  });
});

describe('dish stars (star system doc §4)', () => {
  it('uses the lowest star among star ingredients, 1 if none, +1 on the happy roll (max 3)', () => {
    expect(dishStars([3, 2], 50, NO_BONUS)).toBe(2);
    expect(dishStars([], 50, NO_BONUS)).toBe(1);
    expect(dishStars([3, 3], 100, { next: () => 0, between: (min) => min })).toBe(3);
    expect(dishStars([1], 100, { next: () => 0.05, between: (min) => min })).toBe(2);
    expect(dishStars([1], 100, { next: () => 0.1, between: (min) => min })).toBe(1);
    expect(dishStars([1], 69, { next: () => 0, between: (min) => min })).toBe(1);
  });

  it('cooks a 3-star tanghulu from two 3-star strawberries the player picked (the floor-10 path)', () => {
    const world: World = {
      ...newWorld(),
      recipes: { known: ['strawberry_skewer'], bestStars: {} },
      bag: [
        { item: 'produce_strawberry', count: 4 },
        { item: 'produce_strawberry@3', count: 2 },
        { item: 'ing_sugar', count: 2 },
      ],
    };
    const recipe = recipes.strawberry_skewer!;
    // ค่าเริ่มคือดาวต่ำสุดที่มีพอ ผักดีจึงไม่ถูกใช้โดยไม่ตั้งใจ
    expect(baseDishStars(world.bag, recipe)).toBe(1);
    const picked = startCooking(world, 'strawberry_skewer', 1, { produce_strawberry: 3 }, NO_BONUS)!;
    expect(picked.cooking.slot?.stars).toBe(3);
    expect(countOf(picked.bag, 'produce_strawberry@3')).toBe(0);
    expect(countOf(picked.bag, 'produce_strawberry')).toBe(4);
    const done = collectDish({ ...picked, cooking: { slot: { ...picked.cooking.slot!, minutesLeft: 0 } } })!;
    expect(countOf(done.bag, dishItem('strawberry_skewer', 3))).toBe(1);
    // ดาวที่เลือกมีไม่พอ ทำไม่ได้
    expect(startCooking(world, 'strawberry_skewer', 2, { produce_strawberry: 3 }, NO_BONUS)).toBeNull();
  });

  it('does not let seasonings, eggs or fish pull the stars down', () => {
    // เครื่องดื่มต้องมีแก้วไม้ไผ่ (งานอาหารโซน 1 ขั้นที่ 4)
    const world: World = { ...newWorld(), bag: [...newWorld().bag.filter((stack) => stack.item !== 'produce_tomato'), { item: 'produce_tomato@3', count: 2 }, { item: 'bamboo_cup', count: 1 }] };
    const next = startCooking(world, 'tomato_juice', 1, {}, NO_BONUS)!;
    expect(next.cooking.slot?.stars).toBe(3);
  });
});

describe('fertilizer (star system doc §2)', () => {
  const tilled = (fertilizer = 0): World => {
    const world = newWorld();
    return {
      ...world,
      bag: [...world.bag, { item: 'fertilizer_2', count: 2 }, { item: 'fertilizer_3', count: 1 }, { item: 'seed_strawberry', count: 2 }],
      farm: { plots: world.farm.plots.map((plot, index) => (index === 0 ? { ...plot, tilled: true, fertilizer } : plot)) },
    };
  };

  it('goes on a tilled plot before planting, and is used from the bag', () => {
    const world = tilled();
    expect(actionFor(world.farm.plots[0]!, 'seeds', 'fertilizer_2', world.bag)).toBe('fertilize');
    expect(actionFor(world.farm.plots[1]!, 'seeds', 'fertilizer_2', world.bag)).toBeNull();
    const next = applyFarmAction(world, 0, 'fertilize', 'fertilizer_2')!;
    expect(next.farm.plots[0]!.fertilizer).toBe(2);
    expect(countOf(next.bag, 'fertilizer_2')).toBe(1);
  });

  it('does nothing when the same or a lower tier is used again, and a higher tier replaces it', () => {
    const world = tilled(2);
    expect(actionFor(world.farm.plots[0]!, 'seeds', 'fertilizer_2', world.bag)).toBeNull();
    expect(actionFor(world.farm.plots[0]!, 'seeds', 'fertilizer_3', world.bag)).toBe('fertilize');
    expect(applyFarmAction(world, 0, 'fertilize', 'fertilizer_3')!.farm.plots[0]!.fertilizer).toBe(3);
    expect(applyFarmAction(tilled(3), 0, 'fertilize', 'fertilizer_2')).toBeNull();
  });

  it('stays through planting and growing, rolls each harvested piece, and is used up at harvest', () => {
    const planted = applyFarmAction(tilled(3), 0, 'plant', 'strawberry')!;
    expect(planted.farm.plots[0]!.fertilizer).toBe(3);
    const ready: World = { ...planted, farm: { plots: planted.farm.plots.map((plot, index) => (index === 0 ? { ...plot, crop: { ...plot.crop!, daysGrown: 99 } } : plot)) } };
    expect(canStoreHarvest(ready, 0)).toBe(true);
    const stacks = harvestStacks(ready.farm.plots[0]!, createRng(7));
    expect(stacks.every((stack) => stack.item === 'produce_strawberry@2' || stack.item === 'produce_strawberry@3')).toBe(true);
    const harvested = applyFarmAction(ready, 0, 'harvest', null, createRng(7))!;
    const got = countOf(harvested.bag, 'produce_strawberry@2') + countOf(harvested.bag, 'produce_strawberry@3');
    expect(got).toBe(crops.strawberry.firstYield);
    expect(countOf(harvested.bag, 'produce_strawberry')).toBe(0);
    expect(harvested.farm.plots[0]!.fertilizer).toBe(0);
  });

  it('gives plain 1-star produce without fertilizer', () => {
    const world = tilled();
    const planted = applyFarmAction(world, 0, 'plant', 'strawberry')!;
    const ready: World = { ...planted, farm: { plots: planted.farm.plots.map((plot, index) => (index === 0 ? { ...plot, crop: { ...plot.crop!, daysGrown: 99 } } : plot)) } };
    const harvested = applyFarmAction(ready, 0, 'harvest', null, createRng(1))!;
    expect(countOf(harvested.bag, 'produce_strawberry')).toBe(crops.strawberry.firstYield);
  });

  it('sells tier 2 every day and tier 3 only on some days, and shop produce stays 1 star', () => {
    const world: World = { ...newWorld(), wallet: { ...newWorld().wallet, coins: 100_000 } };
    const days = Array.from({ length: 40 }, (_, index) => offersFor({ ...world, day: index + 1 }));
    expect(days.every((offers) => offers.some((offer) => offer.target === 'fertilizer_2' && offer.tab === 'daily'))).toBe(true);
    const tier3Days = days.filter((offers) => offers.some((offer) => offer.target === 'fertilizer_3')).length;
    expect(tier3Days).toBeGreaterThan(0);
    expect(tier3Days).toBeLessThan(40);
    const offer = days[0]!.find((entry) => entry.target === 'fertilizer_2')!;
    expect(countOf(buyOffer(world, offer, 2)!.bag, 'fertilizer_2')).toBe(2);
  });
});

describe('save version 12', () => {
  it('adds fertilizer 0 to every plot, an empty 3-plate tray and no monster affection; old produce stays 1 star', () => {
    const { tray: _tray, monsters: _monsters, ...world } = newWorld();
    const old = { ...world, farm: { plots: world.farm.plots.map(({ fertilizer: _fertilizer, ...plot }) => plot) }, bag: [{ item: 'produce_tomato', count: 3 }] };
    const parsed = parseSaveFile({ version: 11, savedAt: 'x', world: old })!;
    expect(SAVE_VERSION).toBe(20);
    expect(parsed.version).toBe(20);
    expect(parsed.world.farm.plots.every((plot) => plot.fertilizer === 0)).toBe(true);
    expect(parsed.world.tray).toEqual({ level: 0, plates: [null, null, null] });
    expect(parsed.world.monsters).toEqual({ affection: {}, plannedDay: 0, arrivals: [], twins: { revealed: false, revealDay: 0, quizWon: false }, tasted: {} });
    expect(starsOf(parsed.world.bag[0]!.item)).toBe(1);
  });
});
