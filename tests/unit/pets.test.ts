import { describe, expect, it } from 'vitest';
import type { World } from '../../src/core/state';
import { countOf } from '../../src/systems/farm';
import { newWorld } from '../../src/systems/gauges';
import {
  bathBonus,
  bondLevel,
  careForPet,
  carePets,
  daysToHeal,
  homeForSale,
  injuredPetIn,
  meadowOpen,
  missingForTreat,
  ownHome,
  petActionOf,
  petsMorning,
  takePetHome,
  treatByBath,
  treatPet,
} from '../../src/systems/pets';
import { SAVE_VERSION, parseSaveFile, toSaveFile } from '../../src/systems/save';
import { sleep } from '../../src/systems/time';

const withBag = (world: World, bag: World['bag']): World => ({ ...world, bag });
const nextDay = (world: World): World => ({ ...world, day: world.day + 1 });

describe('pets M8b (GDD pets table)', () => {
  it('has the five zone 1 pets, each found in its own gate', () => {
    expect(carePets().map((pet) => [pet.id, pet.gate])).toEqual([
      ['pangpok', 2],
      ['nuebnub', 4],
      ['boomboom', 5],
      ['bubble', 6],
      ['mumu', 8],
    ]);
    const world = newWorld();
    expect(injuredPetIn(world, 2)?.id).toBe('pangpok');
    expect(injuredPetIn(world, 3)).toBeNull();
    expect(injuredPetIn(takePetHome(world, 'pangpok'), 2)).toBeNull();
  });

  it('heals Pangpok after 2 days of 2 corn + 1 basil bandage, once a day, then waits for its coop', () => {
    let world = takePetHome(newWorld(), 'pangpok');
    expect(treatPet(world, 'pangpok')).toBe('missing');
    expect(missingForTreat(world, 'pangpok').map((row) => row.item)).toEqual(['produce_corn', 'basil_bandage']);
    world = withBag(world, [{ item: 'produce_corn@2', count: 2 }, { item: 'produce_corn', count: 2 }, { item: 'basil_bandage', count: 2 }]);
    const first = treatPet(world, 'pangpok');
    if (!first || typeof first === 'string') throw new Error('not treated');
    // ผักดาวต่ำใช้ก่อน
    expect(countOf(first.world.bag, 'produce_corn')).toBe(0);
    expect(countOf(first.world.bag, 'produce_corn@2')).toBe(2);
    expect(first.healed).toBe(false);
    expect(treatPet(first.world, 'pangpok')).toBe('done_today');
    const second = treatPet(nextDay(first.world), 'pangpok');
    if (!second || typeof second === 'string') throw new Error('not treated');
    expect(second.healed).toBe(true);
    expect(second.world.pets.pangpok?.stage).toBe('needs_home');
    expect(homeForSale(second.world, 'pangpok')).toBe(true);
    expect(meadowOpen(second.world)).toBe(false);
    const home = ownHome(second.world, 'pangpok');
    expect(home.pets.pangpok?.stage).toBe('living');
    expect(meadowOpen(home)).toBe(true);
    expect(homeForSale(home, 'pangpok')).toBe(false);
  });

  it('a daisy, sweet flower or marsh herb heals one day sooner', () => {
    let world = takePetHome(newWorld(), 'mumu');
    world = withBag(world, [{ item: 'produce_rice', count: 9 }, { item: 'produce_carrot', count: 9 }, { item: 'ing_marsh_herb', count: 2 }]);
    const first = treatPet(world, 'mumu');
    if (!first || typeof first === 'string') throw new Error('not treated');
    expect(first.boosted).toBe(true);
    expect(countOf(first.world.bag, 'ing_marsh_herb')).toBe(1);
    expect(daysToHeal('mumu', first.world.pets.mumu!)).toBe(3);
  });

  it('Boomboom drinks strawberry juice of any star · Bubble heals by bathing at the pond together', () => {
    const boom = withBag(takePetHome(newWorld(), 'boomboom'), [{ item: 'dish_strawberry_juice_2', count: 1 }]);
    const treated = treatPet(boom, 'boomboom');
    if (!treated || typeof treated === 'string') throw new Error('not treated');
    expect(treated.world.bag).toEqual([]);
    let bubble = takePetHome(newWorld(), 'bubble');
    expect(petActionOf(bubble, 'bubble')).toBe('bath');
    bubble = treatByBath(bubble);
    expect(bubble.pets.bubble?.treatedDays).toBe(1);
    expect(treatByBath(bubble).pets.bubble?.treatedDays).toBe(1);
    bubble = treatByBath(nextDay(bubble));
    // บับเบิ้ลอยู่ในบ่อ ไม่ต้องซื้อบ้าน
    expect(bubble.pets.bubble?.stage).toBe('living');
    expect(bathBonus(bubble)).toBe(20);
  });

  it('a pet at home gives produce each morning, fed and petted gives 10 bond a day, and level 5 gives 3 eggs', () => {
    let world = ownHome(takePetHome(newWorld(), 'pangpok'), 'pangpok');
    world = { ...world, pets: { ...world.pets, pangpok: { ...world.pets.pangpok!, stage: 'living' } }, bag: [{ item: 'produce_tomato', count: 1 }] };
    world = petsMorning(world);
    expect(world.pets.pangpok?.stored).toBe(1);
    const collected = careForPet(world, 'pangpok');
    if (!collected || collected === 'full') throw new Error('no egg');
    expect(collected.kind).toBe('collected');
    expect(countOf(collected.world.bag, 'ing_egg')).toBe(1);
    const fed = careForPet(collected.world, 'pangpok');
    if (!fed || fed === 'full') throw new Error('not fed');
    expect(fed.kind).toBe('fed');
    const petted = careForPet(fed.world, 'pangpok');
    if (!petted || petted === 'full') throw new Error('not petted');
    expect(petted.kind).toBe('petted');
    expect(petted.world.pets.pangpok?.bond).toBe(10);
    expect(careForPet(petted.world, 'pangpok')).toBeNull();
    expect([0, 30, 80, 150, 250].map(bondLevel)).toEqual([1, 2, 3, 4, 5]);
    const top = { ...petted.world, pets: { ...petted.world.pets, pangpok: { ...petted.world.pets.pangpok!, bond: 250, stored: 0 } } };
    expect(petsMorning(top).pets.pangpok?.stored).toBe(3);
  });

  it('Nuebnub waters dry tilled plots every morning (6 at level 1)', () => {
    let world = takePetHome(newWorld(), 'nuebnub');
    world = { ...world, pets: { ...world.pets, nuebnub: { ...world.pets.nuebnub!, stage: 'living' } } };
    world = { ...world, farm: { plots: world.farm.plots.map((plot, index) => ({ ...plot, tilled: index < 10, watered: false })) } };
    const morning = sleep({ ...world, weather: 'sunny', hour: 22 });
    const watered = morning.farm.plots.filter((plot) => plot.watered).length;
    // ถ้าฝนตกเช้านี้ทุกแปลงที่พรวนแล้วเปียกหมดอยู่แล้ว
    expect(morning.weather === 'rain' ? 10 : 6).toBe(watered);
  });

  it('saves version 25 with pets, and an old save starts with no pets', () => {
    expect(SAVE_VERSION).toBe(25);
    const world = takePetHome(newWorld(), 'pangpok');
    expect(parseSaveFile(toSaveFile(world))?.world.pets.pangpok?.stage).toBe('treating');
    const old = toSaveFile(newWorld()) as unknown as { version: number; world: Record<string, unknown> };
    delete old.world.pets;
    old.version = 24;
    expect(parseSaveFile(old)?.world.pets).toEqual({});
  });
});
