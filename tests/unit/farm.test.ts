import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import type { World } from '../../src/core/state';
import balance from '../../src/data/balance.json';
import {
  actionFor,
  addToBag,
  applyFarmAction,
  canStoreHarvest,
  convertToSeeds,
  countOf,
  crops,
  growFarm,
  isAsleep,
  isReady,
  stageOf,
  type FarmAction,
} from '../../src/systems/farm';
import { newWorld } from '../../src/systems/gauges';
import { SAVE_VERSION, parseSaveFile, toSaveFile } from '../../src/systems/save';
import { sleep } from '../../src/systems/time';

const seeded = (seed: string, count = 1): World => ({ ...newWorld(), bag: [{ item: `seed_${seed}`, count }] });

function act(world: World, action: FarmAction, seed: string | null = null, index = 0): World {
  const next = applyFarmAction(world, index, action, seed);
  if (!next) throw new Error(`${action} failed`);
  return next;
}

const planted = (seed: string): World => act(act(seeded(seed), 'till'), 'plant', seed);
const plot0 = (world: World) => world.farm.plots[0]!;

function growUntilReady(start: World): World {
  let world = start;
  for (let day = 0; day < 40 && !isReady(plot0(world)); day += 1) world = sleep(act(world, 'water'));
  return world;
}

describe('crop numbers', () => {
  it('match the GDD growth table', () => {
    expect(Object.keys(crops)).toHaveLength(14);
    expect(crops.scallion).toMatchObject({ growDays: 3, regrowDays: null });
    expect(crops.chili).toMatchObject({ growDays: 5, regrowDays: 3 });
    expect(crops.pumpkin).toMatchObject({ growDays: 10, regrowDays: null });
    expect(crops.strawberry).toMatchObject({ growDays: 8, regrowDays: 3 });
  });
});

describe('growing', () => {
  it('starts with 16 untilled plots', () => {
    expect(newWorld().farm.plots).toHaveLength(16);
    expect(newWorld().farm.plots.every((plot) => !plot.tilled && !plot.crop)).toBe(true);
  });

  it('grows a scallion ready to pick in 3 watered days through 4 equal stages', () => {
    let world = planted('scallion');
    const stages = [stageOf(plot0(world))];
    for (let day = 0; day < 3; day += 1) {
      world = sleep(act(world, 'water'));
      stages.push(stageOf(plot0(world)));
    }
    expect(stages).toEqual([0, 1, 2, 3]);
    expect(world.day).toBe(4);
    expect(isReady(plot0(world))).toBe(true);
  });

  it('does not grow or die on an unwatered day, and stays asleep', () => {
    const world = planted('scallion');
    expect(isAsleep(plot0(world))).toBe(true);
    let next = world;
    for (let day = 0; day < 10; day += 1) next = sleep(next);
    expect(plot0(next).crop?.daysGrown).toBe(0);
    expect(isAsleep(plot0(next))).toBe(true);
  });

  it('wakes when watered and dries out by the next morning', () => {
    const watered = act(planted('scallion'), 'water');
    expect(isAsleep(plot0(watered))).toBe(false);
    expect(plot0(watered).watered).toBe(true);
    expect(plot0(growFarm(watered.farm) && sleep(watered)).watered).toBe(false);
  });

  it('never needs water once ready', () => {
    const world = growUntilReady(planted('scallion'));
    expect(isAsleep(plot0(world))).toBe(false);
    expect(actionFor(plot0(world), 'can', null, world.bag)).toBeNull();
  });
});

describe('harvesting', () => {
  it('empties the plot of a one-time crop and puts the yield in the bag', () => {
    const world = act(growUntilReady(planted('scallion')), 'harvest');
    expect(countOf(world.bag, 'produce_scallion')).toBe(crops.scallion!.firstYield);
    expect(plot0(world)).toEqual({ tilled: false, watered: false, crop: null });
  });

  it('regrows a repeat crop after its regrow days', () => {
    let world = act(growUntilReady(planted('chili')), 'harvest');
    expect(plot0(world).crop?.harvests).toBe(1);
    expect(isReady(plot0(world))).toBe(false);
    for (let day = 0; day < 3; day += 1) world = sleep(act(world, 'water'));
    expect(isReady(plot0(world))).toBe(true);
    const again = act(world, 'harvest');
    expect(countOf(again.bag, 'produce_chili')).toBe(crops.chili!.firstYield + crops.chili!.regrowYield!);
  });

  it('keeps the produce on the plot when the bag is full', () => {
    const ready = growUntilReady(planted('scallion'));
    const full: World = {
      ...ready,
      bag: Array.from({ length: balance.farm.bag.slots }, () => ({ item: 'seed_rice', count: balance.farm.bag.stack })),
    };
    expect(canStoreHarvest(full, 0)).toBe(false);
    expect(applyFarmAction(full, 0, 'harvest', null)).toBeNull();
    expect(isReady(plot0(full))).toBe(true);
  });
});

