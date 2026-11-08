import { describe, expect, it } from 'vitest';
import type { World } from '../../src/core/state';
import balance from '../../src/data/balance.json';
import { applyTransaction } from '../../src/systems/economy';
import { countOf } from '../../src/systems/farm';
import { newWorld } from '../../src/systems/gauges';
import {
  addToGioBag,
  collectReport,
  consign,
  estimate,
  giveTreat,
  gioMorning,
  isGioAway,
  isTripLive,
  returnsToday,
  hasUnreadNews,
  petGio,
  pettedToday,
  readNews,
  saleValue,
  soldTotal,
  treatsInBag,
  settleGio,
  tierFor,
  treatsLeftToday,
} from '../../src/systems/gio';
import { parseSaveFile, SAVE_VERSION } from '../../src/systems/save';
import { buyOffer, maxQuantity, offersFor } from '../../src/systems/shop';
import { sleep, stepClock } from '../../src/systems/time';

const HOUR_MS = balance.time.realSecondsPerGameHour * 1000;
const rich = (world: World, coins: number): World => applyTransaction(world, 'coins', coins, 'wallet.test_income', 'wallet.category_test');
const withGio = (world: World, happiness: number): World => ({ ...world, gio: { ...world.gio, happiness } });

describe('Gio happiness (GDD step 1)', () => {
  it('uses commission 10% / 20% / 30% by happiness, +10% price when happy, half the bag when sad', () => {
    expect(tierFor(100)).toMatchObject({ commission: 0.1, priceBonus: 0.1, sellShare: 1 });
    expect(tierFor(70)).toMatchObject({ commission: 0.1 });
    expect(tierFor(69)).toMatchObject({ commission: 0.2, priceBonus: 0 });
    expect(tierFor(30)).toMatchObject({ commission: 0.2 });
    expect(tierFor(29)).toMatchObject({ commission: 0.3, sellShare: 0.5 });
  });

  it('gives +15 / +8 / +4 for the day\'s three treats, then refuses a fourth', () => {
    let world: World = { ...withGio(newWorld(), 20), bag: [{ item: 'treat_tuna', count: 5 }] };
    const gains: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const result = giveTreat(world, 'treat_tuna');
      if (!result.world) throw new Error('treat refused');
      gains.push(result.gain);
      world = result.world;
    }
    expect(gains).toEqual([15, 8, 4]);
    expect(world.gio.happiness).toBe(47);
    expect(treatsLeftToday(world)).toBe(0);
    expect(giveTreat(world, 'treat_tuna')).toEqual({ world: null, reason: 'full' });
    expect(countOf(world.bag, 'treat_tuna')).toBe(2);
    // วันใหม่ให้ได้อีก
    expect(treatsLeftToday({ ...world, day: world.day + 1 })).toBe(3);
  });

  it('gives +25 for the first special treat of the week only', () => {
    let world: World = { ...withGio(newWorld(), 0), bag: [{ item: 'treat_special', count: 3 }] };
    const first = giveTreat(world, 'treat_special');
    if (!first.world) throw new Error('refused');
    expect(first.gain).toBe(25);
    world = first.world;
    const second = giveTreat(world, 'treat_special');
    if (!second.world) throw new Error('refused');
    expect(second.gain).toBe(8);
  });

  it('pets once a day for +3, loses 10 each morning, and stays between 0 and 100', () => {
    const petted = petGio(withGio(newWorld(), 50))!;
    expect(petted.gio.happiness).toBe(53);
    expect(petGio(petted)).toBeNull();
    expect(gioMorning({ ...petted.gio, happiness: 5 }).happiness).toBe(0);
    expect(sleep(withGio(newWorld(), 50)).gio.happiness).toBe(40);
    const treat = giveTreat({ ...withGio(newWorld(), 95), bag: [{ item: 'treat_salmon', count: 1 }] }, 'treat_salmon');
    expect(treat.world?.gio.happiness).toBe(100);
  });

  it('stays home all day unless something is consigned, then is away from 12:00 to 18:00 on the day he sells', () => {
    const home = newWorld();
    for (const hour of [6, 12, 15, 17.9, 25]) expect(isGioAway({ ...home, hour })).toBe(false);
    const left = consign({ ...home, hour: 9, bag: [{ item: 'produce_scallion', count: 1 }] }, [{ item: 'produce_scallion', count: 1 }])!;
    expect(isGioAway({ ...left, hour: 11.9 })).toBe(false);
    expect(isGioAway({ ...left, hour: 12 })).toBe(true);
    expect(isGioAway({ ...left, hour: 17.9 })).toBe(true);
    expect(isGioAway({ ...left, hour: 18 })).toBe(false);
    // ฝากหลังเที่ยง วันนี้ยังอยู่บ้าน ออกเที่ยงพรุ่งนี้
    const late = consign({ ...home, hour: 14, bag: [{ item: 'produce_scallion', count: 1 }] }, [{ item: 'produce_scallion', count: 1 }])!;
    expect(late.gio.consignment?.returnDay).toBe(2);
    expect(isGioAway({ ...late, hour: 15 })).toBe(false);
    expect(isGioAway({ ...late, day: 2, hour: 13 })).toBe(true);
    expect(returnsToday({ ...home, hour: 11.9 })).toBe(true);
    expect(returnsToday({ ...home, hour: 12 })).toBe(false);
  });

  it('walks to and from the burrow only within an hour of leaving or coming back', () => {
    const world = newWorld();
    expect(isTripLive({ ...world, hour: 12.5 }, true)).toBe(true);
    expect(isTripLive({ ...world, hour: 13 }, true)).toBe(false);
    expect(isTripLive({ ...world, hour: 18.2 }, false)).toBe(true);
    expect(isTripLive({ ...world, hour: 19 }, false)).toBe(false);
    expect(isTripLive({ ...world, hour: 6 }, false)).toBe(false);
  });
});

