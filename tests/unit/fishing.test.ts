import { describe, expect, it } from 'vitest';
import { createRng, type Rng } from '../../src/core/rng';
import type { World } from '../../src/core/state';
import balance from '../../src/data/balance.json';
import { finishBath } from '../../src/systems/bath';
import { chestData, openChest, rollChestTier } from '../../src/systems/chests';
import { canCook, matchRecipe, startCooking } from '../../src/systems/cooking';
import { countOf } from '../../src/systems/farm';
import { autoHooks, biteCandidates, chestChance, chosenBait, finishCast, fishTable, makeBait, rollCatch, spendFishingTime } from '../../src/systems/fishing';
import { newWorld } from '../../src/systems/gauges';
import { parseSaveFile, SAVE_VERSION } from '../../src/systems/save';
import { sleep } from '../../src/systems/time';
import { rainOnFarm, rollWeather, weatherFor } from '../../src/systems/weather';

/** ค่าสุ่มที่กำหนดเองทีละค่า ใช้บังคับผลให้ทดสอบซ้ำได้ */
const fixed = (...values: number[]): Rng => {
  let index = 0;
  const next = (): number => values[Math.min(index++, values.length - 1)]!;
  return { next, between: (min, max) => min + next() * (max - min) };
};
const world = (changes: Partial<World> = {}): World => ({ ...newWorld(), ...changes });
const NO_CHEST = 0.99;

describe('fish table', () => {
  it('has the 8 zone-1 fish from the GDD, all catchable with the bamboo rod', () => {
    expect(Object.keys(fishTable)).toHaveLength(8);
    expect(Object.values(fishTable).every((fish) => fish.rod === 'bamboo')).toBe(true);
    expect(fishTable.meow_salmon).toMatchObject({ rank: 'D', hours: [6, 9], bait: 'corn', price: 450 });
    expect(fishTable.cloud_bass).toMatchObject({ rank: 'D', weather: 'rain', bait: 'cloud_lettuce' });
  });

  it('only offers the fish that are out at this hour and weather', () => {
    expect(biteCandidates(world({ weather: 'sunny' }), 'normal', 7).sort()).toEqual(['golden_carp', 'pond_tilapia', 'silver_minnow']);
    expect(biteCandidates(world({ weather: 'sunny' }), 'normal', 12).sort()).toEqual(['lost_mackerel', 'pond_tilapia', 'silver_minnow']);
    expect(biteCandidates(world({ weather: 'rain' }), 'normal', 21).sort()).toEqual(['glow_squid', 'mud_catfish', 'pond_tilapia', 'silver_minnow']);
    expect(biteCandidates(world({ weather: 'rain' }), 'normal', 25.5)).toContain('glow_squid');
  });

  it('pulls the special fish with its bait, and falls back to the normal pool when it is not out', () => {
    expect(biteCandidates(world(), 'corn', 6.5)).toEqual(['meow_salmon']);
    expect(biteCandidates(world(), 'corn', 12)).not.toContain('meow_salmon');
    expect(biteCandidates(world({ weather: 'rain' }), 'cloud_lettuce', 14)).toEqual(['cloud_bass']);
    expect(biteCandidates(world({ weather: 'sunny' }), 'cloud_lettuce', 14)).not.toContain('cloud_bass');
    expect(biteCandidates(world(), 'normal', 6.5)).not.toContain('meow_salmon');
  });

  it('can catch all 8 fish when the conditions are right', () => {
    const caught = new Set<string>();
    const rng = createRng(7);
    const tries: [World['weather'], string, number][] = [
      ['sunny', 'normal', 7],
      ['sunny', 'normal', 12],
      ['rain', 'normal', 21],
      ['sunny', 'corn', 7],
      ['rain', 'cloud_lettuce', 12],
    ];
    for (const [weather, bait, hour] of tries) {
      for (let i = 0; i < 200; i += 1) {
        const result = rollCatch(world({ weather }), bait, hour, rng);
        if (result?.kind === 'fish') caught.add(result.fish);
      }
    }
    expect([...caught].sort()).toEqual(Object.keys(fishTable).sort());
  });
});

