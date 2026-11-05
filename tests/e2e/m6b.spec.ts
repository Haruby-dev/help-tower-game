import { expect, test, type Page } from '@playwright/test';

interface M6bWorld {
  hour: number;
  bag: { item: string; count: number }[];
  wallet: { coins: number; stars: number };
  land: { owned: number };
  placed: Record<string, { x: number; y: number }>;
  farm: { plots: unknown[] };
  gio: { album: string[] };
}
interface TestState {
  world: M6bWorld;
  clockRunning: boolean;
  setWorld(world: unknown): void;
  movePlayer(point: { x: number; y: number }): void;
}
type AnyScene = {
  cameras: { main: { worldView: { x: number; y: number }; zoom: number } };
  landClutter: unknown[][];
  landLayers: { visible: boolean }[];
  arranger: { positionOf(id: string): { x: number; y: number } | null };
};

test.setTimeout(180_000);

const state = (page: Page): Promise<M6bWorld> => page.evaluate(() => (window as unknown as { __state: TestState }).__state.world);
const scene = <T>(page: Page, read: (s: AnyScene) => T): Promise<T> =>
  page.evaluate((body) => {
    const s = (window as unknown as { __game: { scene: { getScene(k: string): AnyScene } } }).__game.scene.getScene('Base');
    return new Function('s', `return (${body})(s)`)(s) as T;
  }, read.toString());
const addCoins = (page: Page, amount: number): Promise<void> =>
  page.evaluate((coins) => {
    (window as unknown as { __changeMoney: (c: string, a: number, l: string, k: string) => void }).__changeMoney('coins', coins, 'wallet.test_income', 'wallet.category_test');
  }, amount);

async function open(page: Page): Promise<void> {
  await page.goto('/help-tower-game/?test');
  await page.waitForFunction(() => (window as unknown as { __game?: { scene: { isActive(k: string): boolean } } }).__game?.scene.isActive('Base'));
}

/** แตะจุดบนโลกเกม แปลงเป็นตำแหน่งบนจอจากกล้อง */
async function tapWorld(page: Page, x: number, y: number): Promise<void> {
  const view = await scene(page, (s) => ({ x: s.cameras.main.worldView.x, y: s.cameras.main.worldView.y, zoom: s.cameras.main.zoom }));
  const box = (await page.locator('#game canvas').boundingBox())!;
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  await page.mouse.click(box.x + ((x - view.x) * view.zoom) / dpr, box.y + ((y - view.y) * view.zoom) / dpr);
}

test('buys the first land at its sign: the weeds go, the fence area becomes 9 farm plots, and the coins are logged', async ({ page }) => {
  await open(page);
  await addCoins(page, 6000);
  // ยืนใต้ป้ายของที่ดินแปลงแรก (ป้ายอยู่ที่ช่อง 6.9, 8.65)
  await page.evaluate(() => (window as unknown as { __state: TestState }).__state.movePlayer({ x: 221, y: 290 }));
  const act = page.locator('#action-button');
  await expect(act).toHaveAttribute('aria-label', 'ซื้อที่ดิน');
  await act.click();
  await expect(page.locator('#land-confirm')).toBeVisible();
  await expect(page.locator('#land-confirm')).toContainText('5,000');
  await page.locator('#land-yes').click();
  await expect(page.locator('#land-confirm')).toBeHidden();
  const after = await state(page);
  expect(after.land.owned).toBe(1);
  expect(after.wallet.coins).toBe(1000);
  expect(after.farm.plots).toHaveLength(25);
  await expect.poll(() => scene(page, (s) => s.landClutter[0]!.length)).toBe(0);
  expect(await scene(page, (s) => s.landLayers.map((layer) => layer.visible))).toEqual([true, false, false]);
  // แปลงถัดไปเงินไม่พอ ซื้อไม่ได้
  await page.evaluate(() => (window as unknown as { __state: TestState }).__state.movePlayer({ x: 349, y: 290 }));
  await expect(act).toHaveAttribute('aria-label', 'ซื้อที่ดิน');
  await act.click();
  await page.locator('#land-yes').click();
  expect((await state(page)).land.owned).toBe(1);
  // ที่ดินแปลงแรกที่ซื้อแล้วพรวนดินได้
  await page.evaluate(() => (window as unknown as { __state: TestState }).__state.movePlayer({ x: 176, y: 176 }));
  await page.locator('[data-tool="hoe"]').click();
  await expect(act).toHaveAttribute('aria-label', /พรวน/);
});

test('moves the campfire on the grid: red where it cannot go, green where it can, and the spot is kept in the save', async ({ page }) => {
  await open(page);
  await page.locator('#arrange-button').click();
  await expect(page.locator('#arrange-panel')).toBeVisible();
  await expect(page.locator('#toolbar')).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { __state: TestState }).__state.clockRunning)).toBe(false);
  const fire = (await scene(page, (s) => s.arranger.positionOf('campfire')))!;
  await tapWorld(page, fire.x, fire.y - 8);
  await expect(page.locator('#arrange-panel')).toContainText('แตะช่อง');
  // ลานหน้าบ้านอยู่ช่อง 10–22 · 9–14 ช่องนอกโซนเป็นสีแดง
  await tapWorld(page, 15 * 32, 7 * 32);
  await expect(page.locator('#arrange-place')).toBeDisabled();
  await tapWorld(page, 13 * 32 + 16, 13 * 32 + 16);
  await expect(page.locator('#arrange-place')).toBeEnabled();
  await page.locator('#arrange-place').click();
  const placed = (await state(page)).placed.campfire!;
  expect(placed).toEqual({ x: 13 * 32 + 32, y: 14 * 32 });
  await page.locator('#arrange-done').click();
  await expect(page.locator('#arrange-panel')).toBeHidden();
  await expect(page.locator('#toolbar')).toBeVisible();
  // กองไฟใหม่ใช้ทำอาหารได้
  await page.evaluate(({ x, y }) => (window as unknown as { __state: TestState }).__state.movePlayer({ x, y: y + 20 }), placed);
  await expect(page.locator('#action-button')).toHaveAttribute('aria-label', /ทำอาหาร/);
});

test('the Gio album opens a photo for each treat flavour he has eaten', async ({ page }) => {
  await open(page);
  const world = await state(page);
  await page.evaluate((w) => (window as unknown as { __state: TestState }).__state.setWorld({ ...w, gio: { ...w.gio, album: ['treat_tuna'] } }), world);
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="album"]').click();
  await expect(page.locator('.album-card')).toHaveCount(4);
  await expect(page.locator('.album-card[data-album="treat_tuna"]')).not.toHaveClass(/is-locked/);
  await expect(page.locator('.album-card[data-album="treat_salmon"]')).toHaveClass(/is-locked/);
  await expect(page.locator('.album-count')).toContainText('1/4');
});

test('the test button in settings gives sugar stars and logs them', async ({ page }) => {
  await open(page);
  const before = (await state(page)).wallet.stars;
  await page.locator('#settings-button').click();
  await expect(page.locator('#test-stars')).toBeVisible();
  await page.locator('#test-stars').click();
  expect((await state(page)).wallet.stars).toBe(before + 100);
});