describe('consignment', () => {
  it('prices crops, fish and dishes, with 2-star ×1.2 and 3-star ×1.5', () => {
    expect(saleValue('produce_scallion')).toBe(80);
    expect(saleValue('fish_meow_salmon')).toBe(450);
    expect(saleValue('dish_home_kaprao_1')).toBe(1200);
    expect(saleValue('dish_home_kaprao_2')).toBe(1440);
    expect(saleValue('dish_home_kaprao_3')).toBe(1800);
    expect(saleValue('dish_mystery_1')).toBeNull();
    expect(saleValue('seed_rice')).toBeNull();
    expect(saleValue('treat_tuna')).toBeNull();
  });

  it('fills at most 10 slots and never more than she has', () => {
    const bag = Array.from({ length: 12 }, (_, i) => ({ item: `fish_${['silver_minnow', 'pond_tilapia', 'mud_catfish', 'golden_carp', 'lost_mackerel', 'glow_squid', 'meow_salmon', 'cloud_bass'][i % 8]}`, count: 1 }));
    const crops = ['scallion', 'garlic', 'rice', 'chili', 'basil', 'tomato'].map((crop) => ({ item: `produce_${crop}`, count: 3 }));
    let picked = addToGioBag([], [...bag, ...crops], 'produce_scallion', 99);
    expect(picked).toEqual([{ item: 'produce_scallion', count: 3 }]);
    picked = addToGioBag(picked, crops, 'produce_scallion', 1);
    expect(picked[0]!.count).toBe(3);
    for (const stack of [...bag, ...crops]) picked = addToGioBag(picked, [...bag, ...crops], stack.item, 1);
    expect(picked).toHaveLength(balance.gioCare.bagSlots);
  });

  it('takes the goods, comes back the same evening if left before 12:00, and pays after commission', () => {
    const start: World = { ...withGio(newWorld(), 50), hour: 9, bag: [{ item: 'produce_scallion', count: 10 }] };
    const items = [{ item: 'produce_scallion', count: 10 }];
    expect(estimate(items, 50)).toEqual({ gross: 800, commission: 160, coins: 640 });
    const left = consign(start, items)!;
    expect(countOf(left.bag, 'produce_scallion')).toBe(0);
    expect(left.gio.consignment?.returnDay).toBe(1);
    expect(consign(left, items)).toBeNull();
    expect(settleGio({ ...left, hour: 17.9 }).gio.consignment).not.toBeNull();
    const back = stepClock({ ...left, hour: 17.99 }, HOUR_MS / 10).world;
    expect(back.gio.consignment).toBeNull();
    expect(back.gio.report).toMatchObject({ gross: 800, commission: 160, coins: 640 });
    expect(back.wallet.coins).toBe(640);
    expect(back.wallet.log[0]).toMatchObject({ label: 'wallet.gio_sale', amount: 640 });
  });

  it('comes back the next evening when left after 12:00, using the happiness at hand-over', () => {
    const start: World = { ...withGio(newWorld(), 80), hour: 20, bag: [{ item: 'produce_tomato', count: 4 }] };
    const left = consign(start, [{ item: 'produce_tomato', count: 4 }])!;
    expect(left.gio.consignment?.returnDay).toBe(2);
    // ความสุขลดตอนเช้า แต่ค่าคอมยังใช้ตอนฝาก
    const morning = sleep(left);
    expect(morning.gio.consignment).not.toBeNull();
    const evening = settleGio({ ...morning, hour: 18 });
    const price = Math.round(100 * 1.1);
    expect(evening.gio.report).toMatchObject({ gross: price * 4, commission: Math.round(price * 4 * 0.1) });
  });

  it('sells only half when Gio is sad and hands the rest back when she reads the summary', () => {
    const start: World = { ...withGio(newWorld(), 10), hour: 9, bag: [{ item: 'produce_scallion', count: 5 }, { item: 'produce_tomato', count: 5 }] };
    const left = consign(start, [{ item: 'produce_scallion', count: 5 }, { item: 'produce_tomato', count: 5 }])!;
    const back = settleGio({ ...left, hour: 18 });
    expect(back.gio.report?.sold).toEqual([{ item: 'produce_tomato', count: 5 }]);
    expect(back.gio.report?.returned).toEqual([{ item: 'produce_scallion', count: 5 }]);
    const read = collectReport(back)!;
    expect(read.gio.report).toBeNull();
    expect(countOf(read.bag, 'produce_scallion')).toBe(5);
  });
});

