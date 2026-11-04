import { expect, test, type Page } from '@playwright/test';

interface ShopWorld {
  day: number;
  hour: number;
  bag: { item: string; count: number }[];
  wallet: { coins: number };
  gio: { happiness: number; consignment: unknown; report: { coins: number } | null };
}
interface TestState {
  world: ShopWorld;
  setWorld(world: unknown): void;
  movePlayer(point: { x: number; y: number }): void;
}
interface GioView {
  feetX: number;
  feetY: number;
  present: boolean;
}

test.setTimeout(180_000);

const state = (page: Page): Promise<ShopWorld> => page.evaluate(() => (window as unknown as { __state: TestState }).__state.world);
const change = (page: Page, patch: Partial<ShopWorld>): Promise<void> =>
  page.evaluate((next) => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, ...next });
  }, patch);
const count = async (page: Page, item: string): Promise<number> =>
  (await state(page)).bag.filter((stack) => stack.item === item).reduce((sum, stack) => sum + stack.count, 0);
const gio = (page: Page): Promise<GioView> =>
  page.evaluate(() => {
    const scene = (window as unknown as { __game: { scene: { getScene(k: string): { gio: GioView } } } }).__game.scene.getScene('Base');
    return { feetX: scene.gio.feetX, feetY: scene.gio.feetY, present: scene.gio.present };
  });

async function open(page: Page): Promise<void> {
  await page.goto('/help-tower-game/?test');
  await page.waitForFunction(() => (window as unknown as { __game?: { scene: { isActive(k: string): boolean } } }).__game?.scene.isActive('Base'));
}

async function standByGio(page: Page): Promise<void> {
  const where = await gio(page);
  await page.evaluate(({ x, y }) => (window as unknown as { __state: TestState }).__state.movePlayer({ x: x + 26, y }), { x: where.feetX, y: where.feetY });
  await expect(page.locator('#action-button')).toContainText('คุย');
}

test('buys cat treats and seeds in the system shop, and the money is logged', async ({ page }) => {
  await open(page);
  await change(page, { wallet: { ...(await state(page)).wallet, coins: 2000 } });
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="shop"]').click();
  await expect(page.locator('#phone')).toHaveAttribute('data-app', 'shop');
  await expect(page.locator('#phone-close')).toBeHidden();
  await expect(page.locator('#shop-coins')).toHaveText('2,000');
  await page.locator('[data-offer="treats:treat_salmon"]').click();
  await page.locator('#shop-more').click();
  await expect(page.locator('#shop-qty')).toHaveText('2');
  await expect(page.locator('#shop-buy')).toContainText('400');
  await page.locator('#shop-buy').click();
  await expect.poll(() => count(page, 'treat_salmon')).toBe(2);
  await expect(page.locator('#shop-coins')).toHaveText('1,600');
  await page.locator('[data-offer="seeds:scallion"]').click();
  await page.locator('#shop-buy').click();
  await expect.poll(() => count(page, 'seed_scallion')).toBe(1);
  expect((await state(page)).wallet.coins).toBe(1520);
  await page.locator('[data-shop-tab="random"]').click();
  await expect(page.locator('.shop-item')).toHaveCount(5);
  await page.locator('[data-shop-tab="equipment"]').click();
  await expect(page.locator('.shop-closed')).toBeVisible();
});

test('Gio is away selling in the day and home in the evening, where she can talk, give a treat and pet him', async ({ page }) => {
  await open(page);
  await change(page, { hour: 12 });
  await expect.poll(async () => (await gio(page)).present).toBe(false);
  await change(page, { hour: 19, bag: [...(await state(page)).bag, { item: 'treat_tuna', count: 2 }] });
  await expect.poll(async () => (await gio(page)).present).toBe(true);
  await standByGio(page);
  await page.locator('#action-button').click();
  await expect(page.locator('#gio-window')).toBeVisible();
  const clock = (await state(page)).hour;
  await page.locator('[data-gio-action="treat"]').click();
  await page.locator('.gio-treat[data-item="treat_tuna"]').click();
  await expect(page.locator('#gio-line')).toContainText('อร่อย');
  expect((await state(page)).gio.happiness).toBe(65);
  await page.locator('[data-gio-action="pet"]').click();
  expect((await state(page)).gio.happiness).toBe(68);
  await page.locator('[data-gio-action="pet"]').click();
  await expect(page.locator('#gio-line')).toContainText('ลูบไปแล้ว');
  expect((await state(page)).hour).toBe(clock);
  await page.locator('[data-gio-action="close"]').click();
  await expect(page.locator('#gio-window')).toBeHidden();
});

test('consigns produce to Gio, and the next evening he pays after commission and shows the summary', async ({ page }) => {
  await open(page);
  await change(page, { hour: 19, bag: [{ item: 'produce_scallion', count: 10 }, { item: 'fish_silver_minnow', count: 1 }] });
  await standByGio(page);
  await page.locator('#action-button').click();
  await page.locator('[data-gio-action="consign"]').click();
  await expect(page.locator('#consign-window')).toBeVisible();
  await expect(page.locator('#consign-commission')).toContainText('20%');
  await page.locator('.consign-slot[data-item="produce_scallion"]').click();
  await page.locator('.consign-slot[data-item="fish_silver_minnow"]').click();
  // ต้นหอม 1 × 80 + ปลา 1 × 150 = 230 หักคอม 20% เหลือ 184
  await expect(page.locator('#consign-estimate')).toContainText('184');
  await page.locator('#consign-go').click();
  await expect(page.locator('#consign-window')).toBeHidden();
  await expect(page.locator('#gio-line')).toContainText('ฝากไว้แล้ว');
  expect(await count(page, 'produce_scallion')).toBe(9);
  await page.locator('[data-gio-action="close"]').click();

  await change(page, { day: 2, hour: 18.2 });
  await expect.poll(async () => (await state(page)).gio.report?.coins).toBe(184);
  expect((await state(page)).wallet.coins).toBe(184);
  await standByGio(page);
  await page.locator('#action-button').click();
  await expect(page.locator('#gio-report')).toBeVisible();
  await expect(page.locator('#report-coins')).toContainText('184');
  await page.locator('.gio-report__ok').click();
  await expect(page.locator('[data-gio-action="consign"]')).toBeVisible();
  expect((await state(page)).gio.report).toBeNull();
});

test('the bag no longer has the turn-into-seeds button and cat treats say they are Gio snacks', async ({ page }) => {
  await open(page);
  await change(page, { bag: [{ item: 'produce_tomato', count: 2 }, { item: 'treat_chicken', count: 1 }] });
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="inventory"]').click();
  await page.locator('[data-item="produce_tomato"]').click();
  await expect(page.locator('#bag-convert')).toHaveCount(0);
  await page.locator('[data-bag-tab="goods"]').click();
  await page.locator('[data-item="treat_chicken"]').click();
  await expect(page.locator('.bag-detail')).toContainText('ขนมของจีโอ');
});
