import { describe, expect, it } from 'vitest';
import { defaultCosmetics, emptyWallet } from '../../src/core/state';
import { applyTransaction, entriesFor, netFor } from '../../src/systems/economy';
import { newWorld } from '../../src/systems/gauges';
import { beadFills, isAlert, isDirty, isPulsing, moodOf } from '../../src/systems/mood';
import { dayOfMonth, encouragementFor, monthOf, stuckTime, weekStrip, weekdayIndex } from '../../src/systems/phoneCalendar';
import { COIN_SCALE, SAVE_VERSION, parseSaveFile } from '../../src/systems/save';
import { uiZoomFor } from '../../src/core/viewport';
import display from '../../src/data/display.json';
import lines from '../../src/data/lines.json';

const gauges = (fullness: number, happiness: number, cleanliness = 100) => ({
  fullness,
  happiness,
  cleanliness,
  homesickness: 0,
});

describe('portrait mood', () => {
  it.each([
    [100, 100, 'happy'],
    [70, 90, 'happy'],
    [69.9, 90, 'normal'],
    [40, 90, 'normal'],
    [39.9, 90, 'tired'],
    [15, 90, 'tired'],
    [14.9, 90, 'faint'],
    [90, 14.9, 'faint'],
  ])('fullness %f and happiness %f show %s', (fullness, happiness, mood) => {
    expect(moodOf(gauges(fullness, happiness))).toBe(mood);
  });

  it('ignores cleanliness, which shows stink lines instead below 30', () => {
    expect(moodOf(gauges(100, 100, 0))).toBe('happy');
    expect(isDirty(29.9)).toBe(true);
    expect(isDirty(30)).toBe(false);
  });
});

describe('beads', () => {
  it('has 5 beads of 20% each, with half fills', () => {
    expect(beadFills(100)).toEqual([1, 1, 1, 1, 1]);
    expect(beadFills(50)).toEqual([1, 1, 0.5, 0, 0]);
    expect(beadFills(19)).toEqual([0.5, 0, 0, 0, 0]);
    expect(beadFills(1)).toEqual([0.5, 0, 0, 0, 0]);
    expect(beadFills(0)).toEqual([0, 0, 0, 0, 0]);
  });

  it('breathes at 30% or less, and turns red at 15% or less', () => {
    expect(isPulsing(30.1)).toBe(false);
    expect(isPulsing(30)).toBe(true);
    expect(isPulsing(15.1)).toBe(true);
    expect(isPulsing(15)).toBe(false);
    expect(isAlert(15)).toBe(true);
    expect(isAlert(15.1)).toBe(false);
  });
});

describe('wallet', () => {
  it('writes a log entry for every money change', () => {
    let world = newWorld();
    world = applyTransaction(world, 'coins', 100, 'wallet.test_income', 'wallet.category_test');
    world = applyTransaction(world, 'coins', -30, 'wallet.test_income', 'wallet.category_test');
    world = applyTransaction(world, 'stars', 5, 'wallet.test_income', 'wallet.category_test');
    expect(world.wallet.coins).toBe(70);
    expect(world.wallet.stars).toBe(5);
    expect(world.wallet.log).toHaveLength(3);
    expect(world.wallet.log[0]?.currency).toBe('stars');
    expect(netFor(world.wallet, world.day, 'today', 'coins')).toBe(70);
  });

  it('keeps only the last 200 entries but the totals stay right', () => {
    let world = newWorld();
    for (let index = 0; index < 205; index += 1) {
      world = applyTransaction(world, 'coins', 1, 'wallet.test_income', 'wallet.category_test');
    }
    expect(world.wallet.log).toHaveLength(200);
    expect(world.wallet.coins).toBe(205);
    expect(netFor(world.wallet, world.day, 'all', 'coins')).toBe(205);
  });

  it('filters today, this week and all', () => {
    let world = { ...newWorld(), day: 1 };
    world = applyTransaction(world, 'coins', 10, 'wallet.test_income', 'wallet.category_test');
    world = applyTransaction({ ...world, day: 9 }, 'coins', 20, 'wallet.test_income', 'wallet.category_test');
    world = applyTransaction({ ...world, day: 10 }, 'coins', 40, 'wallet.test_income', 'wallet.category_test');
    expect(entriesFor(world.wallet, 10, 'today')).toHaveLength(1);
    expect(entriesFor(world.wallet, 10, 'week')).toHaveLength(2);
    expect(entriesFor(world.wallet, 10, 'all')).toHaveLength(3);
    expect(netFor(world.wallet, 10, 'week', 'coins')).toBe(60);
  });
});