describe('tools', () => {
  it('offers only what each tool can do', () => {
    const world = newWorld();
    const empty = plot0(world);
    expect(actionFor(empty, 'hoe', null, world.bag)).toBe('till');
    expect(actionFor(empty, 'can', null, world.bag)).toBeNull();
    expect(actionFor(empty, 'sickle', null, world.bag)).toBeNull();
    const tilled = plot0(act(seeded('rice'), 'till'));
    expect(actionFor(tilled, 'hoe', null, [])).toBeNull();
    expect(actionFor(tilled, 'seeds', null, [{ item: 'seed_rice', count: 1 }])).toBeNull();
    expect(actionFor(tilled, 'seeds', 'rice', [{ item: 'seed_rice', count: 1 }])).toBe('plant');
    expect(actionFor(tilled, 'seeds', 'rice', [])).toBeNull();
  });

  it('digs up a living plant with the hoe', () => {
    const world = planted('chili');
    expect(actionFor(plot0(world), 'hoe', null, world.bag)).toBe('dig');
    expect(plot0(act(world, 'dig')).crop).toBeNull();
  });

  it('spends 10 game minutes and garden gauge costs on each job', () => {
    const world = seeded('rice');
    const next = act(world, 'till');
    expect(next.hour - world.hour).toBeCloseTo(10 / 60);
    expect(next.gauges.cleanliness).toBeCloseTo(100 - 3 / 6);
    expect(next.gauges.happiness).toBeCloseTo(100 - 2 / 6);
    expect(next.gauges.fullness).toBeCloseTo(100 - 4 / 6);
  });
});

describe('bag', () => {
  it('holds 30 slots of 99 and refuses what does not fit, whole', () => {
    expect(balance.farm.bag).toEqual({ slots: 30, stack: 99 });
    const bag = addToBag([{ item: 'seed_rice', count: 98 }], 'seed_rice', 3)!;
    expect(bag).toEqual([{ item: 'seed_rice', count: 99 }, { item: 'seed_rice', count: 2 }]);
    const full = Array.from({ length: 30 }, () => ({ item: 'seed_rice', count: 99 }));
    expect(addToBag(full, 'seed_rice', 1)).toBeNull();
  });

  it('turns one vegetable into 2 or 3 seeds', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let run = 0; run < 40; run += 1) {
      const world: World = { ...newWorld(), bag: [{ item: 'produce_tomato', count: 1 }] };
      const next = convertToSeeds(world, 'tomato', rng)!;
      expect(countOf(next.bag, 'produce_tomato')).toBe(0);
      seen.add(countOf(next.bag, 'seed_tomato'));
    }
    expect([...seen].sort()).toEqual([2, 3]);
  });

  it('refuses to convert what is not there', () => {
    expect(convertToSeeds({ ...newWorld(), bag: [] }, 'tomato', createRng(1))).toBeNull();
  });
});

describe('save', () => {
  it('keeps plots and bag through a save file', () => {
    const world = planted('rice');
    const parsed = parseSaveFile(JSON.parse(JSON.stringify(toSaveFile(world))));
    expect(parsed?.world.farm).toEqual(world.farm);
    expect(parsed?.world.bag).toEqual(world.bag);
  });

  it('upgrades a version 3 save with an empty farm and the starter bag', () => {
    const { farm: _farm, bag: _bag, ...oldWorld } = newWorld();
    const parsed = parseSaveFile({ version: 3, savedAt: 'x', world: { ...oldWorld, day: 9 } });
    expect(parsed?.version).toBe(SAVE_VERSION);
    expect(parsed?.world.day).toBe(9);
    expect(parsed?.world.farm.plots).toHaveLength(16);
    expect(parsed?.world.bag).toEqual(newWorld().bag);
  });
});
