import { describe, expect, it } from 'vitest';
import type { World } from '../../src/core/state';
import crops from '../../src/data/crops.json';
import fish from '../../src/data/fish.json';
import ingredients from '../../src/data/ingredients.json';
import th from '../../src/i18n/th.json';
import { canCook, canUseCampfire, countsAsRecipe, fitsIngredient, haveFor, recipes, startCooking } from '../../src/systems/cooking';
import { countOf } from '../../src/systems/farm';
import { newWorld } from '../../src/systems/gauges';
import { SAVE_VERSION, parseSaveFile, toSaveFile } from '../../src/systems/save';
import { offersFor } from '../../src/systems/shop';

// zone-1 food update phase 1 (docs/zone1_food_update_2026-11-08.md §1): game units are GDD ×10
const NO_BONUS = { next: () => 0.99, between: (min: number) => min };
const text = th as Record<string, string>;

/** §1.4 price column, exactly */
const PRICES: Record<string, number> = {
  cabbage_crispy_shrimp: 1000,
  cucumber_salad: 650,
  squid_salad: 1100,
  fish_rice_ball: 550,
  hor_mok: 1200,
  cabbage_shrimp_soup: 1150,
  grilled_shrimp: 650,
  garlic_shrimp: 600,
  steamed_crab: 1250,
  mackerel_chili_dip: 1100,
  kapi_chili_dip: 1300,
  fruit_veg_salad: 1600,
  kaprao_shrimp: 800,
  lime_steamed_fish: 1200,
  buttered_corn: 800,
  pumpkin_custard: 1400,
  soy_milk: 300,
  corn_milk: 650,
  fish_cake: 850,
  grilled_meatball_skewer: 500,
  plain_rice: 300,
};

describe('zone-1 dishes', () => {
  it('has the 20 new dishes and plain rice at the spec prices, with names, art and steps', () => {
    for (const [id, price] of Object.entries(PRICES)) {
      expect(recipes[id], id).toBeDefined();
      expect(recipes[id]!.price, id).toBe(price);
      expect(text[`dish.${id}.name`], id).toBeTruthy();
      expect(recipes[id]!.icon).toBe(`dish_icon_${id}`);
    }
    expect(recipes.choco_donut!.price).toBe(1650);
    expect(recipes.choco_macaron!.price).toBe(2350);
    expect(recipes.baked_potato!.ingredients.ing_banana_leaf).toBe(1);
  });

  it('counts 53 zone-1 recipes (food 32 + drinks 6 + desserts 15); plain rice is a set part, known from the start', () => {
    const counted = Object.values(recipes).filter(countsAsRecipe);
    expect(counted.length).toBe(53);
    expect(counted.filter((recipe) => recipe.category === 'drink').length).toBe(6);
    expect(countsAsRecipe(recipes.plain_rice!)).toBe(false);
    expect(newWorld().recipes.known).toContain('plain_rice');
  });

  it('cooks chili dips and fish cake only at the stone mortar, never at the campfire', () => {
    for (const id of ['mackerel_chili_dip', 'kapi_chili_dip', 'fish_cake']) {
      expect(recipes[id]!.method).toBe('mortar');
      expect(canUseCampfire(recipes[id]!), id).toBe(false);
    }
    expect(canUseCampfire(recipes.grilled_shrimp!)).toBe(true);
    // rank D needs the bought pot and pan, as before
    expect(canUseCampfire(recipes.hor_mok!)).toBe(false);
  });

  it('marks side dishes (กับข้าว) and soups as in the spec', () => {
    const sides = Object.entries(recipes).filter(([, recipe]) => recipe.sideDish).map(([id]) => id);
    expect(sides).toEqual(expect.arrayContaining(['grilled_fish', 'boiled_egg', 'scallion_omelet', 'kaprao_shrimp', 'fish_cake']));
    expect(sides).not.toContain('fish_rice_ball');
    expect(sides).not.toContain('grilled_meatball_skewer');
    expect(sides).not.toContain('home_kaprao');
    const soups = Object.entries(recipes).filter(([, recipe]) => recipe.soup).map(([id]) => id).sort();
    expect(soups).toEqual(['cabbage_shrimp_soup', 'fish_congee', 'potato_carrot_stew', 'tomato_soup']);
  });
});

