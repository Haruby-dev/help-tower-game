import { expect, test, type Page } from '@playwright/test';

interface Plate {
  item: string;
  count: number;
}
interface M7World {
  day: number;
  hour: number;
  bag: { item: string; count: number }[];
  wallet: { coins: number; stars: number };
  farm: { plots: { tilled: boolean; watered: boolean; crop: unknown; fertilizer: number }[] };
  tray: { level: number; plates: (Plate | null)[] };
  monsters: { affection: Record<string, { points: number; signature: boolean }>; plannedDay: number; arrivals: { monster: string; day: number; hour: number; done: boolean }[] };
  recipes: { known: string[]; bestStars: Record<string, number> };
  gauges: { fullness: number; happiness: number; cleanliness: number; homesickness: number };
  gio: { report: unknown };
}
interface TestState {
  world: M7World;
  setWorld(world: unknown): void;
  movePlayer(point: { x: number; y: number }): void;
}
type Win = { __state: TestState; __visitSpeed(speed: number): void; __game: { scene: { getScene(key: string): unknown; isActive(key: string): boolean } } };

test.setTimeout(150_000);

/** ภาพหน้าจอระหว่างพัฒนา (ตั้ง M7_SHOTS เป็นโฟลเดอร์) ปกติไม่ถ่าย */
const shot = async (page: Page, name: string): Promise<void> => {
  if (process.env.M7_SHOTS) await page.screenshot({ path: `${process.env.M7_SHOTS}/${name}.png` });
};
const world = (page: Page): Promise<M7World> => page.evaluate(() => (window as unknown as Win).__state.world);
const patch = (page: Page, body: string): Promise<void> =>
  page.evaluate((code) => {
    const state = (window as unknown as Win).__state;
    state.setWorld(new Function('w', `return (${code})(w)`)(state.world));
  }, body);
const visitsActive = (page: Page): Promise<number> =>
  page.evaluate(() => ((window as unknown as Win).__game.scene.getScene('Base') as { visits: { runs: Map<string, unknown> } }).visits.runs.size);
const monsterTexture = (page: Page): Promise<string | null> =>
  page.evaluate(() => {
    const scene = (window as unknown as Win).__game.scene.getScene('Base') as { visits: { runs: Map<string, { monster: { sprite: { texture: { key: string } } } }> } };
    const run = [...scene.visits.runs.values()][0];
    return run ? run.monster.sprite.texture.key : null;
  });

async function open(page: Page): Promise<void> {
  await page.goto('/help-tower-game/?test');
  await page.waitForFunction(() => (window as unknown as Partial<Win>).__game?.scene.isActive('Base'));
}

/** ยืนหน้าถาดอาหาร (ถาดอยู่ที่ช่อง 19.6, 10.7) */
const standAtTray = (page: Page): Promise<void> => page.evaluate(() => (window as unknown as Win).__state.movePlayer({ x: 640, y: 362 }));

test('puts dishes on the tray in the tray window: one menu per plate, the same menu stacks, tap a plate to take back', async ({ page }) => {
  await open(page);
  await patch(page, `(w) => ({ ...w, bag: [...w.bag, { item: 'dish_strawberry_skewer_1', count: 4 }, { item: 'dish_boiled_egg_2', count: 1 }] })`);
  await standAtTray(page);
  const act = page.locator('#action-button');
  await expect(act).toHaveAttribute('aria-label', 'วางอาหาร');
  await act.click();
  const tray = page.locator('#tray-window');
  await expect(tray).toBeVisible();
  const skewer = tray.locator('.tray-dish[data-item="dish_strawberry_skewer_1"]');
  await skewer.click();
  await skewer.click();
  await tray.locator('.tray-dish[data-item="dish_boiled_egg_2"]').click();
  // ของที่มีดาวมีป้ายดาวที่มุมซ้ายล่าง
  await expect(tray.locator('.tray-plate[data-plate="1"] .star-badge')).toHaveAttribute('data-stars', '2');
  await shot(page, '01_tray_window');
  expect((await world(page)).tray.plates).toEqual([{ item: 'dish_strawberry_skewer_1', count: 2 }, { item: 'dish_boiled_egg_2', count: 1 }, null]);
  await tray.locator('.tray-plate[data-plate="0"]').click();
  expect((await world(page)).tray.plates[0]).toEqual({ item: 'dish_strawberry_skewer_1', count: 1 });
  await tray.locator('#tray-close').click();
  await expect(tray).toBeHidden();
  await shot(page, '02_tray_in_world');
  // อาหารจิ๋วบนจานใช้ภาพจริงจากฝั่งวางแผน (6 พ.ย. 2026) ไม่ใช่กองสี
  const piles = await page.evaluate(() =>
    ((window as unknown as Win).__game.scene.getScene('Base') as { children: { list: { name: string; texture?: { key: string } }[] } }).children.list
      .filter((child) => child.name.startsWith('tray_pile_'))
      .map((child) => child.texture?.key),
  );
  expect(piles.sort()).toEqual(['tray_mini_boiled_egg', 'tray_mini_strawberry_skewer']);
  // ปุ่มวางอาหารมีไอคอนจริงแล้ว ไม่ใช่กล่อง "…"
  await expect(page.locator('#action-button .action-button__icon')).toHaveAttribute('src', /icon_place_food/);
});

