import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import type { World } from '../../src/core/state';
import balance from '../../src/data/balance.json';
import monsters from '../../src/data/monsters.json';
import { dishItem } from '../../src/systems/cooking';
import { countOf } from '../../src/systems/farm';
import { newWorld } from '../../src/systems/gauges';
import {
  affectionPercent,
  cleanMultiplier,
  dishPoints,
  dueArrivals,
  eatPlaceFor,
  eligibleMonsters,
  feed,
  isCleared,
  newVisitMemo,
  planVisit,
  planVisits,
  settleVisits,
  summonNow,
  takePlate,
  tasteOf,
  tierOf,
  visitorCount,
  wantsSignature,
} from '../../src/systems/monsters';
import { sleep, stepClock } from '../../src/systems/time';
import { putOnTray, takeBackFromTray } from '../../src/systems/tray';

const rules = balance.monsters;
const PUINUN = 'puinun';
/** สะอาดปานกลาง ตัวคูณความสะอาด ×1 จะได้เทียบตัวเลขง่าย */
const plain = (): World => ({ ...newWorld(), gauges: { ...newWorld().gauges, cleanliness: 50 } });
const withPoints = (world: World, points: number, signature = false): World => ({
  ...world,
  monsters: { ...world.monsters, affection: { ...world.monsters.affection, [PUINUN]: { points, signature } } },
});
const withTray = (world: World, plates: ({ item: string; count: number } | null)[]): World => ({ ...world, tray: { level: 0, plates } });
const fixed = (value: number) => ({ next: () => value, between: (min: number, max: number) => min + value * (max - min) });

describe('monster data (GDD stage 3)', () => {
  it('has floors 1–10 with the GDD points (twins 36 each) and Puinun likes strawberry tanghulu most', () => {
    expect(Object.values(monsters).map((monster) => monster.points)).toEqual([30, 32, 33, 35, 36, 36, 38, 40, 42, 44, 47]);
    expect(monsters.puinun.favourite).toEqual(['strawberry_skewer']);
    expect(monsters.puinun.signature).toEqual({ recipe: 'baked_potato', stars: 1 });
    expect(monsters.puefaotung.signature).toEqual({ recipe: 'strawberry_skewer', stars: 3 });
  });

  it('reads tastes: favourite, like, neutral, dislike', () => {
    expect(tasteOf(PUINUN, 'strawberry_skewer')).toBe('favourite');
    expect(tasteOf(PUINUN, 'warm_honey_milk')).toBe('like');
    expect(tasteOf(PUINUN, 'boiled_egg')).toBe('neutral');
    expect(tasteOf(PUINUN, 'grilled_fish')).toBe('dislike');
  });
});

describe('affection formula', () => {
  it('= rank base × taste × variety × stars × cleanliness', () => {
    const base = rules.rankBase.F;
    expect(dishPoints(PUINUN, 'boiled_egg', 1, 0, 50)).toBeCloseTo(base);
    expect(dishPoints(PUINUN, 'strawberry_skewer', 1, 0, 50)).toBeCloseTo(base * 3);
    expect(dishPoints(PUINUN, 'grilled_corn', 2, 0, 50)).toBeCloseTo(base * 1.5 * 1.2);
    expect(dishPoints(PUINUN, 'strawberry_skewer', 3, 1, 50)).toBeCloseTo(base * 3 * 0.6 * 1.5);
    expect(dishPoints(PUINUN, 'strawberry_skewer', 1, 4, 50)).toBeCloseTo(base * 3 * 0.3);
    expect(dishPoints(PUINUN, 'grilled_fish', 3, 0, 100)).toBe(0);
  });

  it('gives drinks a smaller base than food', () => {
    expect(dishPoints(PUINUN, 'warm_honey_milk', 1, 0, 50)).toBeCloseTo(rules.rankBase.E * rules.drinkBaseShare * 1.5);
  });

  it('uses ×1.1 when clean (70+) and ×0.8 when dirty (30 or less)', () => {
    expect(cleanMultiplier(70)).toBe(1.1);
    expect(cleanMultiplier(69)).toBe(1);
    expect(cleanMultiplier(31)).toBe(1);
    expect(cleanMultiplier(30)).toBe(0.8);
  });

  it('stops at 90% until the signature dish, which then clears the floor and pays sugar stars', () => {
    const almost = withPoints(plain(), 26);
    const capped = feed(almost, PUINUN, dishItem('strawberry_skewer', 3), 0).world;
    expect(affectionPercent(capped, PUINUN)).toBeCloseTo(90);
    expect(wantsSignature(capped, PUINUN)).toBe(true);
    expect(isCleared(capped, PUINUN)).toBe(false);
    const done = feed(capped, PUINUN, dishItem('baked_potato', 1), 0);
    expect(done.cleared).toBe(true);
    expect(affectionPercent(done.world, PUINUN)).toBe(100);
    expect(done.world.wallet.stars).toBe(rules.clearStars);
    expect(done.world.wallet.log[0]?.label).toBe('wallet.monster_clear');
    // ครบแล้วกินต่อก็ไม่เพิ่ม
    expect(feed(done.world, PUINUN, dishItem('strawberry_skewer', 1), 0).points).toBe(0);
  });

  it('treats the signature dish as a normal dish before 90%', () => {
    const fed = feed(plain(), PUINUN, dishItem('baked_potato', 1), 0);
    expect(fed.cleared).toBe(false);
    expect(fed.points).toBeCloseTo(rules.rankBase.F);
  });

  it('picks the speech tier from affection', () => {
    expect(tierOf(plain(), PUINUN)).toBe('hungry');
    expect(tierOf(withPoints(plain(), 30 * 0.5), PUINUN)).toBe('warm');
    expect(tierOf(withPoints(plain(), 30 * 0.85), PUINUN)).toBe('close');
  });
});

