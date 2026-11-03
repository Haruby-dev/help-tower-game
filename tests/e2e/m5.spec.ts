import { expect, test, type Page } from '@playwright/test';

interface PondWorld {
  hour: number;
  bag: { item: string; count: number }[];
  gauges: { fullness: number; happiness: number; cleanliness: number; homesickness: number };
  weather: string;
  fishing: { rods: string[]; caught: Record<string, number> };
  wallet: { coins: number; stars: number };
}
interface TestState {
  world: PondWorld;
  setWorld(world: unknown): void;
  movePlayer(point: { x: number; y: number }): void;
}

test.setTimeout(240_000);
/** เครื่องทดสอบที่ไม่มีการ์ดจอวาดได้ราว 9 เฟรมต่อวินาที เวลาในเกมจึงเดินช้ากว่าจริงหลายเท่า รอปลานานกว่าบนมือถือจริงมาก */
const BITE_WAIT = { timeout: 90_000 };

const state = (page: Page): Promise<PondWorld> => page.evaluate(() => (window as unknown as { __state: TestState }).__state.world);

const count = async (page: Page, prefix: string): Promise<number> =>
  (await state(page)).bag.filter((stack) => stack.item.startsWith(prefix)).reduce((sum, stack) => sum + stack.count, 0);

const change = (page: Page, changes: Partial<PondWorld>): Promise<void> =>
  page.evaluate((next) => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, ...next });
  }, changes);

async function open(page: Page): Promise<void> {
  await page.goto('/help-tower-game/?test');
  await page.waitForFunction(() => (window as unknown as { __game?: { scene: { isActive(k: string): boolean } } }).__game?.scene.isActive('Base'));
}

/** ปลายท่าน้ำ ท่าน้ำชี้ไปทางเหนือลงบ่อ ตำแหน่งอยู่ใน base-layout.json */
const standOnDock = (page: Page): Promise<void> =>
  page.evaluate(() => (window as unknown as { __state: TestState }).__state.movePlayer({ x: 752, y: 600 }));

/** เปิดหน้าเลือกเหยื่อที่ริมบ่อแล้วเหวี่ยงเบ็ด */
async function cast(page: Page, bait: string): Promise<void> {
  const act = page.locator('#action-button');
  await expect(act).toContainText('ตกปลา');
  await act.click();
  await expect(page.locator('#pond-menu')).toBeVisible();
  await page.locator(`[data-bait="${bait}"]`).click();
  await expect(page.locator('#pond-menu')).toBeHidden();
}

test('catches a fish at the dock by tapping when the "!" shows, using up one bait', async ({ page }) => {
  await open(page);
  await change(page, { hour: 12, weather: 'sunny' });
  await standOnDock(page);
  const bait = await count(page, 'bait_cloud_lettuce');
  await cast(page, 'cloud_lettuce');
  const act = page.locator('#action-button');
  await expect(act).toContainText('ดึง', BITE_WAIT);
  // กด E แทนการคลิก เพราะคลิกของเครื่องทดสอบช้ากว่าช่วงที่ปลาติดเบ็ด
  await page.keyboard.press('e');
  await expect.poll(() => count(page, 'fish_') .then(async (fish) => fish + (await count(page, 'chest_'))), { timeout: 30_000 }).toBe(1);
  expect(await count(page, 'bait_cloud_lettuce')).toBe(bait - 1);
  const after = await state(page);
  expect(after.hour).toBeGreaterThanOrEqual(12.5);
  // ผักกาดเมฆตอนแดดออกยังไม่มีปลากะพงเมฆ จึงได้ปลาทั่วไปแทน
  expect(after.fishing.caught.cloud_bass).toBeUndefined();
});

test('lets the fish get away without losing the bait when the tap is late', async ({ page }) => {
  await open(page);
  await standOnDock(page);
  const bait = await count(page, 'bait_corn');
  const hour = (await state(page)).hour;
  await cast(page, 'corn');
  const act = page.locator('#action-button');
  await expect(act).toContainText('ดึง', BITE_WAIT);
  await expect(act).not.toContainText('ดึง', { timeout: 30_000 });
  await expect.poll(() => state(page).then((world) => world.hour), { timeout: 30_000 }).toBeGreaterThanOrEqual(hour + 0.5);
  expect(await count(page, 'bait_corn')).toBe(bait);
  expect(await count(page, 'fish_')).toBe(0);
});

