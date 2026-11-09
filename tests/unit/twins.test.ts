import { describe, expect, it } from 'vitest';
import type { World } from '../../src/core/state';
import balance from '../../src/data/balance.json';
import monsters from '../../src/data/monsters.json';
import { dishItem } from '../../src/systems/cooking';
import { decorHappiness, decorMorning } from '../../src/systems/decor';
import { newWorld } from '../../src/systems/gauges';
import {
  arrivalsFor,
  barOwner,
  eligibleMonsters,
  feed,
  finishTwinScene,
  isCleared,
  nameKey,
  revealDue,
  scheduleReveal,
  settleVisits,
  twinArrival,
  voiceOf,
  wantsSignature,
} from '../../src/systems/monsters';
import { gainTips, nextTips, tipText } from '../../src/systems/news';
import { SAVE_VERSION, parseSaveFile, toSaveFile } from '../../src/systems/save';

const A = 'tangkrading';
const B = 'tangkrading_b';
const rules = balance.monsters;
const fixed = (value: number) => ({ next: () => value, between: (min: number, max: number) => min + value * (max - min) });
const plain = (): World => ({ ...newWorld(), gauges: { ...newWorld().gauges, cleanliness: 50 } });
const withAffection = (world: World, id: string, points: number, signature = false): World => ({
  ...world,
  monsters: { ...world.monsters, affection: { ...world.monsters.affection, [id]: { points, signature } } },
});
const cleared = (world: World, id: string): World => withAffection(world, id, monsters[id as keyof typeof monsters].points, true);
const twins = (world: World, revealed: boolean, quizWon: boolean, revealDay = 1): World => ({ ...world, monsters: { ...world.monsters, twins: { revealed, revealDay, quizWon } } });