describe('save migration', () => {
  it('turns a version 1 save into the current version with an empty wallet', () => {
    const old = {
      version: 1,
      savedAt: '2026-11-01T00:00:00.000Z',
      world: { day: 3, hour: 6, gauges: gauges(50, 60, 70), player: { x: 1, y: 2 } },
    };
    const parsed = parseSaveFile(old);
    expect(SAVE_VERSION).toBe(25);
    expect(parsed?.version).toBe(SAVE_VERSION);
    expect(parsed?.world.day).toBe(3);
    expect(parsed?.world.wallet).toEqual(emptyWallet());
    expect(parsed?.world.cosmetics).toEqual(defaultCosmetics());
  });

  it('turns a version 2 save into the current version and keeps the money', () => {
    const wallet = { ...emptyWallet(), coins: 50 };
    const parsed = parseSaveFile({
      version: 2,
      savedAt: '2026-11-02T00:00:00.000Z',
      world: { day: 2, hour: 6, gauges: gauges(50, 60, 70), player: null, wallet },
    });
    expect(parsed?.version).toBe(SAVE_VERSION);
    // เซฟก่อนเวอร์ชัน 8 เหรียญถูกคูณ 10 ตอนแปลง อำนาจซื้อเท่าเดิม
    expect(parsed?.world.wallet.coins).toBe(500);
    // เวอร์ชัน 16 ทิ้งช่องเคสโทรศัพท์
    expect(parsed?.world.cosmetics).toEqual(defaultCosmetics());
  });
});

describe('phone calendar', () => {
  it('makes day 1 a Saturday and day 5 a Wednesday', () => {
    expect(weekdayIndex(1)).toBe(5);
    expect(weekdayIndex(5)).toBe(2);
    expect(weekStrip(5)).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it('uses 28-day months', () => {
    expect(monthOf(28)).toBe(1);
    expect(monthOf(29)).toBe(2);
    expect(dayOfMonth(29)).toBe(1);
  });

  it('counts the time stuck in the tower since the first morning', () => {
    expect(stuckTime(1, 6)).toEqual({ months: 0, days: 0, hours: 0 });
    expect(stuckTime(6, 12)).toEqual({ months: 0, days: 5, hours: 6 });
    expect(stuckTime(29, 6)).toEqual({ months: 1, days: 0, hours: 0 });
  });

  it('picks the same line all day, from the list in lines.json', () => {
    expect(encouragementFor(7)).toBe(encouragementFor(7));
    expect(lines.encouragement).toContain(encouragementFor(7));
    expect(lines.encouragement).toHaveLength(10);
    const seen = new Set(Array.from({ length: 60 }, (_, index) => encouragementFor(index + 1)));
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe('UI zoom', () => {
  const viewport = (zoom: number, canvasWidth: number, canvasHeight: number) => ({
    zoom,
    canvasWidth,
    canvasHeight,
    styleWidth: 0,
    styleHeight: 0,
  });

  it('follows the world zoom until the phone would not fit', () => {
    expect(uiZoomFor(viewport(4, 2442, 1140), display.uiDesign)).toBe(4);
    expect(uiZoomFor(viewport(5, 2442, 1140), display.uiDesign)).toBe(4);
    expect(uiZoomFor(viewport(1, 640, 360), display.uiDesign)).toBe(1);
  });
});

describe('coins ×10 (her decision 4 Nov 2026)', () => {
  const v7 = () => {
    let world = newWorld();
    world = applyTransaction(world, 'coins', 120, 'wallet.test_income', 'wallet.category_test');
    world = applyTransaction(world, 'coins', -30, 'wallet.test_income', 'wallet.category_test');
    world = applyTransaction(world, 'stars', 4, 'wallet.test_income', 'wallet.category_test');
    return { version: 7, savedAt: '2026-11-04T00:00:00.000Z', world };
  };

  it('multiplies an old save\'s coins, coin log and daily coin totals by 10, and leaves sugar stars alone', () => {
    const parsed = parseSaveFile(v7())!;
    expect(COIN_SCALE).toBe(10);
    expect(parsed.version).toBe(SAVE_VERSION);
    expect(parsed.world.wallet.coins).toBe(900);
    expect(parsed.world.wallet.stars).toBe(4);
    expect(parsed.world.wallet.log.map((entry) => [entry.currency, entry.amount])).toEqual([
      ['stars', 4],
      ['coins', -300],
      ['coins', 1200],
    ]);
    expect(parsed.world.wallet.daily[0]).toMatchObject({ coins: 900, stars: 4 });
  });

  it('does it exactly once: loading the converted save again keeps the same coins', () => {
    const once = parseSaveFile(v7())!;
    const twice = parseSaveFile(JSON.parse(JSON.stringify(once)))!;
    expect(twice.world.wallet).toEqual(once.world.wallet);
    expect(twice.world.wallet.coins).toBe(900);
  });
});
