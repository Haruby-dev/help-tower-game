import { describe, expect, it } from 'vitest';
import type { World } from '../../src/core/state';
import balance from '../../src/data/balance.json';
import {
  MYSTERY,
  batchIngredients,
  batchMinutes,
  maxBatch,
  canUseCampfire,
  collectDish,
  dishItem,
  eatItem,
  fullnessOf,
  isCooked,
  matchRecipe,
  minutesFor,
  parseDish,
  recipes,
  startCooking,
  startExperiment,
  starsFor,
  tickCooking,
} from '../../src/systems/cooking';
import { countOf } from '../../src/systems/farm';
import { newWorld } from '../../src/systems/gauges';
import { parseSaveFile, SAVE_VERSION } from '../../src/systems/save';
import { sleep, stepClock } from '../../src/systems/time';

const KAPRAO = recipes.home_kaprao!;
const HOUR_MS = 45_000;

const cooked = (world: World): World => ({ ...world, cooking: { slot: { ...world.cooking.slot!, minutesLeft: 0 } } });

describe('recipe data', () => {
  it('has the 15 dishes, 15 desserts and the starter drinks', () => {
    const ids = Object.values(recipes);
    expect(ids.filter((recipe) => recipe.category === 'drink').map((recipe) => recipe.source)).toContain('start');
    expect(Object.keys(recipes).length).toBeGreaterThanOrEqual(33);
  });

  it('knows the 3 GDD recipes and 3 starter drinks from day 1', () => {
    expect(newWorld().recipes.known.sort()).toEqual(
      ['basil_tea', 'boiled_egg', 'grilled_fish', 'home_kaprao', 'tomato_juice', 'warm_honey_milk'].sort(),
    );
  });

  it('follows the economy doc over the GDD', () => {
    expect(recipes.strawberry_skewer?.ingredients).toEqual({ produce_strawberry: 2, ing_sugar: 1 });
    expect(KAPRAO.price).toBe(120);
  });

  it('times F 20, E 25 and drinks short', () => {
    expect(minutesFor(recipes.boiled_egg!)).toBe(20);
    expect(minutesFor(KAPRAO)).toBe(25);
    expect(minutesFor(recipes.basil_tea!)).toBeLessThan(20);
  });

  it('allows only F and E food at the campfire, plus drinks', () => {
    expect(canUseCampfire(KAPRAO)).toBe(true);
    expect(canUseCampfire(recipes.fish_congee!)).toBe(false);
    expect(canUseCampfire(recipes.warm_honey_milk!)).toBe(true);
  });
});

describe('stars', () => {
  it('gives 1 star normally and 2 from happiness 70, never 3 yet', () => {
    expect(starsFor(69.9)).toBe(1);
    expect(starsFor(70)).toBe(2);
    expect(starsFor(100)).toBe(2);
  });
});

describe('cooking', () => {
  it('makes the home kaprao, uses the ingredients, and it can be eaten', () => {
    const start = newWorld();
    const cooking = startCooking(start, 'home_kaprao')!;
    expect(countOf(cooking.bag, 'ing_pork')).toBe(countOf(start.bag, 'ing_pork') - 1);
    expect(collectDish(cooking)).toBeNull();
    const done = collectDish(cooked(cooking))!;
    const item = dishItem('home_kaprao', 2);
    expect(countOf(done.bag, item)).toBe(1);
    expect(done.recipes.bestStars.home_kaprao).toBe(2);
    expect(done.cooking.slot).toBeNull();

    const hungry: World = { ...done, gauges: { ...done.gauges, fullness: 40 } };
    const fed = eatItem(hungry, item)!;
    expect(fed.gauges.fullness).toBe(60);
    expect(countOf(fed.bag, item)).toBe(0);
  });

  it('counts down on the clock while the player does other things', () => {
    const cooking = startCooking(newWorld(), 'home_kaprao')!;
    const half = stepClock(cooking, HOUR_MS / 4).world;
    expect(half.cooking.slot?.minutesLeft).toBeCloseTo(10);
    expect(isCooked(stepClock(half, HOUR_MS / 2).world.cooking.slot)).toBe(true);
    expect(tickCooking({ slot: null }, 1)).toEqual({ slot: null });
  });

  it('finishes overnight', () => {
    expect(isCooked(sleep(startCooking(newWorld(), 'boiled_egg')!).cooking.slot)).toBe(true);
  });

  it('refuses a second dish, an unknown recipe, and missing ingredients', () => {
    const busy = startCooking(newWorld(), 'boiled_egg')!;
    expect(startCooking(busy, 'home_kaprao')).toBeNull();
    expect(startCooking(newWorld(), 'tomato_soup')).toBeNull();
    expect(startCooking({ ...newWorld(), bag: [] }, 'boiled_egg')).toBeNull();
  });

  it('keeps the dish at the campfire when the bag is full', () => {
    const done = cooked(startCooking(newWorld(), 'boiled_egg')!);
    const full: World = { ...done, bag: Array.from({ length: 30 }, () => ({ item: 'seed_rice', count: 99 })) };
    expect(collectDish(full)).toBeNull();
    expect(full.cooking.slot).not.toBeNull();
  });
});