describe('chests from fishing', () => {
  it('gives a 3% chance with the bamboo rod, plus 2% in rain or at night', () => {
    expect(chestChance(world({ weather: 'sunny' }), 10)).toBeCloseTo(0.03);
    expect(chestChance(world({ weather: 'rain' }), 10)).toBeCloseTo(0.05);
    expect(chestChance(world({ weather: 'sunny' }), 19)).toBeCloseTo(0.05);
  });

  it('replaces the fish with a chest on a lucky roll', () => {
    expect(rollCatch(world(), 'normal', 10, fixed(0.01, 0.5))).toEqual({ kind: 'chest', tier: 'wooden' });
    expect(rollCatch(world(), 'normal', 10, fixed(NO_CHEST, 0))).toMatchObject({ kind: 'fish' });
  });

  it('rolls wooden 75%, silver 20%, golden 5%', () => {
    expect(rollChestTier(fixed(0.5))).toBe('wooden');
    expect(rollChestTier(fixed(0.8))).toBe('silver');
    expect(rollChestTier(fixed(0.97))).toBe('golden');
  });

  it('opens a chest into coins and items, logs the coins, and never hands out the parked outfit set', () => {
    const rng = createRng(3);
    let next = world({ bag: [{ item: 'chest_silver', count: 30 }] });
    for (let i = 0; i < 30; i += 1) {
      const opened = openChest(next, 'chest_silver', rng)!;
      expect(opened.rewards[0]!.kind).toBe('coins');
      expect(opened.rewards.slice(1)).toHaveLength(3);
      for (const reward of opened.rewards) if (reward.kind !== 'coins') expect(reward.item.startsWith('outfit_')).toBe(false);
      next = opened.world;
    }
    expect(countOf(next.bag, 'chest_silver')).toBe(0);
    expect(next.wallet.coins).toBeGreaterThanOrEqual(30 * 30);
    expect(next.wallet.log.some((entry) => entry.label === 'wallet.chest')).toBe(true);
    expect(chestData.pool.some((entry) => entry.item.startsWith('outfit_'))).toBe(false);
  });

  it('always puts a cosmetic in a golden chest, and turns duplicates into Sugar Stars', () => {
    const owned = world({ bag: [{ item: 'chest_golden', count: 1 }] });
    const opened = openChest(owned, 'chest_golden', createRng(11))!;
    expect(opened.rewards[1]!.kind).toBe('cosmetic');
    const again = openChest({ ...opened.world, bag: [{ item: 'chest_golden', count: 1 }] }, 'chest_golden', createRng(11))!;
    const first = again.rewards[1]!;
    expect(first.kind === 'cosmetic' && first.duplicateStars).toBe(chestData.tiers.golden.duplicateStars);
    expect(again.world.wallet.stars).toBeGreaterThanOrEqual(chestData.tiers.golden.duplicateStars);
  });

  it('gives a cosmetic after 8 chests in a row without one', () => {
    const due = world({ bag: [{ item: 'chest_wooden', count: 1 }], chests: { sinceCosmetic: chestData.pityAfter } });
    const opened = openChest(due, 'chest_wooden', createRng(5))!;
    expect(opened.rewards[1]!.kind).toBe('cosmetic');
    expect(opened.world.chests.sinceCosmetic).toBe(0);
  });

  it('keeps the chest when the bag is too full for what is inside', () => {
    const full = world({ bag: Array.from({ length: balance.farm.bag.slots }, (_, i) => ({ item: i === 0 ? 'chest_wooden' : `seed_x${i}`, count: i === 0 ? 2 : 99 })) });
    const always = fixed(0.5, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1);
    expect(openChest(full, 'chest_wooden', always)).toBeNull();
  });
});

describe('a cast', () => {
  it('takes 30 minutes in total, adds happiness 8 and costs a little cleanliness', () => {
    const start = world({ hour: 10, gauges: { fullness: 80, happiness: 50, cleanliness: 80, homesickness: 0 } });
    const spent = spendFishingTime(start, 10);
    expect(spent.hour).toBeCloseTo(10.5);
    expect(spent.gauges.happiness).toBe(58);
    expect(spent.gauges.fullness).toBeCloseTo(78);
    expect(spent.gauges.cleanliness).toBeCloseTo(78.5);
    // ช่วงรอกินเวลาไปแล้ว 10 นาที จึงเติมแค่ 20 นาที
    expect(spendFishingTime({ ...start, hour: 10 + 10 / 60 }, 10).hour).toBeCloseTo(10.5);
  });

  it('uses the bait on a catch and keeps it when the fish gets away', () => {
    const start = world({ bag: [{ item: 'bait_normal', count: 2 }] });
    const caught = finishCast(start, 6, 'normal', { kind: 'fish', fish: 'silver_minnow' });
    expect(caught.stored).toBe(true);
    expect(countOf(caught.world.bag, 'bait_normal')).toBe(1);
    expect(countOf(caught.world.bag, 'fish_silver_minnow')).toBe(1);
    expect(caught.world.fishing.caught.silver_minnow).toBe(1);
    const missed = finishCast(start, 6, 'normal', null);
    expect(countOf(missed.world.bag, 'bait_normal')).toBe(2);
    expect(missed.world.hour).toBeCloseTo(6.5);
  });

  it('turns 1 vegetable into 3 normal bait', () => {
    const next = makeBait(world(), 'produce_scallion')!;
    expect(countOf(next.bag, 'bait_normal')).toBe(3);
    expect(countOf(next.bag, 'produce_scallion')).toBe(2);
  });

  it('starts the game with 5 corn bait and 5 cloud-lettuce bait and the bamboo rod', () => {
    const start = newWorld();
    expect(countOf(start.bag, 'bait_corn')).toBe(5);
    expect(countOf(start.bag, 'bait_cloud_lettuce')).toBe(5);
    expect(start.fishing.rods).toEqual(['bamboo']);
  });
});

