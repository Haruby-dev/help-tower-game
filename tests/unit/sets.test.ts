import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import type { World } from '../../src/core/state';
import { countOf } from '../../src/systems/farm';
import { newWorld } from '../../src/systems/gauges';
import { saleValue } from '../../src/systems/gio';
import { feed, planBigTable, planVisit, takePlate, newVisitMemo, dishPoints, bigTablePlate, tableSlotOf } from '../../src/systems/monsters';
import { gainTips, tipText } from '../../src/systems/news';
import { SAVE_VERSION, parseSaveFile, toSaveFile } from '../../src/systems/save';
import {
  comboOf,
  comboReachable,
  giveBigTable,
  isYuckPiece,
  makeSet,
  parseSet,
  putOnBigTable,
  reputationStars,
  setBonus,
  setItem,
  setTable,
  tableSlots,
  takeFromBigTable,
} from '../../src/systems/sets';
import { canServe } from '../../src/systems/tray';

// zone-1 food update phase 6 (docs/zone1_food_update_2026-11-08.md §6)
const rice = 'dish_plain_rice_1';
const fish = 'dish_grilled_fish_2';
const egg = 'dish_boiled_egg_1';
const corn = 'dish_grilled_corn_1';
const milk = 'dish_warm_honey_milk_1';
const skewer = 'dish_strawberry_skewer_1';
/** เมนูโปรดของปุยนุ่น (GDD รสนิยมอาหาร 7 พ.ย.) */
const salad = 'dish_fruit_veg_salad_1';

const withBag = (bag: World['bag'], extra: Partial<World> = {}): World => ({ ...newWorld(), bag, ...extra });

describe('combos (spec 6.2)', () => {
  it('finds a combo in any order, and a free set is null', () => {
    expect(comboOf('small', [rice, fish])).toBe('rice_set');
    expect(comboOf('small', [fish, rice])).toBe('rice_set');
    expect(comboOf('small', [corn, milk])).toBe('perfect_match');
    expect(comboOf('small', [fish, egg])).toBeNull();
    // the same food on the wrong tray size is not the combo
    expect(comboOf('medium', [rice, fish, egg])).toBeNull();
  });

  it('reads groups: any chili dip, any shrimp, soup, sweet or drink', () => {
    expect(comboOf('small', ['dish_kapi_chili_dip_1', 'dish_cucumber_salad_1'])).toBe('chili_veg');
    expect(comboOf('medium', [rice, 'dish_steamed_crab_1', 'dish_grilled_shrimp_1'])).toBe('happy_sea');
    expect(comboOf('large', [rice, egg, 'dish_cabbage_shrimp_soup_1', 'dish_honey_pancake_1'])).toBe('full_meal');
    expect(comboOf('large', [rice, 'dish_mackerel_chili_dip_1', 'dish_cabbage_shrimp_soup_1', egg])).toBe('full_samrab');
  });

  it('ignores stars and toppings when matching', () => {
    expect(comboOf('small', ['dish_plain_rice_3', 'dish_grilled_fish_1~fried_garlic'])).toBe('rice_set');
  });

  it('every combo fills its tray and has a hint only once its recipes are known', () => {
    for (const [id, combo] of Object.entries(setTable.combos)) expect(combo.slots.length, id).toBe(setTable.trays[combo.tray].pieces);
    expect(comboReachable('rice_set', ['plain_rice', 'grilled_fish'])).toBe(true);
    expect(comboReachable('rice_set', ['plain_rice'])).toBe(false);
    expect(comboReachable('chili_veg', ['plain_rice', 'cucumber_salad'])).toBe(false);
  });
});