describe('visitors', () => {
  it('= 1 + sold ÷ 4 (rounded down), at most 6', () => {
    expect(visitorCount(0)).toBe(1);
    expect(visitorCount(7)).toBe(2);
    expect(visitorCount(8)).toBe(3);
    expect(visitorCount(100)).toBe(6);
  });

  it('only comes from monsters with art that are not cleared yet, floor 5 counts once (the twins)', () => {
    const zone1 = [PUINUN, 'popcorn', 'mookmik', 'toomtia', 'tangkrading', 'yaibaimai', 'wingwing', 'tubpong', 'jaotungtong', 'puefaotung'];
    expect(eligibleMonsters(newWorld())).toEqual(zone1);
    expect(eligibleMonsters(withPoints(newWorld(), 30, true))).toEqual(zone1.slice(1));
  });

  it('plans tomorrow\'s visit when Gio comes back, once, spread between 12:00 and 20:00', () => {
    const report = { day: 3, sold: [{ item: 'produce_tomato', count: 9 }], returned: [], gross: 0, commission: 0, coins: 0, gift: null, tier: 0 };
    const world: World = { ...newWorld(), day: 3, hour: 18, gio: { ...newWorld().gio, report } };
    const planned = planVisits(world);
    expect(planned.monsters.plannedDay).toBe(4);
    // ขาย 9 ชิ้นได้ 3 ตัว ต่างตัวกัน
    const arrivals = planned.monsters.arrivals;
    expect(arrivals).toHaveLength(3);
    expect(new Set(arrivals.map((arrival) => arrival.monster)).size).toBe(3);
    for (const arrival of arrivals) {
      expect(arrival).toMatchObject({ day: 4, done: false });
      expect(arrival.hour).toBeGreaterThanOrEqual(12);
      expect(arrival.hour).toBeLessThan(20);
    }
    expect(planVisits(planned)).toBe(planned);
    expect(dueArrivals(planned)).toEqual([]);
    expect(dueArrivals({ ...planned, day: 4, hour: 20 })).toHaveLength(3);
  });

  it('runs the plan from the clock when Gio\'s summary is created', () => {
    const report = { day: 1, sold: [], returned: [], gross: 0, commission: 0, coins: 0, gift: null, tier: 0 };
    const world: World = { ...newWorld(), gio: { ...newWorld().gio, report } };
    expect(stepClock(world, 1).world.monsters.plannedDay).toBe(2);
  });

  it('summons a monster now for testing', () => {
    const summoned = summonNow({ ...newWorld(), hour: 9 })!;
    expect(dueArrivals(summoned)).toEqual([{ monster: PUINUN, day: 1, hour: 9, done: false }]);
    const allCleared: World = {
      ...newWorld(),
      monsters: {
        ...newWorld().monsters,
        affection: Object.fromEntries(Object.entries(monsters).map(([id, monster]) => [id, { points: monster.points, signature: true }])),
        twins: { revealed: true, revealDay: 1, quizWon: true },
      },
    };
    expect(summonNow(allCleared)).toBeNull();
  });
});