test('Puinun (warm, 50%) comes out of the burrow, takes a favourite tower, eats near the burrow, and her affection rises', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one full visit on desktop is enough; the mobile projects check the tray window');
  await open(page);
  await page.evaluate(() => (window as unknown as Win).__visitSpeed(3));
  await patch(
    page,
    `(w) => ({ ...w, hour: 13, gauges: { ...w.gauges, cleanliness: 50 }, monsters: { ...w.monsters, affection: { puinun: { points: 15, signature: false } } }, tray: { level: 0, plates: [{ item: 'dish_grilled_fish_1', count: 2 }, { item: 'dish_strawberry_skewer_1', count: 6 }, { item: 'dish_boiled_egg_1', count: 2 }] } })`,
  );
  await standAtTray(page);
  await patch(page, `(w) => ({ ...w, monsters: { ...w.monsters, arrivals: [{ monster: 'puinun', day: w.day, hour: w.hour, done: false }] } })`);
  await expect.poll(() => visitsActive(page)).toBe(1);
  // ความชอบ 50% ตาเปลี่ยนไปครึ่งทางแล้ว (ภาพช่วงกลาง)
  await expect.poll(() => monsterTexture(page)).toContain('monster_puinun_eye');
  await page.waitForTimeout(1500);
  await shot(page, '03_puinun_out');
  // หยิบเมนูโปรดเป็นหอคอย 3–5 ที่ ไม่แตะปลาย่าง (ไม่ชอบ) รวมไม่เกิน 5 ที่
  await expect.poll(async () => (await world(page)).tray.plates[1]?.count ?? 0, { timeout: 60_000 }).toBeLessThan(6);
  // หอคอยเหนือหัวใช้จาน D1 กับภาพถังหูลู่จิ๋ว (ผู้ใช้เลือก 6 พ.ย. 2026 14:18)
  const towerKeys = await page.evaluate(() =>
    ((window as unknown as Win).__game.scene.getScene('Base') as { children: { list: { name: string; texture?: { key: string } }[] } }).children.list
      .filter((child) => child.name === 'tower_layer')
      .map((child) => child.texture?.key),
  );
  expect(new Set(towerKeys)).toEqual(new Set(['tower_plate', 'tray_mini_strawberry_skewer']));
  await expect.poll(async () => (await world(page)).monsters.arrivals[0]?.done).toBe(true);
  await page.waitForTimeout(2500);
  await shot(page, '04_tower');
  const after = await world(page);
  const taken = 6 - (after.tray.plates[1]?.count ?? 0);
  expect(taken).toBeGreaterThanOrEqual(3);
  expect(taken).toBeLessThanOrEqual(5);
  expect(after.tray.plates[0]).toEqual({ item: 'dish_grilled_fish_1', count: 2 });
  expect(after.monsters.affection.puinun!.points).toBeGreaterThan(15);
  // ไปนั่งกินใกล้โพรง ตาค่อย ๆ เปลี่ยน แล้วกลับเข้าโพรงหายไป
  await page.evaluate(() => (window as unknown as Win).__state.movePlayer({ x: 960, y: 330 }));
  await page.waitForTimeout(4000);
  await shot(page, '05_eating');
  await expect(page.locator('.monster-tag')).toContainText('ปุยนุ่น');
  await expect.poll(() => visitsActive(page), { timeout: 90_000 }).toBe(0);
});