describe('experimenting', () => {
  it('unlocks a recipe when the mix matches exactly', () => {
    const mix = { produce_tomato: 2, produce_garlic: 1, ing_salt: 1 };
    expect(matchRecipe(mix)).toBe('tomato_soup');
    const next = startExperiment(newWorld(), mix)!;
    expect(next.recipes.known).toContain('tomato_soup');
    expect(next.cooking.slot?.recipe).toBe('tomato_soup');
  });

  it('makes mystery food from a wrong mix: ingredients gone, happiness −5, fullness +5', () => {
    const start = newWorld();
    const mix = { produce_chili: 2 };
    const next = startExperiment(start, mix)!;
    expect(next.cooking.slot?.recipe).toBe(MYSTERY);
    expect(countOf(next.bag, 'produce_chili')).toBe(countOf(start.bag, 'produce_chili') - 2);
    const done = collectDish(cooked(next))!;
    expect(done.gauges.happiness).toBe(start.gauges.happiness - 5);
    const item = dishItem(MYSTERY, 1);
    expect(fullnessOf(item)).toBe(balance.cooking.mystery.fullness);
    expect(fullnessOf(item)).toBe(5);
    expect(done.recipes.known).not.toContain(MYSTERY);
  });

  it('does not match a recipe the campfire cannot make', () => {
    expect(matchRecipe({ produce_rice: 1, ing_fish_F: 1, produce_scallion: 1, produce_garlic: 1 })).toBeNull();
  });

  it('refuses an empty mix or what is not in the bag', () => {
    expect(startExperiment(newWorld(), {})).toBeNull();
    expect(startExperiment(newWorld(), { ing_cocoa: 1 })).toBeNull();
  });
});

describe('eating', () => {
  it('fills 5 from raw vegetables and stops at 100', () => {
    const world: World = { ...newWorld(), gauges: { ...newWorld().gauges, fullness: 98 } };
    expect(eatItem(world, 'produce_tomato')?.gauges.fullness).toBe(100);
    const low: World = { ...newWorld(), gauges: { ...newWorld().gauges, fullness: 10 } };
    expect(eatItem(low, 'produce_tomato')?.gauges.fullness).toBe(15);
  });

  it('will not eat salt or seeds', () => {
    expect(eatItem(newWorld(), 'ing_salt')).toBeNull();
    expect(eatItem(newWorld(), 'seed_rice')).toBeNull();
  });

  it('reads dish items back', () => {
    expect(parseDish('dish_home_kaprao_2')).toEqual({ recipe: 'home_kaprao', stars: 2 });
  });
});

describe('save', () => {
  it('upgrades a version 4 save, keeping the bag and adding cooking', () => {
    const { cooking: _cooking, recipes: _recipes, ...old } = newWorld();
    const parsed = parseSaveFile({ version: 4, savedAt: 'x', world: { ...old, bag: [{ item: 'produce_rice', count: 5 }] } });
    expect(parsed?.world.cooking).toEqual({ slot: null });
    expect(parsed?.world.recipes.known).toContain('home_kaprao');
    expect(parsed?.world.bag[0]).toEqual({ item: 'produce_rice', count: 5 });
    expect(parsed?.world.bag.some((stack) => stack.item === 'ing_pork')).toBe(true);
  });
});