describe('tray and taking', () => {
  it('puts dishes from the bag on plates, one menu per plate, the same menu stacks', () => {
    const world: World = { ...newWorld(), bag: [{ item: dishItem('strawberry_skewer', 1), count: 5 }, { item: dishItem('boiled_egg', 1), count: 1 }] };
    let next = putOnTray(world, dishItem('strawberry_skewer', 1), 2)!;
    next = putOnTray(next, dishItem('strawberry_skewer', 1), 1)!;
    next = putOnTray(next, dishItem('boiled_egg', 1), 1)!;
    expect(next.tray.plates).toEqual([{ item: 'dish_strawberry_skewer_1', count: 3 }, { item: 'dish_boiled_egg_1', count: 1 }, null]);
    expect(countOf(next.bag, dishItem('strawberry_skewer', 1))).toBe(2);
    expect(putOnTray(next, 'produce_tomato', 1)).toBeNull();
    const back = takeBackFromTray(next, 0, 2)!;
    expect(back.tray.plates[0]).toEqual({ item: 'dish_strawberry_skewer_1', count: 1 });
    expect(countOf(back.bag, dishItem('strawberry_skewer', 1))).toBe(4);
  });

  it('takes a favourite tower of 3–5 first, skips disliked plates, and never more than 5', () => {
    const world = withTray(plain(), [
      { item: dishItem('grilled_fish', 1), count: 4 },
      { item: dishItem('boiled_egg', 1), count: 4 },
      { item: dishItem('strawberry_skewer', 1), count: 9 },
    ]);
    for (const roll of [0, 0.5, 0.99]) {
      const plan = planVisit(world, PUINUN, fixed(roll));
      expect(plan.pouts).toEqual([0]);
      const tower = plan.takes.find((take) => take.reaction === 'favourite')!;
      expect(tower.count).toBeGreaterThanOrEqual(3);
      expect(tower.count).toBeLessThanOrEqual(5);
      expect(plan.takes.reduce((sum, take) => sum + take.count, 0)).toBeLessThanOrEqual(5);
      expect(plan.takes.every((take) => take.plate !== 0)).toBe(true);
    }
  });

  it('takes 1 of each liked plate before neutral ones', () => {
    const world = withTray(plain(), [
      { item: dishItem('boiled_egg', 1), count: 3 },
      { item: dishItem('grilled_corn', 1), count: 3 },
      null,
    ]);
    const plan = planVisit(world, PUINUN, fixed(0));
    expect(plan.takes).toEqual([{ plate: 1, item: 'dish_grilled_corn_1', count: 1, reaction: 'like' }]);
  });

  it('asks for the signature dish at 90% and takes it first when it is on the tray', () => {
    const asking = withPoints(plain(), 27);
    expect(planVisit(withTray(asking, [{ item: dishItem('boiled_egg', 1), count: 1 }, null, null]), PUINUN, fixed(0)).asks).toBe('baked_potato');
    const plan = planVisit(withTray(asking, [{ item: dishItem('boiled_egg', 1), count: 1 }, { item: dishItem('baked_potato', 1), count: 2 }, null]), PUINUN, fixed(0));
    expect(plan.asks).toBeNull();
    expect(plan.takes[0]).toEqual({ plate: 1, item: 'dish_baked_potato_1', count: 1, reaction: 'signature' });
  });

  it('removes what it takes from the plate and credits affection per serving with variety', () => {
    const world = withTray(plain(), [{ item: dishItem('strawberry_skewer', 1), count: 3 }, null, null]);
    const memo = newVisitMemo();
    const result = takePlate(world, PUINUN, { plate: 0, item: dishItem('strawberry_skewer', 1), count: 3, reaction: 'favourite' }, memo);
    expect(result.taken).toBe(3);
    expect(result.world.tray.plates[0]).toBeNull();
    const base = rules.rankBase.F * 3;
    expect(result.gains.map((gain) => Number(gain.toFixed(4)))).toEqual([base, base * 0.6, base * 0.3].map((gain) => Number(gain.toFixed(4))));
    expect(memo.eaten.strawberry_skewer).toBe(3);
  });

  it('gives the set bonus once when the favourite food and favourite drink are both eaten in one visit', () => {
    const world = withTray(plain(), [{ item: dishItem('strawberry_skewer', 1), count: 3 }, { item: dishItem('strawberry_juice', 1), count: 3 }, null]);
    const plan = planVisit(world, PUINUN, fixed(0.99));
    // หอคอยอาหารเว้นที่ให้น้ำ 1 แก้ว
    expect(plan.takes.map((take) => [take.plate, take.count])).toEqual([[0, 3], [1, 1]]);
    const memo = newVisitMemo();
    const food = takePlate(world, PUINUN, plan.takes[0]!, memo);
    expect(food.setBonus).toBe(0);
    const drink = takePlate(food.world, PUINUN, plan.takes[1]!, memo);
    const firstFood = food.gains[0]!;
    const juice = drink.gains[0]!;
    expect(drink.set).toBe(true);
    expect(drink.setBonus).toBeCloseTo((rules.setBonus - 1) * (firstFood + juice));
    expect(takePlate(drink.world, PUINUN, { plate: 1, item: dishItem('strawberry_juice', 1), count: 1, reaction: 'favourite' }, memo).setBonus).toBe(0);
  });

  it('counts the favourite drink as a favourite (×3, drink base)', () => {
    expect(tasteOf(PUINUN, 'strawberry_juice')).toBe('favourite');
    expect(dishPoints(PUINUN, 'strawberry_juice', 1, 0, 50)).toBeCloseTo(rules.rankBase.F * rules.drinkBaseShare * 3);
  });

  it('eats by affection: grabs and runs home when wary, near the burrow when warm, in the front yard when close', () => {
    expect(eatPlaceFor(plain(), PUINUN)).toBe('burrow');
    expect(eatPlaceFor(withPoints(plain(), 30 * 0.5), PUINUN)).toBe('nearBurrow');
    expect(eatPlaceFor(withPoints(plain(), 30 * 0.85), PUINUN)).toBe('yard');
  });

  it('lets a monster that missed its visit (slept, fainted) eat from the tray without being seen', () => {
    const report = { day: 1, sold: [], returned: [], gross: 0, commission: 0, coins: 0, gift: null, tier: 0 };
    const start: World = withTray({ ...plain(), hour: 10, gio: { ...newWorld().gio, report } }, [{ item: dishItem('strawberry_skewer', 1), count: 4 }, null, null]);
    // มอนสเตอร์มาได้ 10 ตัวแล้ว ให้แขกเป็นปุยนุ่น (ชอบถังหูลู่ที่สุด) จะได้รู้แน่ว่ากินจากถาด
    const plannedAny = planVisits(start);
    const planned: World = { ...plannedAny, monsters: { ...plannedAny.monsters, arrivals: plannedAny.monsters.arrivals.map((arrival) => ({ ...arrival, monster: PUINUN })) } };
    const guest = PUINUN;
    const visitDay: World = { ...planned, day: 2, hour: 10 };
    const next = sleep(visitDay);
    expect(next.day).toBe(3);
    expect(next.monsters.arrivals).toEqual([]);
    expect(next.monsters.affection[guest]!.points).toBeGreaterThan(0);
    expect(next.tray.plates[0]?.count ?? 0).toBeLessThan(4);
    expect(settleVisits(next)).toBe(next);
  });

  it('reaches 100% for Puinun in roughly 15 dishes as the GDD expects', () => {
    // ผสมเมนูโปรด ชอบ และเฉย ๆ แบบผู้เล่นทั่วไป สะอาดปานกลาง (ตัวเลขฐานแรงก์เป็นค่าชั่วคราว)
    let world = plain();
    let dishes = 0;
    const menu = ['strawberry_skewer', 'grilled_corn', 'boiled_egg', 'strawberry_skewer', 'warm_honey_milk'];
    while (!wantsSignature(world, PUINUN) && dishes < 100) {
      world = feed(world, PUINUN, dishItem(menu[dishes % menu.length]!, 1), Math.floor(dishes / menu.length) % 2).world;
      dishes += 1;
    }
    expect(dishes).toBeGreaterThan(5);
    expect(dishes).toBeLessThan(25);
    expect(createRng(1)).toBeTruthy();
  });
});