describe('set money (spec 6.3)', () => {
  it('free ×1.0 · free with rice ×1.1 · combo ×1.2 / ×1.35 / ×1.5 · a yuck piece loses the bonus', () => {
    expect(setBonus(setItem('small', [fish, egg]))).toBe(1);
    expect(setBonus(setItem('medium', [rice, fish, egg]))).toBe(1.1);
    expect(setBonus(setItem('medium', [rice, fish, skewer]))).toBe(1);
    expect(setBonus(setItem('small', [rice, fish]))).toBe(1.2);
    expect(setBonus(setItem('medium', [rice, 'dish_mackerel_chili_dip_1', egg]))).toBe(1.35);
    expect(setBonus(setItem('large', [rice, 'dish_kapi_chili_dip_1', 'dish_steamed_crab_1', 'dish_garlic_shrimp_1']))).toBe(1.5);
  });

  it('desserts and drinks are yuck in a free set, rice and side dishes are not', () => {
    expect(isYuckPiece(skewer)).toBe(true);
    expect(isYuckPiece(milk)).toBe(true);
    expect(isYuckPiece(rice)).toBe(false);
    expect(isYuckPiece(fish)).toBe(false);
  });

  it('sells for the sum of its dishes (stars first) times the set bonus', () => {
    const set = setItem('small', [rice, fish]);
    expect(saleValue(set)).toBe(Math.round((saleValue(rice)! + saleValue(fish)!) * 1.2));
  });
});

describe('making a set (spec 6.1, 6.5)', () => {
  const bag = [
    { item: 'small_woven_tray', count: 2 },
    { item: rice, count: 2 },
    { item: fish, count: 2 },
  ];

  it('uses one tray and one of each dish, gives one set, and the first combo adds +5 +30 reputation', () => {
    const made = makeSet(withBag(bag), 'small', [fish, rice])!;
    expect(made.item).toBe(setItem('small', [rice, fish]));
    expect(parseSet(made.item)).toEqual({ size: 'small', dishes: [fish, rice].sort() });
    expect(countOf(made.world.bag, 'small_woven_tray')).toBe(1);
    expect(countOf(made.world.bag, rice)).toBe(1);
    expect(countOf(made.world.bag, made.item)).toBe(1);
    expect(made.combo).toBe('rice_set');
    expect(made.first).toBe(true);
    expect(made.world.sets.reputation).toBe(35);
    expect(made.world.sets.combos).toEqual(['rice_set']);
    const again = makeSet(made.world, 'small', [rice, fish])!;
    expect(again.first).toBe(false);
    expect(again.world.sets.reputation).toBe(40);
    expect(again.world.sets.combos).toEqual(['rice_set']);
    expect(countOf(again.world.bag, made.item)).toBe(2);
  });

  it('a free set gives no reputation, and nothing is used without a tray or the food', () => {
    const free = makeSet(withBag([...bag, { item: egg, count: 1 }]), 'small', [fish, egg])!;
    expect(free.combo).toBeNull();
    expect(free.world.sets.reputation).toBe(0);
    expect(makeSet(withBag(bag.slice(1)), 'small', [rice, fish])).toBeNull();
    expect(makeSet(withBag(bag), 'small', [rice, egg])).toBeNull();
    expect(makeSet(withBag(bag), 'small', [rice, fish, fish])).toBeNull();
  });

  it('reputation shows ★1–5 and how much is missing', () => {
    expect(reputationStars(0)).toEqual({ stars: 1, toNext: 150 });
    expect(reputationStars(110)).toEqual({ stars: 1, toNext: 40 });
    expect(reputationStars(150)).toEqual({ stars: 2, toNext: 350 });
    expect(reputationStars(2500)).toEqual({ stars: 5, toNext: null });
  });
});

