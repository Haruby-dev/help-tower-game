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
});

test('Puinun comes out of the burrow, takes a favourite tower, eats near the burrow, and her affection rises', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one full visit on desktop is enough; the mobile projects check the tray window');
  await open(page);
  await page.evaluate(() => (window as unknown as Win).__visitSpeed(3));
  await patch(
    page,
    `(w) => ({ ...w, hour: 13, gauges: { ...w.gauges, cleanliness: 50 }, tray: { level: 0, plates: [{ item: 'dish_grilled_fish_1', count: 2 }, { item: 'dish_strawberry_skewer_1', count: 6 }, { item: 'dish_boiled_egg_1', count: 2 }] } })`,
  );
  await standAtTray(page);
  await patch(page, `(w) => ({ ...w, monsters: { ...w.monsters, arrivals: [{ monster: 'puinun', day: w.day, hour: w.hour, done: false }] } })`);
  await expect.poll(() => visitsActive(page)).toBe(1);
  await expect.poll(() => monsterTexture(page)).toContain('monster_puinun_hungry');
  await page.waitForTimeout(1500);
  await shot(page, '03_puinun_out');
  // หยิบเมนูโปรดเป็นหอคอย 3–5 ที่ ไม่แตะปลาย่าง (ไม่ชอบ) รวมไม่เกิน 5 ที่
  await expect.poll(async () => (await world(page)).tray.plates[1]?.count ?? 0, { timeout: 60_000 }).toBeLessThan(6);
  await expect.poll(async () => (await world(page)).monsters.arrivals[0]?.done).toBe(true);
  await page.waitForTimeout(2500);
  await shot(page, '04_tower');
  const after = await world(page);
  const taken = 6 - (after.tray.plates[1]?.count ?? 0);
  expect(taken).toBeGreaterThanOrEqual(3);
  expect(taken).toBeLessThanOrEqual(5);
  expect(after.tray.plates[0]).toEqual({ item: 'dish_grilled_fish_1', count: 2 });
  expect(after.monsters.affection.puinun!.points).toBeGreaterThan(0);
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