describe('cooking with fish', () => {
  it('counts any rank F fish for a recipe that asks for a rank F fish', () => {
    const bag = [
      { item: 'fish_pond_tilapia', count: 1 },
      { item: 'ing_salt', count: 1 },
    ];
    expect(canCook(world({ bag }), 'grilled_fish')).toBe(true);
    const next = startCooking(world({ bag }), 'grilled_fish')!;
    expect(countOf(next.bag, 'fish_pond_tilapia')).toBe(0);
    expect(canCook(world({ bag: [{ item: 'fish_golden_carp', count: 1 }, { item: 'ing_salt', count: 1 }] }), 'grilled_fish')).toBe(false);
    expect(matchRecipe({ fish_silver_minnow: 1, ing_salt: 1 })).toBe('grilled_fish');
  });
});

describe('weather', () => {
  it('rolls sunny 60%, rain 30%, cloudy 10%', () => {
    expect(rollWeather(fixed(0.3))).toBe('sunny');
    expect(rollWeather(fixed(0.7))).toBe('rain');
    expect(rollWeather(fixed(0.95))).toBe('cloudy');
    const rng = createRng(1);
    const counts = { sunny: 0, rain: 0, cloudy: 0 };
    for (let i = 0; i < 3000; i += 1) counts[rollWeather(rng)] += 1;
    expect(counts.sunny / 3000).toBeCloseTo(0.6, 1);
    expect(counts.rain / 3000).toBeCloseTo(0.3, 1);
  });

  it('gives the same weather for the same save and day', () => {
    expect(weatherFor(42, 5)).toBe(weatherFor(42, 5));
  });

  it('waters every tilled plot when it rains in the morning', () => {
    const farm = { plots: [{ tilled: true, watered: false, crop: null }, { tilled: false, watered: false, crop: null }] };
    expect(rainOnFarm(farm).plots.map((plot) => plot.watered)).toEqual([true, false]);
    const rainy = world({ seed: 2, farm });
    const morning = sleep(rainy);
    expect(morning.weather).toBe('rain');
    expect(morning.farm.plots[0]!.watered).toBe(true);
  });
});

describe('bath and saves', () => {
  it('gives cleanliness 60 for a full bath and part of it when cut short', () => {
    const dirty = world({ gauges: { fullness: 80, happiness: 80, cleanliness: 20, homesickness: 0 } });
    expect(balance.bath.minutes).toBe(15);
    expect(finishBath(dirty, 15).gauges.cleanliness).toBe(80);
    expect(finishBath(dirty, 7.5).gauges.cleanliness).toBe(50);
    expect(finishBath(world(), 15).gauges.cleanliness).toBe(100);
  });

  it('turns a version 5 save into version 6 with fishing, weather and the starter bait', () => {
    const old = world();
    const { seed: _seed, weather: _weather, fishing: _fishing, chests: _chests, toys: _toys, stash: _stash, ...rest } = old;
    const v5 = {
      version: 5,
      savedAt: '2026-11-03T00:00:00.000Z',
      world: {
        ...rest,
        bag: [{ item: 'ing_egg', count: 2 }],
        cosmetics: { ...old.cosmetics, owned: { cases: ['case_pink_cat'], charms: [], wallpapers: ['wallpaper_sky_cats'], canSkins: ['can_blue'] } },
      },
    };
    const parsed = parseSaveFile(v5);
    expect(SAVE_VERSION).toBe(8);
    expect(parsed?.version).toBe(8);
    expect(parsed?.world.weather).toBe('sunny');
    expect(parsed?.world.fishing).toEqual({ rods: ['bamboo'], caught: {} });
    expect(parsed?.world.cosmetics.owned.clips).toEqual([]);
    expect(countOf(parsed!.world.bag, 'ing_egg')).toBe(2);
    expect(countOf(parsed!.world.bag, 'bait_corn')).toBe(5);
  });
});

describe('auto-fish and the bait strip (her decision 4 Nov 2026)', () => {
  it('waits 1.5 times longer and catches about 65% of bites', () => {
    expect(balance.fishing.autoWaitMultiplier).toBe(1.5);
    expect(balance.fishing.autoCatchChance).toBe(0.65);
  });

  it('really hooks about 65% of bites over many tries', () => {
    for (const seed of [1, 42, Date.now()]) {
      const rng = createRng(seed);
      let hooked = 0;
      for (let i = 0; i < 20000; i += 1) if (autoHooks(rng)) hooked += 1;
      expect(hooked / 20000).toBeGreaterThan(0.62);
      expect(hooked / 20000).toBeLessThan(0.68);
    }
  });

  it('uses the chosen bait while it lasts, then the first bait still in the bag', () => {
    const bag = [
      { item: 'bait_corn', count: 0 },
      { item: 'bait_cloud_lettuce', count: 2 },
    ].filter((stack) => stack.count > 0);
    expect(chosenBait(bag, 'cloud_lettuce')).toBe('cloud_lettuce');
    expect(chosenBait(bag, 'corn')).toBe('cloud_lettuce');
    expect(chosenBait(bag, null)).toBe('cloud_lettuce');
    expect(chosenBait([], 'corn')).toBeNull();
  });
});
