import { describe, expect, it } from 'vitest';
import { newWorld } from '../../src/systems/gauges';
import { canEnterGate, chestOpened, forageLeftToday, forageReady, gateMapOf, gateTimeUp, gates, hoursInGate, openGateChest, pickForage, pickedToday } from '../../src/systems/gates';
import { countOf } from '../../src/systems/farm';
import { SAVE_VERSION, parseSaveFile, toSaveFile } from '../../src/systems/save';
import balance from '../../src/data/balance.json';

describe('gate 3 test map', () => {
  it('loads the painted map of gate 3, and every other gate enters the shared colour-box scene until its art comes', () => {
    const map = gateMapOf(3)!;
    expect(map.size).toEqual([28, 16]);
    expect(map.tile).toBe(32);
    expect(map.forage.points).toHaveLength(4);
    expect(map.kin?.variants).toEqual(['brown', 'grey', 'cream']);
    for (let floor = 1; floor <= 10; floor += 1) expect(canEnterGate(floor)).toBe(true);
    const box = gateMapOf(1)!;
    expect(box.kin).toBeUndefined();
    for (const floor of [1, 2, 4, 5, 6, 7, 8, 9, 10]) expect(gateMapOf(floor)).toBe(box);
  });

  it('gate 2 gives bamboo as its daily forage (the bamboo cup for drinks needs it)', () => {
    const world = newWorld();
    const picked = pickForage(world, 2, 0);
    if (!picked || picked === 'full') throw new Error('no bamboo');
    expect(countOf(picked.world.bag, 'bamboo')).toBe(1);
    expect(forageLeftToday(picked.world, 2)).toBe(true);
    expect(forageLeftToday(world, 1)).toBe(false);
  });

  it('spawns on a walkable cell just above the exit, and the forage, owner and chest stand on walkable cells', () => {
    for (const floor of [3, 1]) {
      const map = gateMapOf(floor)!;
      const blocked = new Set(map.blocked.map(([x, y]) => `${x},${y}`));
      const free = ([x, y]: readonly [number, number]): boolean => !blocked.has(`${Math.floor(x)},${Math.floor(y)}`);
      expect(free(map.spawn)).toBe(true);
      expect(map.spawn[1]).toBeLessThan(map.exit_zone[1]);
      for (const point of [...map.forage.points, map.owner.pos, map.reward_chest.pos]) expect(free(point)).toBe(true);
    }
  });
});

describe('gate reward chest', () => {
  it('gives 5 cloud lettuce seeds once, then never again', () => {
    const world = newWorld();
    const first = openGateChest(world, 3);
    if (!first || first === 'full') throw new Error('chest did not open');
    expect(first.reward).toEqual({ item: 'seed_cloud_lettuce', count: 5 });
    expect(countOf(first.world.bag, 'seed_cloud_lettuce')).toBe(5);
    expect(chestOpened(first.world, 3)).toBe(true);
    expect(openGateChest(first.world, 3)).toBeNull();
  });

  it('keeps the chest closed when the bag is full', () => {
    const world = newWorld();
    const full = { ...world, bag: Array.from({ length: balance.farm.bag.slots }, (_, index) => ({ item: `fish_test_${index}`, count: balance.farm.bag.stack })) };
    expect(openGateChest(full, 3)).toBe('full');
    expect(chestOpened(full, 3)).toBe(false);
  });

  it('gates without a reward give nothing', () => {
    expect(openGateChest(newWorld(), 1)).toBeNull();
  });

  it('gates 5 and 9 teach their secret recipe once, even with a full bag', () => {
    const world = newWorld();
    const full = { ...world, bag: Array.from({ length: balance.farm.bag.slots }, (_, index) => ({ item: `fish_test_${index}`, count: balance.farm.bag.stack })) };
    for (const [floor, recipe] of [[5, 'honey_pancake'], [9, 'strawberry_milk_pudding']] as const) {
      expect(world.recipes.known).not.toContain(recipe);
      const opened = openGateChest(full, floor);
      if (!opened || opened === 'full') throw new Error(`gate ${floor} chest did not open`);
      expect(opened.reward).toEqual({ recipe });
      expect(opened.world.recipes.known.filter((id) => id === recipe)).toHaveLength(1);
      expect(opened.world.bag).toEqual(full.bag);
      expect(openGateChest(opened.world, floor)).toBeNull();
    }
  });
});

describe('gate forage', () => {
  it('picks 1 wild cloud lettuce per point per day and grows back the next day', () => {
    let world = newWorld();
    for (let point = 0; point < 4; point += 1) {
      const picked = pickForage(world, 3, point);
      if (!picked || picked === 'full') throw new Error(`point ${point} did not give anything`);
      world = picked.world;
    }
    expect(countOf(world.bag, 'ing_wild_cloud_lettuce')).toBe(4);
    expect(pickedToday(world, 3)).toEqual([0, 1, 2, 3]);
    expect(pickForage(world, 3, 0)).toBeNull();
    expect(forageReady(world, 3, 2)).toBe(false);
    const tomorrow = { ...world, day: world.day + 1 };
    expect(pickedToday(tomorrow, 3)).toEqual([]);
    expect(forageReady(tomorrow, 3, 2)).toBe(true);
    // จุดทองในเมนูเลือกชั้น: วันนี้ยังเหลือของป่าไหม
    expect(forageLeftToday(world, 3)).toBe(false);
    expect(forageLeftToday(tomorrow, 3)).toBe(true);
    expect(forageLeftToday(tomorrow, 4)).toBe(false);
  });

  it('ignores points that do not exist', () => {
    expect(pickForage(newWorld(), 3, 4)).toBeNull();
    expect(pickForage(newWorld(), 3, -1)).toBeNull();
  });
});

describe('gate stay limit', () => {
  it('counts game hours since entering, across midnight, and the limit is gates.json stayHours (2)', () => {
    expect(gates.stayHours).toBe(2);
    const world = newWorld();
    const entered = { day: world.day, hour: 10 };
    expect(hoursInGate({ ...world, hour: 11.5 }, entered)).toBeCloseTo(1.5);
    expect(gateTimeUp({ ...world, hour: 11.9 }, entered)).toBe(false);
    expect(gateTimeUp({ ...world, hour: 12 }, entered)).toBe(true);
    expect(hoursInGate({ ...world, hour: 25 }, { day: world.day, hour: 23.5 })).toBeCloseTo(1.5);
  });
});

describe('gate save', () => {
  it('keeps opened chests and picked forage in the save (version 24) and old saves start empty', () => {
    expect(SAVE_VERSION).toBe(24);
    const opened = openGateChest(newWorld(), 3);
    if (!opened || opened === 'full') throw new Error('chest did not open');
    const picked = pickForage(opened.world, 3, 1);
    if (!picked || picked === 'full') throw new Error('forage did not give anything');
    const parsed = parseSaveFile(JSON.parse(JSON.stringify(toSaveFile(picked.world))));
    expect(parsed?.world.gates).toEqual({ chests: [3], forage: { '3': { day: 1, picked: [1] } } });

    const old = toSaveFile(newWorld()) as unknown as { version: number; world: Record<string, unknown> };
    delete old.world.gates;
    const migrated = parseSaveFile(JSON.parse(JSON.stringify({ ...old, version: 23 })));
    expect(migrated?.world.gates).toEqual({ chests: [], forage: {} });
  });
});
