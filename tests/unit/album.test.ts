import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import type { World } from '../../src/core/state';
import gates from '../../src/data/gates.json';
import mail from '../../src/data/mail.json';
import pets from '../../src/data/pets.json';
import { gatesSchema, mailSchema, petsSchema } from '../../src/data/schema';
import th from '../../src/i18n/th.json';
import { dishItem } from '../../src/systems/cooking';
import { newWorld } from '../../src/systems/gauges';
import { floorOpen, monsterTable, newVisitMemo, noteTasted, planVisit, settleVisits, takePlate, tasteKnown, twinA, twinB } from '../../src/systems/monsters';
import { SAVE_VERSION, parseSaveFile, toSaveFile } from '../../src/systems/save';
import { putOnTray } from '../../src/systems/tray';
import { edibleStacks } from '../../src/ui/toolbar';

const PUINUN = 'puinun';
const text = th as Record<string, string>;

const withTray = (world: World, items: string[]): World =>
  items.reduce((next, item) => {
    const bag = [...next.bag, { item, count: 1 }];
    return putOnTray({ ...next, bag }, item, 1) ?? next;
  }, world);

describe('album monster tastes (shown only once known)', () => {
  it('a taste is unknown until the dish was served once or Gio told it in the news', () => {
    const world = newWorld();
    const favourite = monsterTable[PUINUN]!.favourite[0]!;
    expect(tasteKnown(world, PUINUN, favourite)).toBe(false);
    expect(tasteKnown(noteTasted(world, PUINUN, favourite), PUINUN, favourite)).toBe(true);
    const told: World = { ...world, gio: { ...world.gio, tips: [{ monster: PUINUN, kind: 'favourite', day: 1, read: true }] } };
    expect(tasteKnown(told, PUINUN, favourite)).toBe(true);
    // ข่าวเครื่องดื่มโปรดบอกแค่เครื่องดื่ม ไม่ได้บอกเมนูโปรด
    const drink: World = { ...world, gio: { ...world.gio, tips: [{ monster: PUINUN, kind: 'drink', day: 1, read: true }] } };
    expect(tasteKnown(drink, PUINUN, monsterTable[PUINUN]!.favouriteDrink)).toBe(true);
    expect(tasteKnown(drink, PUINUN, favourite)).toBe(false);
  });

  it('remembers a dish when the monster takes it from the tray, once', () => {
    const favourite = monsterTable[PUINUN]!.favourite[0]!;
    const world = withTray(newWorld(), [dishItem(favourite, 1)]);
    const plan = planVisit(world, PUINUN, createRng(3));
    const take = plan.takes[0]!;
    const fed = takePlate(world, PUINUN, take, newVisitMemo()).world;
    expect(fed.monsters.tasted[PUINUN]).toEqual([favourite]);
    expect(noteTasted(fed, PUINUN, favourite)).toBe(fed);
  });

  it('a visit nobody watched still remembers the dishes it took and the ones it pouted at', () => {
    const monster = monsterTable[PUINUN]!;
    const dislike = monster.dislikes[0]!;
    const like = monster.likes[0]!;
    let world = withTray(newWorld(), [dishItem(dislike, 1), dishItem(like, 1)]);
    world = { ...world, monsters: { ...world.monsters, arrivals: [{ monster: PUINUN, day: world.day, hour: 13, done: false }] }, hour: 22 };
    const settled = settleVisits(world);
    expect(settled.monsters.tasted[PUINUN]).toEqual(expect.arrayContaining([dislike, like]));
  });

  it('turns a version 14 save into version 15 that has not served anything yet', () => {
    const file = toSaveFile(newWorld());
    const { tasted: _tasted, ...monsters } = file.world.monsters;
    const old = { ...file, version: 14, world: { ...file.world, monsters } };
    const parsed = parseSaveFile(old)!;
    expect(parsed.version).toBe(SAVE_VERSION);
    expect(parsed.world.monsters.tasted).toEqual({});
  });
});

describe('gate map doors', () => {
  it('a floor opens at 100%, but the twins on floor 5 open only after the reveal', () => {
    const world = newWorld();
    const full = (id: string): World['monsters']['affection'][string] => ({ points: monsterTable[id]!.points, signature: true });
    const cleared: World = { ...world, monsters: { ...world.monsters, affection: { [PUINUN]: full(PUINUN), [twinA]: full(twinA), [twinB]: full(twinB) } } };
    expect(floorOpen(world, PUINUN)).toBe(false);
    expect(floorOpen(cleared, PUINUN)).toBe(true);
    expect(floorOpen(cleared, twinA)).toBe(false);
    const revealed: World = { ...cleared, monsters: { ...cleared.monsters, twins: { revealed: true, revealDay: 3, quizWon: false } } };
    expect(floorOpen(revealed, twinA)).toBe(true);
  });
});

describe('food bar (eat from the tool bar)', () => {
  it('lists dishes first, then raw vegetables, and never seeds, bait or chests', () => {
    const bag = [
      { item: 'produce_tomato', count: 2 },
      { item: 'seed_tomato', count: 4 },
      { item: dishItem('home_kaprao', 2), count: 1 },
      { item: 'chest_wooden', count: 1 },
      { item: dishItem('tomato_juice', 1), count: 3 },
    ];
    expect(edibleStacks(bag).map((stack) => stack.item)).toEqual([dishItem('home_kaprao', 2), dishItem('tomato_juice', 1), 'produce_tomato']);
  });
});

describe('static book data (pets, gates, letters)', () => {
  it('passes its schema and every entry has its text in th.json', () => {
    expect(petsSchema.safeParse(pets).success).toBe(true);
    expect(gatesSchema.safeParse(gates).success).toBe(true);
    expect(mailSchema.safeParse(mail).success).toBe(true);
    for (const pet of pets.pets) expect(text[`pet.${pet.id}.name`], pet.id).toBeTruthy();
    for (const gate of gates.gates) for (const part of ['name', 'reward', 'forage']) expect(text[`gate.${gate.floor}.${part}`]).toBeTruthy();
    for (const letter of mail.letters) for (const part of ['from', 'text', 'sign']) expect(text[`mail.${letter.number}.${part}`]).toBeTruthy();
    for (const [id, monster] of Object.entries(monsterTable)) {
      if (monster.twinOf) continue;
      expect(text[`monster.${id}.kind`], id).toBeTruthy();
      expect(text[`monster.${id}.trait`], id).toBeTruthy();
    }
  });

  it('lists the 15 pets in gate order and the 20 letters in number order', () => {
    const gatesInOrder = pets.pets.map((pet) => pet.gate);
    expect([...gatesInOrder].sort((a, b) => a - b)).toEqual(gatesInOrder);
    expect(mail.letters.map((letter) => letter.number)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  });
});