describe('system shop', () => {
  it('sells the 4 treats, the 6 starter seeds, lime and coriander every day, plus 3 random seeds and 2 recipes', () => {
    const offers = offersFor(newWorld());
    expect(offers.filter((offer) => offer.group === 'treats').map((offer) => [offer.target, offer.price])).toEqual([
      ['treat_tuna', 200],
      ['treat_chicken', 200],
      ['treat_salmon', 200],
      ['treat_special', 500],
    ]);
    expect(offers.filter((offer) => offer.group === 'seeds').map((offer) => offer.price).sort((a, b) => a - b)).toEqual([80, 80, 80, 100, 300, 300, 350, 400]);
    expect(offers.filter((offer) => offer.group === 'random_seeds')).toHaveLength(3);
    expect(offers.filter((offer) => offer.group === 'recipes')).toHaveLength(2);
  });

  it('keeps the same random stock all day and changes it on another day', () => {
    const world = newWorld();
    const ids = (w: World) => offersFor(w).filter((offer) => offer.tab === 'random').map((offer) => offer.id).join();
    expect(ids(world)).toBe(ids({ ...world, hour: 20 }));
    const days = new Set(Array.from({ length: 6 }, (_, i) => ids({ ...world, day: i + 1 })));
    expect(days.size).toBeGreaterThan(1);
  });

  it('prices a recipe at the dish price × 5 and teaches it once', () => {
    const world = rich(newWorld(), 100_000);
    const recipe = offersFor(world).find((offer) => offer.kind === 'recipe')!;
    const bought = buyOffer(world, recipe, 1)!;
    expect(bought.recipes.known).toContain(recipe.target);
    expect(bought.wallet.coins).toBe(100_000 - recipe.price);
    expect(maxQuantity(bought, recipe)).toBe(0);
    expect(buyOffer(bought, recipe, 1)).toBeNull();
  });

  it('buys several seeds, logs the spend, and refuses when coins run short', () => {
    const world = rich(newWorld(), 1000);
    const scallion = offersFor(world).find((offer) => offer.target === 'seed_scallion')!;
    expect(maxQuantity(world, scallion)).toBe(12);
    const bought = buyOffer(world, scallion, 5)!;
    expect(bought.wallet.coins).toBe(600);
    expect(countOf(bought.bag, 'seed_scallion')).toBe(countOf(world.bag, 'seed_scallion') + 5);
    expect(bought.wallet.log[0]).toMatchObject({ label: 'wallet.shop_buy', amount: -400 });
    expect(buyOffer(world, scallion, 13)).toBeNull();
  });
});