describe('where sets go (spec 6.4)', () => {
  it('small sets go on a tower-tray plate, medium and large only on the big table', () => {
    expect(canServe(setItem('small', [rice, fish]))).toBe(true);
    expect(canServe(setItem('medium', [rice, fish, egg]))).toBe(false);
    const set = setItem('medium', [rice, fish, egg]);
    const world = withBag([{ item: set, count: 1 }]);
    expect(putOnBigTable(world, set)).toBeNull();
    const owned = giveBigTable(world);
    const placed = putOnBigTable(owned, set)!;
    expect(placed.sets.bigTable.sets).toEqual([set, null, null]);
    expect(countOf(placed.bag, set)).toBe(0);
    const back = takeFromBigTable(placed, 0)!;
    expect(back.sets.bigTable.sets).toEqual([null, null, null]);
    expect(countOf(back.bag, set)).toBe(1);
    expect(takeFromBigTable(back, 0)).toBeNull();
  });

  it('the big table holds 3 sets, one per slot (her choice 9 Nov 2026)', () => {
    const medium = setItem('medium', [rice, fish, egg]);
    const large = setItem('large', [rice, fish, egg, corn]);
    expect(setTable.bigTable.slots).toHaveLength(3);
    let world = giveBigTable(withBag([{ item: medium, count: 2 }, { item: large, count: 2 }]));
    world = putOnBigTable(world, medium)!;
    world = putOnBigTable(world, large, 2)!;
    expect(tableSlots(world)).toEqual([medium, null, large]);
    expect(putOnBigTable(world, large, 2)).toBeNull();
    world = putOnBigTable(world, large)!;
    expect(tableSlots(world)).toEqual([medium, large, large]);
    expect(putOnBigTable(world, medium)).toBeNull();
    expect(countOf(world.bag, medium)).toBe(1);
    expect(countOf(world.bag, large)).toBe(0);
    world = takeFromBigTable(world, 1)!;
    expect(tableSlots(world)).toEqual([medium, null, large]);
    expect(countOf(world.bag, large)).toBe(1);
  });
});

describe('monsters eat sets (spec 6.3, 6.4)', () => {
  // puinun: favourite strawberry skewer · likes grilled corn and warm honey milk · dislikes grilled fish
  it('affection is every dish by its own taste, and a combo is ×1.2 more', () => {
    const world = newWorld();
    const combo = feed(world, 'puinun', setItem('small', [corn, milk]), 0);
    const dishes = dishPoints('puinun', 'grilled_corn', 1, 0, world.gauges.cleanliness) + dishPoints('puinun', 'warm_honey_milk', 1, 0, world.gauges.cleanliness);
    expect(combo.points).toBeCloseTo(dishes * setTable.comboAffection);
    const free = feed(world, 'puinun', setItem('small', [corn, egg]), 0);
    expect(free.points).toBeCloseTo(dishPoints('puinun', 'grilled_corn', 1, 0, world.gauges.cleanliness) + dishPoints('puinun', 'boiled_egg', 1, 0, world.gauges.cleanliness));
  });

  it('takes a set only when at least one dish is liked, one set per take', () => {
    const liked = setItem('small', [skewer, egg]);
    const disliked = setItem('small', [fish, egg]);
    const world: World = { ...newWorld(), tray: { ...newWorld().tray, plates: [{ item: liked, count: 2 }, { item: disliked, count: 1 }, null] } };
    const plan = planVisit(world, 'puinun', createRng(3));
    expect(plan.takes).toEqual([{ plate: 0, item: liked, count: 1, reaction: 'like' }]);
    expect(plan.pouts).toEqual([1]);
    const taken = takePlate(world, 'puinun', plan.takes[0]!, newVisitMemo());
    expect(taken.taken).toBe(1);
    expect(taken.world.tray.plates[0]).toEqual({ item: liked, count: 1 });
    expect(taken.world.monsters.tasted.puinun).toEqual(expect.arrayContaining(['strawberry_skewer', 'boiled_egg']));
  });

  it('walks to the big table for a set with a favourite dish', () => {
    const set = setItem('medium', [rice, salad, egg]);
    const world: World = { ...newWorld(), sets: { reputation: 0, combos: [], bigTable: { owned: true, sets: [null, set, null] } } };
    const plan = planVisit(world, 'puinun', createRng(1));
    const take = planBigTable(world, 'puinun', plan)!;
    expect(take).toEqual({ plate: bigTablePlate(1), item: set, count: 1, reaction: 'favourite' });
    expect(tableSlotOf(take.plate)).toBe(1);
    expect(tableSlotOf(0)).toBeNull();
    const eaten = takePlate(world, 'puinun', take, newVisitMemo());
    expect(eaten.world.sets.bigTable.sets).toEqual([null, null, null]);
    expect(eaten.world.monsters.affection.puinun!.points).toBeGreaterThan(0);
    const plain = { ...world, sets: { ...world.sets, bigTable: { owned: true, sets: [setItem('medium', [rice, fish, egg]), null, null] } } };
    expect(planBigTable(plain, 'puinun', planVisit(plain, 'puinun', createRng(1)))).toBeNull();
  });

  it('takes one set from the big table per visit, the best one first', () => {
    const liked = setItem('medium', [rice, skewer, egg]);
    const favourite = setItem('large', [rice, salad, egg, fish]);
    const world: World = { ...newWorld(), sets: { reputation: 0, combos: [], bigTable: { owned: true, sets: [liked, favourite, liked] } } };
    const plan = planVisit(world, 'puinun', createRng(1));
    const take = planBigTable(world, 'puinun', plan)!;
    expect(take).toEqual({ plate: bigTablePlate(1), item: favourite, count: 1, reaction: 'favourite' });
    const eaten = takePlate(world, 'puinun', take, newVisitMemo()).world;
    expect(tableSlots(eaten)).toEqual([liked, null, liked]);
    // the next guest takes the leftmost liked set
    expect(planBigTable(eaten, 'puinun', planVisit(eaten, 'puinun', createRng(1)))).toEqual({ plate: bigTablePlate(0), item: liked, count: 1, reaction: 'like' });
  });
});

