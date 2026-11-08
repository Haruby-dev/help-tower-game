import { describe, expect, it } from 'vitest';
import type { World } from '../../src/core/state';
import balance from '../../src/data/balance.json';
import ingredients from '../../src/data/ingredients.json';
import toppingsJson from '../../src/data/toppings.json';
import th from '../../src/i18n/th.json';
import { dishItem, parseDish, recipes } from '../../src/systems/cooking';
import { countOf } from '../../src/systems/farm';
import { newWorld } from '../../src/systems/gauges';
import { saleValue } from '../../src/systems/gio';
import { feed } from '../../src/systems/monsters';
import { starsOf } from '../../src/systems/stars';
import { decorateDishes, toppingBlock, toppingEffect, toppingsOf, withToppings } from '../../src/systems/toppings';

// zone-1 food update phase 3 (docs/zone1_food_update_2026-11-08.md §3.2–3.3, GDD "ท็อปปิ้ง")
const rules = balance.toppings;
const SAVORY = recipes.grilled_shrimp!;
const SWEET = recipes.strawberry_skewer!;
const DRINK = recipes.warm_honey_milk!;
const SOUP = recipes.tomato_soup!;

describe('topping bonus by count', () => {
  it('gives +10% / +20% / +30% for 1 / 2 / 3 right-type pieces', () => {
    expect(toppingEffect(SAVORY, ['scallion']).bonus).toBeCloseTo(0.1);
    expect(toppingEffect(SAVORY, ['scallion', 'fried_garlic']).bonus).toBeCloseTo(0.2);
    expect(toppingEffect(SAVORY, ['scallion', 'fried_garlic', 'chili_flakes']).bonus).toBeCloseTo(0.3);
  });

  it('allows at most 3 pieces per dish, counting wrong-type pieces too (her decision 9 Nov 02:44, no gauge, no 4th-piece trap)', () => {
    expect(rules.maxPieces).toBe(3);
    const bag = [{ item: 'produce_scallion', count: 9 }, { item: 'ing_honey', count: 9 }, { item: 'ing_fish_ball', count: 9 }];
    expect(toppingBlock(bag, SAVORY, ['scallion', 'scallion'], 'honey', 1)).toBeNull();
    // a wrong-type honey piece fills the third place
    expect(toppingBlock(bag, SAVORY, ['scallion', 'scallion', 'honey'], 'scallion', 1)).toBe('full');
    // full wins over every other reason
    expect(toppingBlock(bag, SAVORY, ['scallion', 'scallion', 'honey'], 'fish_ball', 1)).toBe('full');
    expect(toppingEffect(SAVORY, ['scallion', 'scallion', 'honey']).bonus).toBeCloseTo(0.2);
  });

  it('counts umami powder as one piece worth +20%, one spoon per dish', () => {
    expect(toppingEffect(SAVORY, ['umami_powder'])).toMatchObject({ counted: 1, noticed: true });
    expect(toppingEffect(SAVORY, ['umami_powder']).bonus).toBeCloseTo(0.2);
    expect(toppingEffect(SAVORY, ['umami_powder', 'scallion']).bonus).toBeCloseTo(0.3);
    const bag = [{ item: 'ing_umami_powder', count: 5 }];
    expect(toppingBlock(bag, SAVORY, [], 'umami_powder', 1)).toBeNull();
    expect(toppingBlock(bag, SAVORY, ['umami_powder'], 'umami_powder', 1)).toBe('oneSpoon');
  });
});

describe('topping types', () => {
  it('a sweet topping on savory food (or savory on sweet) can go on, does not count, gives no bonus and makes a yuck face', () => {
    expect(toppingEffect(SAVORY, ['honey'])).toMatchObject({ counted: 0, bonus: 0, yuck: true });
    expect(toppingEffect(SWEET, ['chili_flakes'])).toMatchObject({ counted: 0, bonus: 0, yuck: true });
    // umami powder on a sweet dish: no +20%, no sparkle
    expect(toppingEffect(SWEET, ['umami_powder'])).toMatchObject({ counted: 0, bonus: 0, yuck: true, noticed: false });
    expect(toppingBlock([{ item: 'ing_honey', count: 1 }], SAVORY, [], 'honey', 1)).toBeNull();
  });

  it('drinks take drink toppings and sweet toppings', () => {
    expect(toppingEffect(DRINK, ['coconut_jelly', 'honey'])).toMatchObject({ counted: 2, yuck: false });
    expect(toppingEffect(DRINK, ['scallion'])).toMatchObject({ counted: 0, yuck: true });
  });

  it('a monster whose favourite topping it is eats it happily even on the wrong type, with ×1.5', () => {
    expect(toppingEffect(SWEET, ['toasted_sesame'], 'toasted_sesame')).toMatchObject({ yuck: false, favourite: true, counted: 0 });
    expect(rules.favouriteMultiplier).toBe(1.5);
  });

  it('fish balls and shrimp balls only go on soups and curries', () => {
    const bag = [{ item: 'ing_fish_ball', count: 3 }, { item: 'ing_shrimp_ball', count: 3 }];
    expect(toppingBlock(bag, SAVORY, [], 'fish_ball', 1)).toBe('soupOnly');
    expect(toppingBlock(bag, SOUP, [], 'fish_ball', 1)).toBeNull();
    expect(toppingBlock(bag, SOUP, [], 'shrimp_ball', 1)).toBeNull();
    const soups = Object.entries(recipes).filter(([, recipe]) => recipe.soup).map(([id]) => id).sort();
    expect(soups).toEqual(['cabbage_shrimp_soup', 'fish_congee', 'potato_carrot_stew', 'tomato_soup']);
  });
});