test('at 90% Puinun asks for baked potato; eating it reaches 100%, turns her sweet, opens floor 1 and pays sugar stars', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one full visit on desktop is enough');
  await open(page);
  await page.evaluate(() => (window as unknown as Win).__visitSpeed(3));
  await patch(
    page,
    `(w) => ({ ...w, hour: 14, monsters: { ...w.monsters, affection: { puinun: { points: 27, signature: false } } }, tray: { level: 0, plates: [{ item: 'dish_baked_potato_1', count: 1 }, { item: 'dish_strawberry_skewer_1', count: 2 }, null] } })`,
  );
  const stars = (await world(page)).wallet.stars;
  await page.evaluate(() => (window as unknown as Win).__state.movePlayer({ x: 960, y: 330 }));
  await patch(page, `(w) => ({ ...w, monsters: { ...w.monsters, arrivals: [{ monster: 'puinun', day: w.day, hour: w.hour, done: false }] } })`);
  await expect.poll(async () => (await world(page)).monsters.affection.puinun?.signature, { timeout: 60_000 }).toBe(true);
  const cleared = await world(page);
  expect(cleared.monsters.affection.puinun!.points).toBe(30);
  expect(cleared.wallet.stars).toBe(stars + 30);
  expect(cleared.tray.plates[0]).toBeNull();
  // ภาพเปลี่ยนเป็นตัวหวานตอนกินเมนูประจำใจ
  await expect.poll(() => monsterTexture(page), { timeout: 60_000 }).toContain('monster_puinun_sweet');
  await expect(page.locator('#notice')).toContainText('ประตูชั้น 1 เปิดแล้ว');
  await shot(page, '06_sweet');
  await expect.poll(() => visitsActive(page), { timeout: 90_000 }).toBe(0);
});

test('fertilizer twinkles on a tilled plot and cooking can pick 3-star strawberries for a 3-star tanghulu', async ({ page }) => {
  await open(page);
  await patch(
    page,
    `(w) => ({ ...w, recipes: { ...w.recipes, known: [...w.recipes.known, 'strawberry_skewer'] }, bag: [...w.bag, { item: 'fertilizer_3', count: 1 }, { item: 'produce_strawberry', count: 2 }, { item: 'produce_strawberry@3', count: 2 }], farm: { plots: w.farm.plots.map((plot, index) => (index === 0 ? { ...plot, tilled: true, fertilizer: 3 } : plot)) } })`,
  );
  await page.evaluate(() => (window as unknown as Win).__state.movePlayer({ x: 190, y: 360 }));
  await expect
    .poll(() =>
      page.evaluate(() => {
        const scene = (window as unknown as Win).__game.scene.getScene('Base') as { plots: { twinkles: unknown[] }[] };
        return scene.plots[0]!.twinkles.length;
      }),
    )
    .toBe(4);
  await shot(page, '07_twinkles');
  // หน้าทำอาหาร: จานสตรอว์เบอร์รีมีป้ายดาว แตะเพื่อเปลี่ยนเป็น 3 ดาว
  await page.evaluate(() => (window as unknown as Win).__state.movePlayer({ x: 548, y: 362 }));
  await page.locator('#action-button').click();
  const cook = page.locator('#cook-window');
  await expect(cook).toBeVisible();
  await cook.locator('[data-cook-tab="sweet"]').click();
  await cook.locator('[data-recipe="strawberry_skewer"]').click();
  await expect(cook.locator('#cook-dish-stars')).toHaveAttribute('data-stars', '1');
  await cook.locator('[data-star-pick="produce_strawberry"]').click();
  await expect(cook.locator('#cook-dish-stars')).toHaveAttribute('data-stars', '3');
  await shot(page, '08_star_pick');
  await cook.locator('#cook-go').click();
  const cooking = await world(page);
  expect(cooking.bag.find((stack) => stack.item === 'produce_strawberry@3')).toBeUndefined();
  expect(cooking.bag.find((stack) => stack.item === 'produce_strawberry')?.count).toBe(2);
});