describe('Gio receipt, gift and news', () => {
  it('lists each kind at the hand-over price, and the rows add up to the gross', () => {
    const start: World = { ...withGio(newWorld(), 80), hour: 9, bag: [{ item: 'produce_tomato', count: 3 }, { item: 'produce_scallion', count: 2 }] };
    const back = settleGio({ ...consign(start, [{ item: 'produce_tomato', count: 3 }, { item: 'produce_scallion', count: 2 }])!, hour: 18 });
    const report = back.gio.report!;
    expect(report.tier).toBe(0);
    expect(report.sold.reduce((sum, stack) => sum + soldTotal(report, stack), 0)).toBe(report.gross);
  });

  it('brings a gift only at the top happiness, about 20% of the time, and puts it in the bag', () => {
    let gifts = 0;
    for (let seed = 1; seed <= 400; seed += 1) {
      const start: World = { ...withGio(newWorld(), 90), seed, hour: 9, bag: [{ item: 'produce_tomato', count: 1 }] };
      const back = settleGio({ ...consign(start, [{ item: 'produce_tomato', count: 1 }])!, hour: 18 });
      if (back.gio.report!.gift) {
        gifts += 1;
        expect(balance.gioCare.giftPool.map((entry) => entry.item)).toContain(back.gio.report!.gift.item);
        if (gifts === 1) expect(countOf(collectReport(back)!.bag, back.gio.report!.gift.item)).toBe(back.gio.report!.gift.count);
      }
      const sad = settleGio({ ...consign({ ...start, gio: { ...start.gio, happiness: 50 } }, [{ item: 'produce_tomato', count: 1 }])!, hour: 18 });
      expect(sad.gio.report!.gift).toBeNull();
    }
    expect(gifts / 400).toBeGreaterThan(0.12);
    expect(gifts / 400).toBeLessThan(0.28);
  });

  it('shows the news dot while there is unread news (M7b), the check after the pat, and counts treats in the bag', () => {
    const world: World = { ...newWorld(), bag: [{ item: 'treat_tuna', count: 2 }, { item: 'treat_special', count: 1 }] };
    expect(hasUnreadNews(world)).toBe(false);
    const withTip: World = { ...world, gio: { ...world.gio, tips: [{ monster: 'puinun', kind: 'favourite', day: 1, read: false }] } };
    expect(hasUnreadNews(withTip)).toBe(true);
    const read = readNews(withTip);
    expect(hasUnreadNews(read)).toBe(false);
    expect(hasUnreadNews({ ...read, day: 2 })).toBe(false);
    expect(pettedToday(world)).toBe(false);
    expect(pettedToday(petGio(world)!)).toBe(true);
    expect(treatsInBag(world)).toBe(3);
  });
});

describe('save version 10', () => {
  it('adds the news day, and an open summary gets no gift and a tier guessed from its commission', () => {
    const world = newWorld();
    const { newsDay: _news, ...oldGio } = world.gio;
    const report = { day: 2, sold: [{ item: 'produce_tomato', count: 1 }], returned: [], gross: 1000, commission: 300, coins: 700 };
    const parsed = parseSaveFile({ version: 9, savedAt: '2026-11-05T00:00:00.000Z', world: { ...world, gio: { ...oldGio, report } } })!;
    expect(parsed.version).toBe(17);
    expect(parsed.world.gio.newsDay).toBe(0);
    expect(parsed.world.gio.report).toMatchObject({ gift: null, tier: 2 });
  });
});

describe('save version 9', () => {
  it('adds Gio at the start values and moves a chest cat treat into the bag as the special flavour', () => {
    const world = newWorld();
    const { gio: _gio, ...rest } = world;
    const v8 = { version: 8, savedAt: '2026-11-04T00:00:00.000Z', world: { ...rest, stash: { gio_lick_treat: 2, other: 1 } } };
    const parsed = parseSaveFile(v8)!;
    expect(SAVE_VERSION).toBe(17);
    expect(parsed.world.gio.happiness).toBe(balance.gioCare.startHappiness);
    expect(parsed.world.gio.consignment).toBeNull();
    expect(countOf(parsed.world.bag, 'treat_special')).toBe(2);
    expect(parsed.world.stash).toEqual({ other: 1 });
  });
});