describe('decorating dishes', () => {
  const world = (bag: World['bag']): World => ({ ...newWorld(), bag });

  it('one tap uses one topping per dish (her choice 9 Nov) and blocks a topping that is not enough for every dish', () => {
    const bag = [{ item: 'dish_grilled_shrimp_1', count: 3 }, { item: 'produce_scallion', count: 4 }, { item: 'ing_fried_garlic', count: 2 }];
    expect(toppingBlock(bag, SAVORY, [], 'scallion', 3)).toBeNull();
    expect(toppingBlock(bag, SAVORY, ['scallion'], 'scallion', 3)).toBe('notEnough');
    expect(toppingBlock(bag, SAVORY, [], 'fried_garlic', 3)).toBe('notEnough');
    const next = decorateDishes(world(bag), 'dish_grilled_shrimp_1', 3, ['scallion'])!;
    expect(countOf(next.bag, 'produce_scallion')).toBe(1);
    expect(countOf(next.bag, 'dish_grilled_shrimp_1')).toBe(0);
    expect(countOf(next.bag, 'dish_grilled_shrimp_1~scallion')).toBe(3);
  });

  it('uses lower-star produce first and refuses when something is missing, so nothing is lost', () => {
    const bag = [{ item: 'dish_strawberry_skewer_2', count: 1 }, { item: 'produce_strawberry@3', count: 1 }, { item: 'produce_strawberry', count: 1 }];
    const next = decorateDishes(world(bag), 'dish_strawberry_skewer_2', 1, ['strawberry'])!;
    expect(countOf(next.bag, 'produce_strawberry')).toBe(0);
    expect(countOf(next.bag, 'produce_strawberry@3')).toBe(1);
    expect(decorateDishes(world(bag), 'dish_strawberry_skewer_2', 1, ['honey'])).toBeNull();
  });

  it('keeps toppings in the dish id in a fixed order, so the same decoration stacks, and stars still read right', () => {
    const a = withToppings(dishItem('tomato_soup', 2), ['honey', 'fish_ball']);
    const b = withToppings(dishItem('tomato_soup', 2), ['fish_ball', 'honey']);
    expect(a).toBe(b);
    expect(a).toBe('dish_tomato_soup_2~fish_ball.honey');
    expect(parseDish(a)).toEqual({ recipe: 'tomato_soup', stars: 2 });
    expect(starsOf(a)).toBe(2);
    expect(toppingsOf(a)).toEqual(['fish_ball', 'honey']);
    expect(toppingsOf('dish_tomato_soup_2')).toEqual([]);
  });
});

describe('what toppings change', () => {
  it('raise the Gio sell price by the same steps', () => {
    const plain = saleValue('dish_grilled_shrimp_1')!;
    expect(saleValue('dish_grilled_shrimp_1~scallion.fried_garlic')).toBe(Math.round(plain * 1.2));
    expect(saleValue('dish_grilled_shrimp_1~umami_powder')).toBe(Math.round(plain * 1.2));
    expect(saleValue('dish_grilled_shrimp_1~honey')).toBe(plain);
    expect(saleValue('dish_grilled_shrimp_1~scallion.fried_garlic.chili_flakes')).toBe(Math.round(plain * 1.3));
  });

  it('raise monster affection by the same steps', () => {
    const base = newWorld();
    const plain = feed(base, 'puinun', 'dish_strawberry_skewer_1', 0).points;
    const topped = feed(base, 'puinun', 'dish_strawberry_skewer_1~honey.strawberry', 0).points;
    expect(topped).toBeCloseTo(plain * 1.2);
    expect(feed(base, 'puinun', 'dish_strawberry_skewer_1~scallion', 0).points).toBeCloseTo(plain);
  });
});

describe('zone-1 toppings', () => {
  it('has the 13 toppings with art, and sweet basil is gone everywhere (her decision 9 Nov 00:50)', () => {
    expect(Object.keys(toppingsJson)).toHaveLength(13);
    expect(toppingsJson).not.toHaveProperty('sweet_basil');
    expect(ingredients).not.toHaveProperty('sweet_basil');
    expect((th as Record<string, string>)['ingredient.sweet_basil.name']).toBeUndefined();
  });
});
