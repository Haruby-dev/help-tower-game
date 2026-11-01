import { describe, expect, it } from 'vitest';
import { emptyWallet } from '../../src/core/state';
import { applyTransaction, entriesFor, netFor } from '../../src/systems/economy';
import { newWorld } from '../../src/systems/gauges';
import { beadFills, isAlert, isDirty, isPulsing, moodOf } from '../../src/systems/mood';
import { SAVE_VERSION, parseSaveFile } from '../../src/systems/save';

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
    expect(SAVE_VERSION).toBe(2);
    expect(parsed?.version).toBe(SAVE_VERSION);
    expect(parsed?.world.day).toBe(3);
    expect(parsed?.world.wallet).toEqual(emptyWallet());
  });
});