test('the test spawn button in settings puts the chosen item, stars and count in the bag', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'a quick desktop check is enough for a test-only button');
  await open(page);
  await page.locator('#settings-button').click();
  await page.locator('#test-spawn-item').selectOption('produce_strawberry');
  await page.locator('#test-spawn-stars').selectOption('3');
  await page.locator('#test-spawn-count').selectOption('5');
  await page.locator('#test-spawn').click();
  await page.locator('#test-spawn-item').selectOption('dish_baked_potato_1');
  await page.locator('#test-spawn-stars').selectOption('2');
  await page.locator('#test-spawn').click();
  const bag = (await world(page)).bag;
  expect(bag.find((stack) => stack.item === 'produce_strawberry@3')?.count).toBe(5);
  expect(bag.find((stack) => stack.item === 'dish_baked_potato_2')?.count).toBe(5);
});

const textures = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const scene = (window as unknown as Win).__game.scene.getScene('Base') as { visits: { runs: Map<string, { monster: { sprite: { texture: { key: string } } } }> } };
    return [...scene.visits.runs.values()].map((run) => run.monster.sprite.texture.key);
  });

test('M7b: a wary Popcorn grabs her boiled egg tower and runs straight back into the burrow without sitting to eat', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one full visit on desktop is enough');
  await open(page);
  await page.evaluate(() => (window as unknown as Win).__visitSpeed(3));
  await patch(page, `(w) => ({ ...w, hour: 13, tray: { level: 0, plates: [{ item: 'dish_boiled_egg_1', count: 5 }, null, null] } })`);
  await page.evaluate(() => (window as unknown as Win).__state.movePlayer({ x: 700, y: 420 }));
  await patch(page, `(w) => ({ ...w, monsters: { ...w.monsters, arrivals: [{ monster: 'popcorn', day: w.day, hour: w.hour, done: false }] } })`);
  await expect.poll(() => monsterTexture(page)).toContain('monster_popcorn_hungry');
  const seen = new Set<string>();
  await expect
    .poll(
      async () => {
        for (const key of await textures(page)) seen.add(key);
        return visitsActive(page);
      },
      { timeout: 90_000, intervals: [200] },
    )
    .toBe(0);
  expect([...seen].some((key) => key.includes('_eat'))).toBe(false);
  const after = await world(page);
  expect(after.monsters.affection.popcorn!.points).toBeGreaterThan(0);
  expect(after.tray.plates[0]?.count ?? 0).toBeLessThanOrEqual(2);
});

test('M7b: Puinun takes her favourite food and favourite drink together and says "เข้ากันสุดๆ!"', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one full visit on desktop is enough');
  await open(page);
  await page.evaluate(() => (window as unknown as Win).__visitSpeed(3));
  await patch(
    page,
    `(w) => ({ ...w, hour: 13, monsters: { ...w.monsters, affection: { puinun: { points: 15, signature: false } } }, tray: { level: 0, plates: [{ item: 'dish_strawberry_skewer_1', count: 3 }, { item: 'dish_strawberry_juice_1', count: 2 }, null] } })`,
  );
  await page.evaluate(() => (window as unknown as Win).__state.movePlayer({ x: 700, y: 420 }));
  await patch(page, `(w) => ({ ...w, monsters: { ...w.monsters, arrivals: [{ monster: 'puinun', day: w.day, hour: w.hour, done: false }] } })`);
  await expect(page.locator('.world-bubble', { hasText: 'เข้ากันสุดๆ!' })).toBeVisible({ timeout: 60_000 });
  await shot(page, '12_set');
  const after = await world(page);
  expect(after.tray.plates[1]?.count).toBe(1);
});