describe('gio hints one secret set at a time (spec 6.2)', () => {
  it('hints the next reachable set only after the hinted one is found', () => {
    const base = newWorld();
    const known = [...base.recipes.known, 'plain_rice', 'grilled_fish'];
    const report = { ...(base.gio.report ?? {}), day: 3, tier: 0 } as NonNullable<World['gio']['report']>;
    const world: World = { ...base, day: 3, recipes: { ...base.recipes, known }, gio: { ...base.gio, report } };
    const first = gainTips(world);
    const hints = first.gio.tips.filter((tip) => tip.kind === 'set_hint');
    expect(hints.map((tip) => tip.monster)).toEqual(['rice_set']);
    expect(tipText(hints[0]!)).not.toBe('');
    const later = gainTips({ ...first, day: 4, gio: { ...first.gio, report: { ...report, day: 4 } } });
    expect(later.gio.tips.filter((tip) => tip.kind === 'set_hint')).toHaveLength(1);
    const found = { ...first, day: 4, sets: { ...first.sets, combos: ['rice_set'] }, gio: { ...first.gio, report: { ...report, day: 4 } } };
    // nothing else is reachable with the recipes she knows yet
    expect(gainTips(found).gio.tips.filter((tip) => tip.kind === 'set_hint')).toHaveLength(1);
    const learned = { ...found, recipes: { ...found.recipes, known: [...known, 'grilled_corn', 'warm_honey_milk'] } };
    const next = gainTips(learned).gio.tips.filter((tip) => tip.kind === 'set_hint');
    expect(next).toHaveLength(2);
    expect(next[1]!.monster).not.toBe('rice_set');
  });
});

describe('save versions 20 and 21', () => {
  it('adds the sets block to an old save', () => {
    const file = toSaveFile(newWorld());
    const { sets: _sets, ...oldWorld } = file.world;
    const parsed = parseSaveFile({ ...file, version: 19, world: oldWorld })!;
    expect(SAVE_VERSION).toBe(25);
    expect(parsed.version).toBe(25);
    expect(parsed.world.sets).toEqual({ reputation: 0, combos: [], bigTable: { owned: false, sets: [null, null, null] } });
  });

  it('moves the one set on the big table into the first of 3 slots', () => {
    const set = setItem('medium', [rice, fish, egg]);
    const file = toSaveFile(newWorld());
    const oldWorld = { ...file.world, sets: { reputation: 40, combos: ['mackerel_tray'], bigTable: { owned: true, set } } };
    const parsed = parseSaveFile({ ...file, version: 20, world: oldWorld })!;
    expect(parsed.world.sets).toEqual({ reputation: 40, combos: ['mackerel_tray'], bigTable: { owned: true, sets: [set, null, null] } });
  });
});
