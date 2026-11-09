import { describe, expect, it } from 'vitest';
import type { World } from '../../src/core/state';
import lines from '../../src/data/lines.json';
import workbench from '../../src/data/workbench.json';
import { canCook } from '../../src/systems/cooking';
import { canShakeBanana, craft, craftStatus, giveFirstDryingTray, noticeNewItems, ownedCount, shakeBanana } from '../../src/systems/crafting';
import { applyFarmAction, countOf } from '../../src/systems/farm';
import { newWorld } from '../../src/systems/gauges';
import { SAVE_VERSION, parseSaveFile, toSaveFile } from '../../src/systems/save';

// zone-1 food update phase 4 (docs/zone1_food_update_2026-11-08.md §4)
const withBag = (bag: World['bag'], extra: Partial<World> = {}): World => ({ ...newWorld(), bag, ...extra });

describe('workbench recipes (spec 4.2)', () => {
  it('match the approved table', () => {
    expect(workbench).toEqual({
      bamboo_cup: { materials: { bamboo: 1 }, gives: 1, once: true },
      small_woven_tray: { materials: { banana_rope: 1, rice_straw: 2 }, gives: 3 },
      medium_woven_tray: { materials: { bamboo: 2, rice_straw: 2 }, gives: 2 },
      big_woven_tray: { materials: { bamboo: 3, rice_straw: 3 }, gives: 2 },
      drying_tray: { materials: { bamboo: 3, rice_straw: 2 }, gives: 1, station: true, max: 3, afterFirst: true },
      trap: { materials: { bamboo: 2, banana_rope: 2 }, gives: 1, station: true, max: 3 },
    });
  });

  it('makes the bamboo cup once, from 1 bamboo, and it is kept forever', () => {
    const world = withBag([{ item: 'bamboo', count: 3 }]);
    expect(craftStatus(world, 'bamboo_cup')).toBe('ok');
    const made = craft(world, 'bamboo_cup')!;
    expect(countOf(made.bag, 'bamboo_cup')).toBe(1);
    expect(countOf(made.bag, 'bamboo')).toBe(2);
    expect(craftStatus(made, 'bamboo_cup')).toBe('owned');
    expect(craft(made, 'bamboo_cup')).toBeNull();
  });

  it('makes 3 small woven trays from banana rope 1 + rice straw 2, and refuses when something is missing', () => {
    const world = withBag([{ item: 'banana_rope', count: 1 }, { item: 'rice_straw', count: 3 }]);
    const made = craft(world, 'small_woven_tray')!;
    expect(countOf(made.bag, 'small_woven_tray')).toBe(3);
    expect(countOf(made.bag, 'banana_rope')).toBe(0);
    expect(countOf(made.bag, 'rice_straw')).toBe(1);
    expect(craftStatus(made, 'small_woven_tray')).toBe('missing');
    expect(craft(made, 'small_woven_tray')).toBeNull();
  });

  it('starts with the old trap and makes traps #2–3, then stops at 3', () => {
    let world = withBag([{ item: 'bamboo', count: 9 }, { item: 'banana_rope', count: 9 }]);
    expect(ownedCount(world, 'trap')).toBe(1);
    world = craft(world, 'trap')!;
    world = craft(world, 'trap')!;
    expect(ownedCount(world, 'trap')).toBe(3);
    expect(craftStatus(world, 'trap')).toBe('max');
    expect(countOf(world.bag, 'trap')).toBe(0);
  });

  it('makes drying trays only after the first one (her idea after gate 2, dev card for now), up to 3', () => {
    let world = withBag([{ item: 'bamboo', count: 9 }, { item: 'rice_straw', count: 9 }]);
    expect(craftStatus(world, 'drying_tray')).toBe('locked');
    world = giveFirstDryingTray(world);
    expect(ownedCount(world, 'drying_tray')).toBe(1);
    world = craft(craft(world, 'drying_tray')!, 'drying_tray')!;
    expect(ownedCount(world, 'drying_tray')).toBe(3);
    expect(craftStatus(world, 'drying_tray')).toBe('max');
  });
});

describe('materials (spec 4.1)', () => {
  it('shaking the banana clump gives banana leaf ×2 + banana rope ×1, once a day', () => {
    const world = newWorld();
    const shaken = shakeBanana(world)!;
    expect(countOf(shaken.bag, 'ing_banana_leaf')).toBe(countOf(world.bag, 'ing_banana_leaf') + 2);
    expect(countOf(shaken.bag, 'banana_rope')).toBe(1);
    expect(canShakeBanana(shaken)).toBe(false);
    expect(shakeBanana(shaken)).toBeNull();
    expect(canShakeBanana({ ...shaken, day: shaken.day + 1 })).toBe(true);
  });

  it('harvesting 1 rice cell gives 1 rice straw', () => {
    const base = newWorld();
    const plots = base.farm.plots.map((plot, index) => (index === 0 ? { ...plot, tilled: true, watered: true, crop: { id: 'rice', daysGrown: 8, harvests: 0 } } : plot));
    const harvested = applyFarmAction({ ...base, farm: { plots } }, 0, 'harvest', null)!;
    expect(countOf(harvested.bag, 'rice_straw')).toBe(1);
  });
});

describe('every drink needs the bamboo cup (GDD: crafted once, used forever)', () => {
  it('cannot cook a drink without the cup, can with it, and the cup is not used up', () => {
    const bag = [{ item: 'ing_milk', count: 2 }, { item: 'ing_honey', count: 2 }];
    expect(canCook(withBag(bag), 'warm_honey_milk')).toBe(false);
    expect(canCook(withBag([...bag, { item: 'bamboo_cup', count: 1 }]), 'warm_honey_milk')).toBe(true);
    // food does not need it
    expect(canCook(withBag([{ item: 'ing_egg', count: 1 }]), 'boiled_egg')).toBe(true);
  });
});

describe('first-time lines (her own knowledge, never "grandma taught me")', () => {
  it('says each line once, the first time the item is in the bag', () => {
    const world = withBag([{ item: 'rice_straw', count: 1 }, { item: 'ing_egg', count: 1 }]);
    const first = noticeNewItems(world);
    expect(first.lines).toEqual([lines.player.firstItem.rice_straw]);
    expect(noticeNewItems(first.world).lines).toEqual([]);
    for (const line of Object.values(lines.player.firstItem)) expect(line).not.toMatch(/ยาย/);
  });
});

describe('save version 18 (and later)', () => {
  it('adds crafting to an old save and treats items already in the bag as noticed', () => {
    const file = toSaveFile(withBag([{ item: 'fish_shrimp', count: 2 }]));
    const { crafting: _crafting, ...oldWorld } = file.world;
    const parsed = parseSaveFile({ ...file, version: 17, world: oldWorld })!;
    expect(SAVE_VERSION).toBe(24);
    expect(parsed.version).toBe(24);
    expect(parsed.world.crafting).toEqual({ bananaDay: 0, noticed: ['fish_shrimp'], stations: { drying_tray: 0, trap: 1 }, drying: [], traps: [], mortar: false });
  });
});
