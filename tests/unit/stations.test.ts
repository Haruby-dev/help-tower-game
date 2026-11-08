import { describe, expect, it } from 'vitest';
import type { World } from '../../src/core/state';
import stations from '../../src/data/stations.json';
import { countOf } from '../../src/systems/farm';
import { newWorld } from '../../src/systems/gauges';
import { SAVE_VERSION, parseSaveFile, toSaveFile } from '../../src/systems/save';
import {
  collectDrying,
  collectTrap,
  findMortar,
  finishPounding,
  isDryingReady,
  isTrapReady,
  judgePound,
  maxDrying,
  mortarJobs,
  poundStars,
  ringMs,
  setTrap,
  startDrying,
  trapCatch,
} from '../../src/systems/stations';

// zone-1 food update phase 5 (docs/zone1_food_update_2026-11-08.md §5)
const base = (bag: World['bag'], extra: Partial<World> = {}): World => {
  const world = newWorld();
  return { ...world, bag, ...extra, crafting: { ...world.crafting, stations: { drying_tray: 1, trap: 3 }, ...(extra.crafting ?? {}) } };
};
const fixed = (value: number) => ({ next: () => value, between: (min: number) => min });

describe('drying tray (spec 5.1)', () => {
  it('dries one kind, up to 10 pieces, any time of day, ready the next day at 06:00', () => {
    const world = base([{ item: 'fish_shrimp', count: 12 }], { hour: 21 });
    expect(maxDrying(world, 'dried_shrimp')).toBe(10);
    const drying = startDrying(world, 0, 'dried_shrimp', 10)!;
    expect(countOf(drying.bag, 'fish_shrimp')).toBe(2);
    expect(startDrying(drying, 0, 'dried_shrimp', 1)).toBeNull();
    expect(isDryingReady({ ...drying, hour: 25 }, 0)).toBe(false);
    const morning = { ...drying, day: drying.day + 1, hour: 6 };
    expect(isDryingReady(morning, 0)).toBe(true);
    const done = collectDrying(morning, 0)!;
    expect(countOf(done.world.bag, 'ing_dried_shrimp')).toBe(10);
    expect(done.world.crafting.drying[0]).toBeNull();
  });

  it('makes kapi from shrimp 2 + salt 1 on the tray, and dries any fish (not shrimp) into dried fish', () => {
    const world = base([{ item: 'fish_shrimp', count: 4 }, { item: 'ing_salt', count: 5 }, { item: 'fish_silver_minnow', count: 1 }]);
    expect(maxDrying(world, 'kapi')).toBe(2);
    const kapi = startDrying(world, 0, 'kapi', 2)!;
    expect(countOf(kapi.bag, 'fish_shrimp')).toBe(0);
    expect(countOf(kapi.bag, 'ing_salt')).toBe(3);
    expect(kapi.crafting.drying[0]).toMatchObject({ recipe: 'kapi', count: 2, shows: 'fish_shrimp' });
    expect(maxDrying(base([{ item: 'fish_shrimp', count: 3 }]), 'dried_fish')).toBe(0);
    const fish = startDrying(world, 0, 'dried_fish', 1)!;
    expect(fish.crafting.drying[0]!.shows).toBe('fish_silver_minnow');
  });

  it('cannot use a tray she does not have', () => {
    expect(startDrying(base([{ item: 'fish_shrimp', count: 2 }]), 1, 'dried_shrimp', 1)).toBeNull();
  });
});

describe('trap (spec 5.2)', () => {
  it('goes in the water from 17:00, gives 1 catch the next morning, shrimp 70% / crab 30%', () => {
    expect(setTrap(base([], { hour: 16.5 }), 0)).toBeNull();
    const set = setTrap(base([], { hour: 17 }), 0)!;
    expect(isTrapReady({ ...set, hour: 23 }, 0)).toBe(false);
    const morning = { ...set, day: set.day + 1, hour: 6 };
    expect(isTrapReady(morning, 0)).toBe(true);
    const caught = collectTrap(morning, 0, fixed(0.1))!;
    expect(caught.item).toBe('fish_shrimp');
    expect(countOf(caught.world.bag, 'fish_shrimp')).toBe(1);
    expect(caught.world.crafting.traps[0]).toBeNull();
    expect(trapCatch(fixed(0.69))).toBe('fish_shrimp');
    expect(trapCatch(fixed(0.71))).toBe('fish_crab');
    expect(stations.trap.catch).toEqual([
      { item: 'fish_shrimp', chance: 0.7 },
      { item: 'fish_crab', chance: 0.3 },
    ]);
  });

  it('the old trap at the dock is there from day 1', () => {
    expect(newWorld().crafting.stations.trap).toBe(1);
    expect(setTrap({ ...newWorld(), hour: 18 }, 0)).not.toBeNull();
    expect(setTrap({ ...newWorld(), hour: 18 }, 1)).toBeNull();
  });
});