describe('batch cooking (her decision 4 Nov 2026)', () => {
  const EGG = recipes.boiled_egg!;
  const withEggs = (eggs: number, happiness = 50): World => ({
    ...newWorld(),
    bag: [{ item: 'ing_egg', count: eggs }],
    gauges: { ...newWorld().gauges, happiness },
  });

  it('can make as many plates as full ingredient sets in the bag, no other cap', () => {
    expect(maxBatch(withEggs(7).bag, EGG)).toBe(7);
    expect(maxBatch(withEggs(0).bag, EGG)).toBe(0);
    // ตัวที่น้อยที่สุดเป็นตัวกำหนด
    const bag = [
      { item: 'ing_pork', count: 5 },
      ...Object.entries(KAPRAO.ingredients).filter(([item]) => item !== 'ing_pork').map(([item, need]) => ({ item, count: need * 9 })),
    ];
    expect(maxBatch(bag, KAPRAO)).toBe(Math.min(9, Math.floor(5 / KAPRAO.ingredients.ing_pork!)));
  });

  it('takes the recipe time × n with no discount', () => {
    expect(batchMinutes(EGG, 4)).toBe(minutesFor(EGG) * 4);
    const next = startCooking(withEggs(4), 'boiled_egg', 4)!;
    expect(next.cooking.slot?.minutesLeft).toBe(minutesFor(EGG) * 4);
  });

  it('takes ingredients × n when cooking starts, and refuses more than the bag allows', () => {
    expect(batchIngredients(KAPRAO, 3)).toEqual(Object.fromEntries(Object.entries(KAPRAO.ingredients).map(([item, need]) => [item, need * 3])));
    const next = startCooking(withEggs(5), 'boiled_egg', 3)!;
    expect(countOf(next.bag, 'ing_egg')).toBe(2);
    expect(startCooking(withEggs(2), 'boiled_egg', 3)).toBeNull();
    expect(startCooking(withEggs(2), 'boiled_egg', 0)).toBeNull();
  });

  it('gives the whole batch the same stars and collects every plate at once', () => {
    const next = startCooking(withEggs(3, 80), 'boiled_egg', 3)!;
    expect(next.cooking.slot).toMatchObject({ stars: 2, count: 3 });
    const done = collectDish(cooked(next))!;
    expect(countOf(done.bag, dishItem('boiled_egg', 2))).toBe(3);
    expect(countOf(done.bag, dishItem('boiled_egg', 1))).toBe(0);
    expect(done.cooking.slot).toBeNull();
  });

  it('keeps the batch at the campfire when the bag cannot hold every plate', () => {
    const done = cooked(startCooking(withEggs(3), 'boiled_egg', 3)!);
    const nearlyFull: World = {
      ...done,
      bag: [...Array.from({ length: 29 }, () => ({ item: 'seed_rice', count: 99 })), { item: dishItem('boiled_egg', 1), count: 98 }],
    };
    expect(collectDish(nearlyFull)).toBeNull();
  });

  it('turns a version 6 save into version 7, and a dish left at the campfire is 1 plate', () => {
    const world = newWorld();
    const v6 = { version: 6, savedAt: '2026-11-04T00:00:00.000Z', world: { ...world, cooking: { slot: { recipe: 'boiled_egg', stars: 1, minutesLeft: 5 } } } };
    const parsed = parseSaveFile(v6);
    expect(SAVE_VERSION).toBe(7);
    expect(parsed?.world.cooking.slot).toEqual({ recipe: 'boiled_egg', stars: 1, minutesLeft: 5, count: 1 });
    expect(parseSaveFile({ ...v6, world: { ...world, cooking: { slot: null } } })?.world.cooking.slot).toBeNull();
  });
});