describe('ingredient groups', () => {
  it('"fish" means any fish of any rank, never shrimp, crab or squid', () => {
    for (const item of ['fish_silver_minnow', 'fish_golden_carp', 'fish_meow_salmon', 'fish_lost_mackerel']) expect(fitsIngredient('ing_fish_any', item), item).toBe(true);
    for (const item of ['fish_shrimp', 'fish_crab', 'fish_glow_squid', 'ing_egg']) expect(fitsIngredient('ing_fish_any', item), item).toBe(false);
  });

  it('the old rank-F fish group no longer takes shrimp (rank F too)', () => {
    expect(fitsIngredient('ing_fish_F', 'fish_pond_tilapia')).toBe(true);
    expect(fitsIngredient('ing_fish_F', 'fish_shrimp')).toBe(false);
    expect(fitsIngredient('ing_fish_F', 'fish_golden_carp')).toBe(false);
  });

  it('any squid, a fish or shrimp ball, and the mackerel-only chili dip', () => {
    expect(fitsIngredient('ing_squid_any', 'fish_glow_squid')).toBe(true);
    expect(fitsIngredient('ing_squid_any', 'fish_lost_mackerel')).toBe(false);
    const bag = [
      { item: 'ing_fish_ball', count: 1 },
      { item: 'ing_shrimp_ball', count: 2 },
    ];
    expect(haveFor(bag, 'ing_meatball')).toBe(3);
    expect(haveFor([{ item: 'fish_golden_carp', count: 3 }], 'fish_lost_mackerel')).toBe(0);
  });

  it('cooks grilled shrimp from two shrimps and takes them from the bag', () => {
    const world: World = { ...newWorld(), recipes: { known: ['grilled_shrimp'], bestStars: {} }, bag: [{ item: 'fish_shrimp', count: 3 }, { item: 'ing_salt', count: 1 }] };
    expect(canCook(world, 'grilled_shrimp')).toBe(true);
    const next = startCooking(world, 'grilled_shrimp', 1, {}, NO_BONUS)!;
    expect(countOf(next.bag, 'fish_shrimp')).toBe(1);
  });

  it('a meatball skewer uses fish and shrimp balls together in bag order', () => {
    const world: World = {
      ...newWorld(),
      recipes: { known: ['grilled_meatball_skewer'], bestStars: {} },
      bag: [
        { item: 'ing_shrimp_ball', count: 1 },
        { item: 'ing_fish_ball', count: 1 },
        { item: 'produce_chili', count: 1 },
        { item: 'ing_sugar', count: 1 },
      ],
    };
    const next = startCooking(world, 'grilled_meatball_skewer', 1, {}, NO_BONUS)!;
    expect(countOf(next.bag, 'ing_shrimp_ball') + countOf(next.bag, 'ing_fish_ball')).toBe(0);
  });
});

describe('new items, crops and fish', () => {
  it('has the new ingredient values (game units) and cocoa at 350', () => {
    const values = ingredients as Record<string, { value: number }>;
    expect(values.cocoa!.value).toBe(350);
    expect(values.kapi!.value).toBe(350);
    expect(values.umami_powder!.value).toBe(100);
    expect(values.banana_leaf!.value).toBe(10);
    expect(values.salt!.value).toBe(10);
  });

  it('adds lime and coriander, sold as seeds every day', () => {
    expect(crops.lime).toMatchObject({ growDays: 7, regrowDays: 3, regrowTimes: 3, sellPrice: 120, seedPrice: 400 });
    expect(crops.coriander).toMatchObject({ growDays: 3, regrowDays: null, sellPrice: 80, seedPrice: 80 });
    const daily = offersFor(newWorld()).filter((offer) => offer.tab === 'daily').map((offer) => offer.target);
    expect(daily).toEqual(expect.arrayContaining(['seed_lime', 'seed_coriander']));
  });

  it('adds shrimp (rank F) and crab (rank E, rainy nights) to the pond, with a kind on every catch', () => {
    expect(fish.shrimp).toMatchObject({ kind: 'shrimp', rank: 'F', price: 150, hours: null, weather: 'any' });
    expect(fish.crab).toMatchObject({ kind: 'crab', rank: 'E', price: 250, hours: [18, 26], weather: 'rain' });
    expect(fish.glow_squid.kind).toBe('squid');
    expect(Object.values(fish).every((entry) => ['fish', 'shrimp', 'crab', 'squid'].includes(entry.kind))).toBe(true);
  });
});

describe('save version 17', () => {
  it('teaches plain rice to an old save', () => {
    const file = toSaveFile(newWorld());
    const known = file.world.recipes.known.filter((id) => id !== 'plain_rice');
    const parsed = parseSaveFile({ ...file, version: 16, world: { ...file.world, recipes: { ...file.world.recipes, known } } })!;
    expect(SAVE_VERSION).toBe(19);
    expect(parsed.version).toBe(19);
    expect(parsed.world.recipes.known).toContain('plain_rice');
  });
});
