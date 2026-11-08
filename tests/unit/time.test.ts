import { describe, expect, it } from 'vitest';
import { defaultCosmetics, type World } from '../../src/core/state';
import { newWorld } from '../../src/systems/gauges';
import { newGioCare } from '../../src/systems/gio';
import { faint, sleep, stepClock } from '../../src/systems/time';

const HOUR_MS = 45_000;
const world = (changes: Partial<World> = {}): World => ({ ...newWorld(), ...changes });

describe('clock', () => {
  it('starts on day 1 at 06:00 with the agreed gauges', () => {
    expect(newWorld()).toEqual({
      day: 1,
      hour: 6,
      gauges: { fullness: 100, happiness: 100, cleanliness: 100, homesickness: 0 },
      player: null,
      wallet: { coins: 0, stars: 0, log: [], daily: [] },
      farm: newWorld().farm,
      bag: newWorld().bag,
      cooking: { slot: null },
      recipes: newWorld().recipes,
      cosmetics: defaultCosmetics(),
      seed: expect.any(Number),
      weather: 'sunny',
      fishing: { rods: ['bamboo'], caught: {} },
      chests: { sinceCosmetic: 0 },
      toys: [],
      stash: {},
      gio: newGioCare(),
      land: { owned: 0 },
      // งานประดิษฐ์: ยังไม่เคยเขย่าต้นกล้วย มีลอบเก่าที่ท่าน้ำ 1 อัน (งานอาหารโซน 1 ขั้นที่ 4)
      crafting: { bananaDay: 0, noticed: [], stations: { drying_tray: 0, trap: 1 }, drying: [], traps: [], mortar: false },
      placed: {},
      tray: { level: 0, plates: [null, null, null] },
      monsters: { affection: {}, plannedDay: 0, arrivals: [], twins: { revealed: false, revealDay: 0, quizWon: false }, tasted: {} },
    });
  });

  it('runs one game hour in 45 real seconds and lowers fullness 4 and cleanliness 1', () => {
    const { world: next, cause } = stepClock(world(), HOUR_MS);
    expect(cause).toBeNull();
    expect(next.hour).toBeCloseTo(7);
    expect(next.gauges.fullness).toBeCloseTo(96);
    expect(next.gauges.cleanliness).toBeCloseTo(99);
    expect(next.gauges.happiness).toBe(100);
  });

  it('makes a full day last 15 real minutes', () => {
    expect(((26 - 6) * HOUR_MS) / 60_000).toBe(15);
  });

  it('passes out at 02:00 and wakes at 06:00 next day without the sleep bonus', () => {
    const { world: next, cause } = stepClock(world({ hour: 25.99, gauges: { fullness: 50, happiness: 60, cleanliness: 50, homesickness: 0 } }), HOUR_MS);
    expect(cause).toBe('passed_out');
    expect(next.day).toBe(2);
    expect(next.hour).toBe(6);
    expect(next.gauges.happiness).toBeCloseTo(59.8);
  });
});

describe('sleep', () => {
  it('sleeping at 22:00 costs 8 hours of sleep rates and gives happiness 20', () => {
    const next = sleep(world({ hour: 22, gauges: { fullness: 40, happiness: 50, cleanliness: 60, homesickness: 10 } }));
    expect(next.day).toBe(2);
    expect(next.hour).toBe(6);
    expect(next.gauges.fullness).toBeCloseTo(32);
    expect(next.gauges.cleanliness).toBeCloseTo(52);
    expect(next.gauges.homesickness).toBeCloseTo(11);
    expect(next.gauges.happiness).toBeCloseTo(50 + 20 - 11 / 5);
  });

  it('never goes past the 0-100 range', () => {
    const next = sleep(world({ hour: 6, gauges: { fullness: 5, happiness: 100, cleanliness: 5, homesickness: 0 } }));
    expect(next.gauges.fullness).toBe(0);
    expect(next.gauges.cleanliness).toBe(0);
    expect(next.gauges.happiness).toBeLessThanOrEqual(100);
  });
});

describe('fainting', () => {
  it('faints when fullness reaches 0, skips 10 hours and recovers that gauge to 30', () => {
    const { world: next, cause } = stepClock(world({ hour: 10, gauges: { fullness: 1, happiness: 80, cleanliness: 80, homesickness: 0 } }), HOUR_MS);
    expect(cause).toBe('faint');
    expect(next.day).toBe(1);
    expect(next.hour).toBeCloseTo(21);
    expect(next.gauges.fullness).toBe(30);
    expect(next.gauges.happiness).toBe(80);
  });

  it('also faints when happiness reaches 0', () => {
    const { cause } = stepClock(world({ gauges: { fullness: 80, happiness: 0, cleanliness: 80, homesickness: 0 } }), 1);
    expect(cause).toBe('faint');
  });

  it('wakes at 06:00 next day when the skip goes past 02:00', () => {
    const next = faint(world({ hour: 20, gauges: { fullness: 0, happiness: 80, cleanliness: 80, homesickness: 0 } }));
    expect(next.day).toBe(2);
    expect(next.hour).toBe(6);
    expect(next.gauges.fullness).toBe(30);
  });

  it('faints around 10:00-13:00 on day 2 with no food, as planned until M4', () => {
    let current = sleep(world({ hour: 22, gauges: { fullness: 36, happiness: 100, cleanliness: 84, homesickness: 0 } }));
    let cause = null;
    while (!cause) ({ world: current, cause } = stepClock(current, HOUR_MS / 10));
    expect(cause).toBe('faint');
    expect(current.hour - 10).toBeGreaterThanOrEqual(10);
    expect(current.hour - 10).toBeLessThanOrEqual(13.2);
  });
});
