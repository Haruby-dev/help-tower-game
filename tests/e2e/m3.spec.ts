import { expect, test, type Page } from '@playwright/test';

interface FarmWorld {
  day: number;
  bag: { item: string; count: number }[];
  farm: { plots: { tilled: boolean; watered: boolean; crop: { id: string; daysGrown: number } | null }[] };
}

const state = (page: Page): Promise<FarmWorld> =>
  page.evaluate(() => (window as unknown as { __state: { world: FarmWorld } }).__state.world);

// ท่าทำสวนเดินตามเฟรม เครื่องทดสอบที่ไม่มีการ์ดจอวาดช้ากว่าเครื่องจริงมาก
test.setTimeout(180_000);

async function open(page: Page): Promise<void> {
  await page.goto('/help-tower-game/?test');
  await page.waitForFunction(() => (window as unknown as { __game?: { scene: { isActive(k: string): boolean } } }).__game?.scene.isActive('Base'));
}

/** ยืนกลางแปลงช่องแรก ช่องเท่ากับเลขในแผนที่ 5,10 */
async function standOnFirstPlot(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __state: { movePlayer(p: { x: number; y: number }): void } }).__state.movePlayer({ x: 176, y: 336 });
  });
}

const count = async (page: Page, item: string): Promise<number> =>
  (await state(page)).bag.filter((stack) => stack.item === item).reduce((sum, stack) => sum + stack.count, 0);

const plot0 = async (page: Page): Promise<FarmWorld['farm']['plots'][number]> => (await state(page)).farm.plots[0]!;

test('grows a scallion from seed to harvest in 3 game days and saves it', async ({ page }) => {
  await open(page);
  await expect(page.locator('#toolbar .tool-slot')).toHaveCount(4);
  for (const box of await page.locator('#toolbar .tool-slot').all()) {
    expect((await box.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  }

  // แปลงผักเป็นเมล็ดในแอปกระเป๋า
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="inventory"]').click();
  await expect(page.locator('.bag-slot')).toHaveCount(30);
  const before = await count(page, 'produce_scallion');
  await page.locator('[data-item="produce_scallion"]').click();
  await page.locator('#bag-convert').click();
  expect(await count(page, 'produce_scallion')).toBe(before - 1);
  expect(await count(page, 'seed_scallion')).toBeGreaterThanOrEqual(2);
  await page.locator('#phone-close').click();

  await standOnFirstPlot(page);
  const act = page.locator('#action-button');

  await page.locator('[data-tool="hoe"]').click();
  await expect(act).toContainText('พรวน');
  await act.click();
  await expect.poll(async () => (await plot0(page)).tilled, { timeout: 30000 }).toBe(true);

  await page.locator('[data-tool="seeds"]').click();
  await page.locator('[data-seed="scallion"]').click();
  await expect(act).toContainText('ปลูก');
  await act.click();
  await expect.poll(async () => (await plot0(page)).crop?.id, { timeout: 30000 }).toBe('scallion');

  await page.locator('[data-tool="can"]').click();
  for (let day = 0; day < 3; day += 1) {
    await act.click();
    await expect.poll(async () => (await plot0(page)).watered, { timeout: 30000 }).toBe(true);
    await page.evaluate(() => {
      const s = (window as unknown as { __state: { world: FarmWorld; setWorld(w: unknown): void } }).__state;
      s.setWorld({ ...s.world, hour: 25.99 });
    });
    await expect.poll(async () => (await state(page)).day, { timeout: 30000 }).toBe(day + 2);
    await page.waitForFunction(() => (window as unknown as { __state: { clockRunning: boolean } }).__state.clockRunning);
    await standOnFirstPlot(page);
  }
  expect((await plot0(page)).crop?.daysGrown).toBe(3);

  await page.locator('[data-tool="sickle"]').click();
  await expect(act).toContainText('เก็บ');
  const held = await count(page, 'produce_scallion');
  await act.click();
  await expect.poll(() => count(page, 'produce_scallion'), { timeout: 30000 }).toBeGreaterThan(held);
  expect((await plot0(page)).crop).toBeNull();
});

test('digging up a plant asks first, and saying no keeps it', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __state: { world: FarmWorld; setWorld(w: unknown): void } }).__state;
    const plots = s.world.farm.plots.map((plot, index) =>
      index === 0 ? { tilled: true, watered: false, crop: { id: 'chili', daysGrown: 1, harvests: 0 } } : plot,
    );
    s.setWorld({ ...s.world, farm: { plots } });
  });
  await standOnFirstPlot(page);
  await page.locator('[data-tool="hoe"]').click();
  const act = page.locator('#action-button');
  await act.click();
  await expect(page.locator('#dig-confirm')).toBeVisible();
  await page.locator('#dig-no').click();
  await expect(page.locator('#dig-confirm')).toBeHidden();
  expect((await plot0(page)).crop?.id).toBe('chili');
  await act.click();
  await page.locator('#dig-yes').click();
  await expect.poll(async () => (await plot0(page)).crop, { timeout: 30000 }).toBeNull();
});