test('auto-fish from Settings reels in by itself and catches the meow salmon with corn bait in the morning', async ({ page }) => {
  await open(page);
  await page.locator('#settings-button').click();
  const toggle = page.locator('#auto-fish-toggle');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.locator('#settings-close').click();
  await change(page, { hour: 6.2 });
  await standOnDock(page);
  await cast(page, 'corn');
  await expect.poll(() => count(page, 'fish_').then(async (fish) => fish + (await count(page, 'chest_'))), BITE_WAIT).toBe(1);
  const world = await state(page);
  if (world.bag.some((stack) => stack.item.startsWith('fish_'))) expect(world.fishing.caught.meow_salmon).toBe(1);
  expect(world.gauges.happiness).toBe(100);
});

test('walking away while waiting puts the rod away without using time or bait', async ({ page }) => {
  await open(page);
  await standOnDock(page);
  await cast(page, 'corn');
  await page.waitForTimeout(1200);
  const hour = (await state(page)).hour;
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowDown');
  expect((await state(page)).hour).toBeLessThan(hour + 0.1);
  expect(await count(page, 'bait_corn')).toBe(5);
  await expect(page.locator('#action-button')).not.toContainText('ดึง');
});

test('makes normal bait from a vegetable and bathes at the pond', async ({ page }) => {
  await open(page);
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="inventory"]').click();
  await page.locator('[data-item="produce_scallion"]').click();
  await page.locator('#bag-make-bait').click();
  expect(await count(page, 'bait_normal')).toBe(3);
  await page.keyboard.press('Escape');

  await change(page, { gauges: { fullness: 90, happiness: 90, cleanliness: 20, homesickness: 0 } });
  await standOnDock(page);
  const act = page.locator('#action-button');
  await expect(act).toContainText('ตกปลา');
  await act.click();
  await expect(page.locator('[data-bait="normal"]')).toContainText('×3');
  await page.locator('#pond-bath').click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __game: { scene: { getScene(k: string): { children: { getByName(n: string): { anims: { currentAnim: { key: string } | null } } } } } } }).__game.scene.getScene('Base').children.getByName('player').anims.currentAnim?.key))
    .toMatch(/^anim_wash_south_/);
  await page.waitForTimeout(4000);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowDown');
  // อาบไปราว 2–3 นาทีเกม ได้สะอาดตามสัดส่วน
  expect((await state(page)).gauges.cleanliness).toBeGreaterThan(20);
});

test('opens a golden chest from the bag, pops out the rewards and keeps the cosmetics in the collection tab', async ({ page }) => {
  await open(page);
  await change(page, { bag: [{ item: 'chest_golden', count: 1 }] });
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="inventory"]').click();
  await page.locator('[data-item="chest_golden"]').click();
  await page.locator('#bag-open-chest').click();
  await expect(page.locator('#chest-window')).toBeVisible();
  await expect(page.locator('.chest-reward')).toHaveCount(4, { timeout: 10_000 });
  await expect(page.locator('[data-reward="coins"]')).toContainText('เหรียญ');
  const world = await state(page);
  expect(world.wallet.coins).toBeGreaterThanOrEqual(100);
  expect(world.bag.some((stack) => stack.item === 'chest_golden')).toBe(false);
  await page.locator('#chest-take').click();
  await expect(page.locator('#chest-window')).toBeHidden();
  await page.locator('[data-bag-tab="collection"]').click();
  expect(await page.locator('[data-collection="cosmetic"]').count()).toBeGreaterThanOrEqual(4);
});

test('shows the day weather on the phone and draws rain', async ({ page }) => {
  await open(page);
  await change(page, { weather: 'rain' });
  await page.locator('#phone-button').click();
  await expect(page.locator('#lock-screen')).toContainText('ฝนตก');
  await expect(page.locator('#lock-screen [data-weather-icon]')).toHaveAttribute('src', /weather_rain/);
});