test('M7b: Gio comes back with news: the summary shows tomorrow\'s visitors and new tips, and the news page lists them', async ({ page }) => {
  await open(page);
  await patch(page, `(w) => ({ ...w, hour: 19, gio: { ...w.gio, happiness: 90 }, bag: [{ item: 'produce_scallion', count: 9 }] })`);
  const where = await page.evaluate(() => {
    const g = ((window as unknown as Win).__game.scene.getScene('Base') as { gio: { feetX: number; feetY: number } }).gio;
    return { x: g.feetX, y: g.feetY };
  });
  await page.evaluate(({ x, y }) => (window as unknown as Win).__state.movePlayer({ x: x + 26, y }), where);
  await page.locator('#action-button').click();
  await page.locator('[data-gio-action="consign"]').click();
  await page.locator('.consign-slot[data-item="produce_scallion"]').click({ delay: 600 });
  await page.locator('#consign-go').click();
  await page.locator('[data-gio-action="close"]').click();
  await patch(page, `(w) => ({ ...w, day: 2, hour: 18.2 })`);
  await expect.poll(async () => (await world(page)).gio.report !== null).toBe(true);
  // ยืนใกล้จีโออยู่แล้ว ใบสรุปยอดเปิดเอง · ขาย 9 ชิ้น พรุ่งนี้มา 1 + 9 ÷ 4 = 3 ตัว · ความสุข 70 ขึ้นไปได้ข่าว 2 ข้อ
  await expect(page.locator('#gio-report')).toBeVisible();
  await expect(page.locator('#report-visitors')).toContainText('พรุ่งนี้มอนสเตอร์มาเยี่ยม 3 ตัว');
  await expect(page.locator('#report-news')).toContainText('มีข่าวใหม่ 2 ข้อ');
  await shot(page, '13_summary');
  await page.locator('.gio-report__ok').click();
  await page.locator('#action-button').click();
  await expect(page.locator('[data-gio-action="news"] .gio-talk__dot')).toHaveCount(1);
  await page.locator('[data-gio-action="news"]').click();
  await expect(page.locator('#gio-news .gio-talk__tip')).toHaveCount(2);
  await expect(page.locator('#gio-news .gio-talk__new')).toHaveCount(2);
  await expect(page.locator('#gio-line')).toContainText('ได้ยินว่า');
  await shot(page, '14_news');
  await page.locator('.gio-talk__news-back').click();
  await expect(page.locator('[data-gio-action="news"] .gio-talk__dot')).toHaveCount(0);
});

test('floor 5 twins: the reveal scene asks who likes fish, a right guess opens the door and gives the wind chime', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the reveal is one scene; desktop is enough');
  await open(page);
  await page.evaluate(() => (window as unknown as Win).__visitSpeed(3));
  // ข้ามไปฉากเฉลย: พี่กับน้องครบ 100% ทั้งคู่แล้ว
  await patch(page, `(w) => ({ ...w, hour: 15, monsters: { ...w.monsters, affection: { tangkrading: { points: 36, signature: true }, tangkrading_b: { points: 36, signature: true } } } })`);
  await page.evaluate(() => (window as unknown as Win).__state.movePlayer({ x: 700, y: 372 }));
  await patch(page, `(w) => ({ ...w, monsters: { ...w.monsters, arrivals: [{ monster: 'tangkrading', day: w.day, hour: w.hour, done: false, kind: 'reveal' }] } })`);
  await expect(page.locator('#twin-quiz')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.twin-quiz__prompt')).toHaveText('ใครชอบกินปลา?');
  await expect(page.locator('.twin-quiz__pick')).toHaveCount(2);
  // ก่อนสะบัดฟาง สองตัวใช้ภาพเดียวกันทุกพิกเซล
  const sides = await page.evaluate(() => {
    const run = [...((window as unknown as Win).__game.scene.getScene('Base') as { visits: { runs: Map<string, { monster: { feetX: number; sprite: { texture: { key: string } } }; partner: { feetX: number; sprite: { texture: { key: string } } } }> } }).visits.runs.values()][0]!;
    return { elderLeft: run.monster.feetX < run.partner.feetX, same: run.monster.sprite.texture.key === run.partner.sprite.texture.key };
  });
  expect(sides.same).toBe(true);
  await page.locator(`.twin-quiz__pick[data-twin="${sides.elderLeft ? 0 : 1}"]`).click();
  await expect(page.locator('#twin-quiz')).toBeHidden();
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __state: { world: { monsters: { twins: unknown } } } }).__state.world.monsters.twins)), { timeout: 60_000 }).toMatchObject({ revealed: true, quizWon: true });
  // กระดิ่งลมแฝดแขวนที่ลานหน้าบ้าน ย้ายได้ในโหมดจัดวาง
  await expect.poll(() => page.evaluate(() => ((window as unknown as Win).__game.scene.getScene('Base') as { children: { list: { texture?: { key: string } }[] } }).children.list.some((child) => child.texture?.key === 'deco_bell_chime_sway'))).toBe(true);
  await expect.poll(() => visitsActive(page), { timeout: 90_000 }).toBe(0);
});