test('a full bag leaves the produce on the plot and the player says so', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __state: { world: FarmWorld; setWorld(w: unknown): void } }).__state;
    const plots = s.world.farm.plots.map((plot, index) =>
      index === 0 ? { tilled: true, watered: false, crop: { id: 'scallion', daysGrown: 3, harvests: 0 } } : plot,
    );
    const bag = Array.from({ length: 30 }, () => ({ item: 'seed_rice', count: 99 }));
    s.setWorld({ ...s.world, bag, farm: { plots } });
  });
  await standOnFirstPlot(page);
  await page.locator('[data-tool="sickle"]').click();
  await page.locator('#action-button').click();
  await expect(page.locator('#player-bubble')).toContainText('กระเป๋าเต็ม');
  expect((await plot0(page)).crop?.id).toBe('scallion');
});

test('a withered plant clears with the hoe without asking', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __state: { world: FarmWorld; setWorld(w: unknown): void } }).__state;
    const plots = s.world.farm.plots.map((plot, index) =>
      index === 0 ? { tilled: true, watered: false, crop: { id: 'chili', daysGrown: 2, harvests: 4 } } : plot,
    );
    s.setWorld({ ...s.world, farm: { plots } });
  });
  await standOnFirstPlot(page);
  await page.locator('[data-tool="hoe"]').click();
  await page.locator('#action-button').click();
  await expect(page.locator('#dig-confirm')).toBeHidden();
  await expect.poll(async () => (await plot0(page)).crop, { timeout: 30000 }).toBeNull();
});

test('the bag opens unfolded with 30 slots and survives an item with no art', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __state: { world: FarmWorld; setWorld(w: unknown): void } }).__state;
    s.setWorld({ ...s.world, bag: [...s.world.bag, { item: 'produce_not_made_yet', count: 1 }] });
  });
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="inventory"]').click();
  await expect(page.locator('#phone')).toHaveAttribute('data-app', 'inventory');
  await expect(page.locator('#phone')).toHaveAttribute('data-fold', 'unfolded');
  await expect(page.locator('.bag-grid .bag-slot')).toHaveCount(30);
  await expect(page.locator('#bag-used')).toHaveText('7/30');
  await expect(page.locator('.item-missing')).toHaveCount(1);
  await page.locator('[data-bag-tab="seeds"]').click();
  await expect(page.locator('.bag-slot[data-item]')).toHaveCount(0);
  await page.locator('[data-bag-tab="produce"]').click();
  await page.locator('[data-item="produce_tomato"]').click();
  await expect(page.locator('#bag-sell')).toBeDisabled();
  await expect(page.locator('#bag-convert')).toBeEnabled();
});

test('the seed slot shows the chosen bag and its count', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __state: { world: FarmWorld; setWorld(w: unknown): void } }).__state;
    s.setWorld({ ...s.world, bag: [{ item: 'seed_blueberry', count: 12 }] });
  });
  await page.locator('[data-tool="seeds"]').click();
  await page.locator('[data-seed="blueberry"]').click();
  await expect(page.locator('[data-tool="seeds"] img').first()).toHaveAttribute('src', /seed_blueberry/);
  await expect(page.locator('.tool-slot__count')).toHaveText('12');
  await expect(page.locator('.tool-slot__key')).toHaveCount(4);
});