describe('twins on floor 5 (GDD "แฝดขี้แกล้ง")', () => {
  it('twin B has its own tastes (GDD 7 Nov), 36 points each, signature grilled corn 3 stars', () => {
    const b = monsters.tangkrading_b;
    expect(b).toMatchObject({ floor: 5, points: 36, twinOf: A, favourite: ['grilled_corn'], favouriteDrink: 'warm_honey_milk', dislikes: ['grilled_fish'] });
    expect(b.likes).toEqual(['garlic_shrimp', 'squid_salad']);
    expect(b.favouriteTopping).toBe('blueberry');
    expect(monsters.tangkrading.favouriteTopping).toBe('chili_flakes');
    expect(b.signature).toEqual({ recipe: 'grilled_corn', stars: 3 });
    expect(monsters.tangkrading).toMatchObject({ points: 36, favourite: ['grilled_fish'], favouriteDrink: 'tomato_juice', dislikes: ['grilled_corn'] });
    expect(voiceOf(B)).toBe(A);
  });

  it('floor 5 is picked once like any floor, then A or B 50/50, never both on one day before the reveal', () => {
    expect(eligibleMonsters(newWorld())).toContain(A);
    expect(eligibleMonsters(newWorld())).not.toContain(B);
    expect(twinArrival(newWorld(), fixed(0.3))).toEqual({ monster: A });
    expect(twinArrival(newWorld(), fixed(0.7))).toEqual({ monster: B });
    for (let day = 2; day < 40; day += 1) {
      const floor5 = arrivalsFor(newWorld(), day, rules.maxVisitors * 2).filter((arrival) => arrival.monster === A || arrival.monster === B);
      expect(floor5.length).toBeLessThanOrEqual(1);
    }
  });

  it('the bar shows A only; B eats in secret up to 90% and does not ask for its signature until the bar switches', () => {
    let world = withAffection(plain(), B, 35);
    expect(barOwner(world, B)).toBe(A);
    expect(nameKey(world, B)).toBe('monster.tangkrading.name');
    expect(wantsSignature(world, B)).toBe(false);
    world = feed(world, B, dishItem('grilled_corn', 3), 0).world;
    expect(world.monsters.affection[B]!.points).toBeCloseTo(36 * rules.signatureAt);
    expect(isCleared(world, B)).toBe(false);
    // พี่ครบ 100% หลอดสลับเป็นของน้อง น้องเริ่มขอเมนูประจำใจ
    world = cleared(world, A);
    expect(barOwner(world, A)).toBe(B);
    expect(barOwner(world, B)).toBe(B);
    expect(wantsSignature(world, B)).toBe(true);
    expect(feed(world, B, dishItem('grilled_corn', 2), 0).cleared).toBe(false);
    const done = feed(world, B, dishItem('grilled_corn', 3), 0).world;
    expect(isCleared(done, B)).toBe(true);
    expect(revealDue(done)).toBe(true);
  });

  it('after the switch B comes most days and A drops by 1 in 5 floor-5 visits to giggle and run', () => {
    const switched = cleared(newWorld(), A);
    expect(twinArrival(switched, fixed(rules.twins.teaseChance - 0.01))).toEqual({ monster: A, kind: 'tease' });
    expect(twinArrival(switched, fixed(rules.twins.teaseChance + 0.01))).toEqual({ monster: B });
  });

  it('B full → reveal scene (right after B goes home) → door opens; a wrong guess brings a quiz visit later, a right one gives the chime', () => {
    const full = { ...cleared(cleared(newWorld(), A), B), hour: 15 };
    expect(twinArrival(full, fixed(0.5))).toEqual({ monster: A, kind: 'reveal' });
    const scheduled = scheduleReveal(full);
    expect(scheduled.monsters.arrivals).toEqual([{ monster: A, day: 1, hour: 15, done: false, kind: 'reveal' }]);
    expect(scheduleReveal(scheduled)).toBe(scheduled);
    const wrong = finishTwinScene(full, 'reveal', false);
    expect(wrong.monsters.twins).toEqual({ revealed: true, revealDay: 1, quizWon: false });
    expect(eligibleMonsters(wrong)).toContain(A);
    expect(twinArrival(wrong, fixed(0.5))).toEqual({ monster: A, kind: 'quiz' });
    const right = finishTwinScene({ ...wrong, day: 4 }, 'quiz', true);
    expect(right.monsters.twins).toEqual({ revealed: true, revealDay: 1, quizWon: true });
    expect(eligibleMonsters(right)).not.toContain(A);
    expect(nameKey(right, A)).toBe('monster.tangkrading.name_revealed');
    expect(nameKey(right, B)).toBe('monster.tangkrading_b.name');
  });

  it('special twin visits that were not seen do not eat from the tray', () => {
    const tray = { level: 0, plates: [{ item: dishItem('grilled_fish', 1), count: 3 }, null, null] };
    const world: World = { ...plain(), hour: 22, tray, monsters: { ...plain().monsters, arrivals: [{ monster: A, day: 1, hour: 13, done: false, kind: 'tease' }] } };
    const next = settleVisits(world);
    expect(next.tray).toEqual(tray);
    expect(next.monsters.affection[A]).toBeUndefined();
  });

  it('Gio tells one confusing clue about the twins before the reveal and the big news the day after', () => {
    const met = withAffection(newWorld(), A, 3);
    const tips = nextTips(met, 99).filter((tip) => tip.monster === A).map((tip) => tip.kind);
    expect(tips).toEqual(['favourite', 'drink', 'twin_clue', 'signature']);
    const revealed = twins(cleared(cleared(newWorld(), A), B), true, false, 3);
    const report = { day: 4, sold: [], returned: [], gross: 0, commission: 0, coins: 0, gift: null, tier: 0 };
    const news = gainTips({ ...revealed, day: 4, gio: { ...revealed.gio, report } });
    const big = news.gio.tips.find((tip) => tip.kind === 'twin_reveal')!;
    expect(big).toMatchObject({ monster: A, day: 4, read: false });
    expect(tipText(big)).toContain('หางกระดิ่งมีสองตัว');
  });

  it('the wind chime adds +5 happiness every morning once won (her pick)', () => {
    expect(balance.decor.deco_bell_chime.dailyHappiness).toBe(5);
    const won = twins(newWorld(), true, true);
    expect(decorHappiness(newWorld())).toBe(0);
    expect(decorHappiness(won)).toBe(balance.decor.deco_bell_chime.dailyHappiness);
    const sad = { ...won, gauges: { ...won.gauges, happiness: 40 } };
    expect(decorMorning(sad).gauges.happiness).toBe(40 + balance.decor.deco_bell_chime.dailyHappiness);
  });

  it('turns a version 13 save into version 14 with the twins not revealed yet', () => {
    const file = toSaveFile(newWorld());
    const old = { ...file, version: 13, world: { ...file.world, monsters: { affection: { tangkrading: { points: 12, signature: false } }, plannedDay: 0, arrivals: [] } } };
    const parsed = parseSaveFile(old)!;
    expect(parsed.version).toBe(SAVE_VERSION);
    expect(parsed.world.monsters.twins).toEqual({ revealed: false, revealDay: 0, quizWon: false });
    expect(parsed.world.monsters.affection[A]).toEqual({ points: 12, signature: false });
  });
});
