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
  // ปุ่มจัดวางเป็นสติกเกอร์รถเข็น ไม่มีกล่องตัวหนังสือแล้ว และไม่ทับปุ่มตั้งค่า
  const arrange = page.locator('#arrange-button');
  await expect(arrange.locator('canvas')).toHaveCount(1);
  await expect(arrange).toHaveText('');
  const [a, b] = await Promise.all([arrange.boundingBox(), page.locator('#settings-button').boundingBox()]);
  expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x + 0.5);
  await arrange.click();
  // กล้องเลื่อนไปลานหน้าบ้านในเฟรมถัดไป รอก่อนแปลงตำแหน่งบนจอ
  await page.waitForTimeout(400);
  await expect(page.locator('#arrange-panel')).toBeVisible();
  await expect(page.locator('#toolbar')).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { __state: TestState }).__state.clockRunning)).toBe(false);
  const fire = (await scene(page, (s) => s.arranger.positionOf('campfire')))!;
  await tapWorld(page, fire.x, fire.y - 8);
  await expect(page.locator('#arrange-panel')).toContainText('ช่องที่อยากวาง');
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

test('drags the food tray to a green spot and it stays there; dropping on a red spot puts it back', async ({ page, browserName }) => {
  // WebKit ของ Playwright ลากด้วยเมาส์ในโหมดจอสัมผัสไม่ได้ (แตะได้) บน iPhone จริงลากด้วยนิ้ว ต้องลองบนเครื่องจริง
  test.skip(browserName === 'webkit', 'mouse drag is not delivered in WebKit touch emulation');
  await open(page);
  await page.locator('#arrange-button').click();
  // กล้องเลื่อนไปลานหน้าบ้านในเฟรมถัดไป รอก่อนแปลงตำแหน่งบนจอ
  await page.waitForTimeout(400);
  const tray = (await scene(page, (s) => s.arranger.positionOf('food_tray_3')))!;
  const view = await scene(page, (s) => ({ x: s.cameras.main.worldView.x, y: s.cameras.main.worldView.y, zoom: s.cameras.main.zoom }));
  const box = (await page.locator('#game canvas').boundingBox())!;
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const screen = (x: number, y: number) => ({ x: box.x + ((x - view.x) * view.zoom) / dpr, y: box.y + ((y - view.y) * view.zoom) / dpr });
  const drag = async (fromX: number, fromY: number, toX: number, toY: number): Promise<void> => {
    const from = screen(fromX, fromY);
    const to = screen(toX, toY);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
  };
  // ลากไปช่องว่างในลานหน้าบ้าน วางเลย
  await drag(tray.x, tray.y - 6, 20 * 32, 14 * 32 - 6);
  await expect.poll(async () => (await state(page)).placed.food_tray_3).toEqual({ x: 20 * 32, y: 14 * 32 });
  // ลากไปทับกองไฟ วางไม่ได้ กลับที่เดิม
  const fire = (await scene(page, (s) => s.arranger.positionOf('campfire')))!;
  await drag(20 * 32, 14 * 32 - 6, fire.x, fire.y - 6);
  // Phaser อ่านการแตะในเฟรมถัดไป จึงรอให้ของกลับที่เดิม
  await expect.poll(() => scene(page, (s) => s.arranger.positionOf('food_tray_3'))).toEqual({ x: 20 * 32, y: 14 * 32 });
  expect((await state(page)).placed.food_tray_3).toEqual({ x: 20 * 32, y: 14 * 32 });
});

test('the big tree inside the third land goes away when that land is bought', async ({ page }) => {
  await open(page);
  const trees = () => page.evaluate(() => (window as unknown as { __game: { scene: { getScene(k: string): { children: { list: { texture?: { key: string }; x: number; y: number; active: boolean }[] } } } } }).__game.scene.getScene('Base').children.list.filter((c) => c.texture?.key.startsWith('tree_big') && c.x > 12 * 32 && c.x < 16 * 32 && c.y > 3.5 * 32 && c.y < 9 * 32).length);
  expect(await trees()).toBeGreaterThan(0);
  await addCoins(page, 60000);
  for (const x of [221, 349, 477]) {
    await page.evaluate((px) => (window as unknown as { __state: TestState }).__state.movePlayer({ x: px, y: 290 }), x);
    await expect(page.locator('#action-button')).toHaveAttribute('aria-label', 'ซื้อที่ดิน');
    await page.locator('#action-button').click();
    await page.locator('#land-yes').click();
  }
  expect((await state(page)).land.owned).toBe(3);
  await expect.poll(trees).toBe(0);
});

test('the Gio album opens a photo for each treat flavour he has eaten', async ({ page }) => {
  await open(page);
  const world = await state(page);
  await page.evaluate((w) => (window as unknown as { __state: TestState }).__state.setWorld({ ...w, gio: { ...w.gio, album: ['treat_tuna'] } }), world);
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="album"]').click();
  await expect(page.locator('#album-book')).toBeVisible();
  await expect(page.locator('.al-pol')).toHaveCount(4);
  await expect(page.locator('.al-pol[data-album="treat_tuna"]')).not.toHaveClass(/is-locked/);
  await expect(page.locator('.al-pol[data-album="treat_salmon"]')).toHaveClass(/is-locked/);
  await expect(page.locator('.al-count')).toContainText('1/4');
});

test('the test button in settings gives sugar stars and logs them', async ({ page }) => {
  await open(page);
  const before = (await state(page)).wallet.stars;
  await page.locator('#settings-button').click();
  await expect(page.locator('#test-stars')).toBeVisible();
  await page.locator('#test-stars').click();
  expect((await state(page)).wallet.stars).toBe(before + 100);
});
