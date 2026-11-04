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

/** ถือคันเบ็ดช่อง 5 เลือกเหยื่อในแถบเหนือช่อง แล้วกดปุ่มกระทำที่ริมบ่อ */
async function cast(page: Page, bait: string): Promise<void> {
  await page.locator('[data-tool="rod"]').click();
  await expect(page.locator('#bait-strip')).toBeVisible();
  await page.locator(`.bait-slot[data-bait="${bait}"]`).click();
  await expect(page.locator(`.bait-slot[data-bait="${bait}"]`)).toHaveClass(/is-selected/);
  const act = page.locator('#action-button');
  await expect(act).toContainText('ตกปลา');
  await expect(act).toHaveAttribute('data-icon', 'fish');
  await act.click();
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

test('auto-fish reels in by itself, and with "same bait" on it casts again until the bait runs out', async ({ page }) => {
  test.setTimeout(600_000);
  await open(page);
  await page.locator('#settings-button').click();
  const toggle = page.locator('#auto-fish-toggle');
  const rebait = page.locator('#auto-rebait-toggle');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(rebait).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(rebait).toBeVisible();
  await rebait.click();
  await expect(rebait).toHaveAttribute('aria-checked', 'true');
  await page.locator('#settings-close').click();
  // เหลือข้าวโพด 2 ชิ้น ตกจนหมดแล้วหยุดเอง
  const bag = (await state(page)).bag.map((stack) => (stack.item === 'bait_corn' ? { ...stack, count: 2 } : stack));
  await change(page, { hour: 6.2, bag });
  await standOnDock(page);
  await cast(page, 'corn');
  await expect.poll(() => count(page, 'bait_corn'), { timeout: 480_000 }).toBe(0);
  await expect(page.locator('#player-bubble')).toContainText('เหยื่อหมด', { timeout: 60_000 });
  const world = await state(page);
  expect(world.hour).toBeGreaterThanOrEqual(7.2);
});

test('fishing locks walking, and pressing the button again puts the rod away without using time or bait', async ({ page }) => {
  await open(page);
  await standOnDock(page);
  await cast(page, 'corn');
  await page.waitForTimeout(1200);
  const act = page.locator('#action-button');
  await expect(act).toContainText('หยุด');
  const before = await page.evaluate(() => ({ ...(window as unknown as { __state: TestState }).__state.world }) as unknown as { player: { x: number; y: number } });
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowDown');
  const still = await page.evaluate(() => (window as unknown as { __state: { world: { player: { x: number; y: number } } } }).__state.world.player);
  expect(Math.hypot(still.x - before.player.x, still.y - before.player.y)).toBeLessThan(1);
  const hour = (await state(page)).hour;
  await act.click();
  await expect(act).toContainText('ตกปลา');
  expect((await state(page)).hour).toBeLessThan(hour + 0.1);
  expect(await count(page, 'bait_corn')).toBe(5);
});

test('the bait strip shows the real bait pictures, counts, and greys out bait she does not have', async ({ page }) => {
  await open(page);
  await page.keyboard.press('5');
  await expect(page.locator('#bait-strip')).toBeVisible();
  await expect(page.locator('.bait-slot')).toHaveCount(3);
  await expect(page.locator('.bait-slot[data-bait="corn"] img')).toHaveAttribute('src', /items\/bait_corn\.png/);
  await expect(page.locator('.bait-slot[data-bait="corn"]')).toContainText('×5');
  await expect(page.locator('.bait-slot[data-bait="normal"]')).toBeDisabled();
  await page.keyboard.press('1');
  await expect(page.locator('#bait-strip')).toBeHidden();
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
  // ไม่ได้ถือคันเบ็ด ที่ริมบ่อปุ่มกระทำคืออาบน้ำ
  const act = page.locator('#action-button');
  await expect(act).toContainText('อาบน้ำ');
  await expect(act).toHaveAttribute('data-icon', 'bath');
  await act.click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __game: { scene: { getScene(k: string): { children: { getByName(n: string): { anims: { currentAnim: { key: string } | null } } } } } } }).__game.scene.getScene('Base').children.getByName('player').anims.currentAnim?.key))
    .toMatch(/^anim_wash_south_/);
  await page.waitForTimeout(4000);
  // เดินไม่ทำให้หยุดอาบ ต้องกดปุ่มเดิม
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowDown');
  await expect(act).toContainText('หยุด');
  await expect(act).toHaveAttribute('data-icon', 'bath');
  await act.click();
  // อาบไปราว 2–3 นาทีเกม ได้สะอาดตามสัดส่วน
  await expect.poll(async () => (await state(page)).gauges.cleanliness).toBeGreaterThan(20);
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

test('the action label is a rounded pill that stays at least 4 game pixels above the bottom edge', async ({ page }) => {
  await open(page);
  await standOnDock(page);
  const label = page.locator('.action-button__label');
  await expect(label).toHaveText('อาบน้ำ');
  const { bottom, screen, px, clip } = await label.evaluate((node) => {
    const root = node.closest('[style*="--px"]') as HTMLElement;
    return {
      bottom: node.getBoundingClientRect().bottom,
      screen: window.innerHeight,
      px: parseFloat(getComputedStyle(root).getPropertyValue('--px')),
      clip: getComputedStyle(node, '::after').clipPath,
    };
  });
  expect(screen - bottom).toBeGreaterThanOrEqual(px * 4 - 0.5);
  expect(clip).toContain('polygon');
});