describe('stone mortar + pounding (spec 5.3)', () => {
  it('rings get faster from 1.2 s to 0.8 s over 6 pounds; perfect ±0.08 s, good ±0.18 s', () => {
    expect(ringMs(0)).toBe(1200);
    expect(ringMs(5)).toBe(800);
    expect(judgePound(-80)).toBe('perfect');
    expect(judgePound(120)).toBe('good');
    expect(judgePound(181)).toBe('miss');
  });

  it('points out of 12: 10+ = 3 stars, 6–9 = 2 stars, less = 1 star', () => {
    expect(poundStars(12)).toBe(3);
    expect(poundStars(10)).toBe(3);
    expect(poundStars(9)).toBe(2);
    expect(poundStars(6)).toBe(2);
    expect(poundStars(5)).toBe(1);
  });

  it('makes fish balls (fish 1 + salt 1 → 2) with no stars, and passes 15 game minutes', () => {
    const world = base([{ item: 'fish_silver_minnow', count: 2 }, { item: 'ing_salt', count: 2 }], { hour: 10 });
    const done = finishPounding(world, { kind: 'item', id: 'fish_ball' }, 2, 1)!;
    expect(done.item).toBe('ing_fish_ball');
    expect(countOf(done.world.bag, 'ing_fish_ball')).toBe(4);
    expect(done.world.hour).toBeCloseTo(10.25);
  });

  it('powders: umami 3 spoons from dried shrimp + dried fish, chili flakes 3 from dried chili 2', () => {
    const world = base([{ item: 'ing_dried_shrimp', count: 1 }, { item: 'ing_dried_fish', count: 1 }, { item: 'ing_dried_chili', count: 2 }]);
    expect(countOf(finishPounding(world, { kind: 'item', id: 'umami_powder' }, 1, 3)!.world.bag, 'ing_umami_powder')).toBe(3);
    expect(countOf(finishPounding(world, { kind: 'item', id: 'chili_flakes' }, 1, 3)!.world.bag, 'ing_chili_flakes')).toBe(3);
  });

  it('a dish gets the lower of ingredient stars and minigame stars (her choice: stars for dishes only)', () => {
    const bag = [
      { item: 'fish_silver_minnow', count: 1 },
      { item: 'ing_egg', count: 1 },
      { item: 'produce_chili@3', count: 1 },
      { item: 'produce_coriander@3', count: 1 },
    ];
    const world = findMortar(base(bag));
    expect(world.recipes.known).toEqual(expect.arrayContaining(['fish_cake', 'grilled_meatball_skewer']));
    expect(mortarJobs(world).some((job) => job.kind === 'dish' && job.id === 'fish_cake')).toBe(true);
    const done = finishPounding(world, { kind: 'dish', id: 'fish_cake' }, 1, 2)!;
    expect(done.item).toBe('dish_fish_cake_2');
    expect(done.world.recipes.bestStars.fish_cake).toBe(2);
  });
});

describe('save version 19', () => {
  it('adds empty drying trays, traps on land and no mortar to an old save', () => {
    const file = toSaveFile(newWorld());
    const { drying: _d, traps: _t, mortar: _m, ...oldCrafting } = file.world.crafting;
    const parsed = parseSaveFile({ ...file, version: 18, world: { ...file.world, crafting: oldCrafting } })!;
    expect(SAVE_VERSION).toBe(20);
    expect(parsed.world.crafting).toMatchObject({ drying: [], traps: [], mortar: false });
  });
});
