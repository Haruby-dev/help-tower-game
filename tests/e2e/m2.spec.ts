import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __state?: {
      world: { day: number; hour: number; gauges: { fullness: number } };
      setWorld(world: unknown): void;
      clockRunning: boolean;
    };
  }
}

const TILE = 32;

async function open(page: Page, url = '/help-tower-game/?test'): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => window.__game?.scene.isActive('Base'));
}

const world = (page: Page): Promise<{ day: number; hour: number; fullness: number; x: number; y: number }> =>
  page.evaluate(() => {
    const state = window.__state!;
    const body = window.__game!.scene.getScene('Base').children.getByName('player_body') as import('phaser').GameObjects.Zone;
    return { day: state.world.day, hour: state.world.hour, fullness: state.world.gauges.fullness, x: body.x, y: body.y };
  });

const teleport = (page: Page, x: number, y: number): Promise<void> =>
  page.evaluate(
    ([tx, ty]) => {
      const scene = window.__game!.scene.getScene('Base');
      const body = scene.children.getByName('player_body') as import('phaser').GameObjects.Zone;
      (body.body as import('phaser').Physics.Arcade.Body).reset(tx ?? 0, ty ?? 0);
    },
    [x, y],
  );

test('shows the portrait with 15 beads, the coin pill and the phone clock', async ({ page }) => {
  await open(page);
  await expect(page.locator('#phone-cover-time')).toContainText('06:');
  await expect(page.locator('.bead')).toHaveCount(15);
  await expect(page.locator('#coin-pill')).toContainText('0');
  await expect(page.locator('#portrait')).toHaveAttribute('data-mood', 'happy');
  const before = await world(page);
  await expect.poll(async () => (await world(page)).hour).toBeGreaterThan(before.hour);
  await expect.poll(async () => (await world(page)).fullness).toBeLessThan(100);
});

test('the clock stops while the phone is open', async ({ page }) => {
  await open(page);
  await page.locator('#phone-button').click();
  await page.waitForTimeout(100);
  const paused = await world(page);
  await page.waitForTimeout(400);
  expect((await world(page)).hour).toBe(paused.hour);
  await page.locator('#phone-close').click();
  await expect.poll(async () => (await world(page)).hour).toBeGreaterThan(paused.hour);
});

test('sleeps at the door, starts the next day, and the save loads after reopening', async ({ page }) => {
  await open(page, '/help-tower-game/?test&saves');
  await expect(page.locator('.slot-button')).toHaveCount(3);
  await expect(page.locator('[data-slot="2"]')).toContainText('เริ่มใหม่');
  await page.locator('[data-slot="2"]').click();

  await teleport(page, 24 * TILE, 8.75 * TILE);
  const action = page.locator('#action-button');
  await expect(action).toBeVisible();
  const box = (await action.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await action.click();

  await expect(page.locator('#rest-curtain')).toBeVisible();
  await expect(page.locator('#rest-curtain')).toBeHidden();
  const morning = await world(page);
  expect(morning.day).toBe(2);
  expect(morning.hour).toBeLessThan(7);

  await open(page, '/help-tower-game/?test&saves');
  await expect(page.locator('[data-slot="2"]')).toContainText('2');
  await page.locator('[data-slot="2"]').click();
  await expect.poll(async () => (await world(page)).day).toBe(2);
  const loaded = await world(page);
  expect(Math.abs(loaded.x - 24 * TILE)).toBeLessThan(40);
});

test('no action button away from the door', async ({ page }) => {
  await open(page);
  await expect(page.locator('#action-button')).toBeHidden();
});

test('fainting wakes the player at home and skips time', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const state = window.__state!;
    state.setWorld({ ...state.world, hour: 10, gauges: { ...state.world.gauges, fullness: 0.01 } });
  });
  await expect(page.locator('#rest-curtain')).toBeVisible();
  const after = await world(page);
  expect(after.hour).toBeGreaterThanOrEqual(20);
  expect(after.fullness).toBeGreaterThanOrEqual(29);
  expect(Math.abs(after.x - 24 * TILE)).toBeLessThan(2);
});

test('exports a save file', async ({ page }) => {
  await open(page);
  await page.locator('#phone-button').click();
  await page.locator('[data-app="settings"]').click();
  const download = page.waitForEvent('download');
  await page.locator('#save-export').click();
  expect((await download).suggestedFilename()).toContain('help-tower-save-1-day-1');
});

test('opens the phone with 11 apps and placeholders for later systems', async ({ page }) => {
  await open(page);
  await page.locator('#phone-button').click();
  await expect(page.locator('.phone-app')).toHaveCount(11);
  for (const box of await page.locator('.phone-app').evaluateAll((apps) => apps.map((app) => ({ width: (app as HTMLElement).offsetWidth, height: (app as HTMLElement).offsetHeight })))) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.locator('[data-app="shop"]').click();
  await expect(page.locator('.phone-page__empty')).toBeVisible();
  await page.locator('[data-app="support"]').click();
  await expect(page.locator('.phone-content')).not.toContainText('฿');
  await page.locator('#phone-close').click();
  await expect(page.locator('#phone')).toBeHidden();
});

test('every money change shows in the wallet log and the coin pill', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const change = (window as unknown as { __changeMoney: (c: string, a: number, l: string, k: string) => void }).__changeMoney;
    change('coins', 1250, 'wallet.test_income', 'wallet.category_test');
    change('stars', 38, 'wallet.test_income', 'wallet.category_test');
  });
  await expect(page.locator('#coin-pill')).toContainText('1,250');
  await page.locator('#phone-button').click();
  await expect(page.locator('[data-balance="coins"]')).toHaveText('1,250');
  await expect(page.locator('[data-balance="stars"]')).toHaveText('38');
  await expect(page.locator('.wallet-entry')).toHaveCount(2);
  await expect(page.locator('#wallet-net')).toHaveText('+1,250');
});

test('faces, red beads, the warning bubble and stink lines follow the gauges', async ({ page }) => {
  await open(page);
  const setGauges = (fullness: number, cleanliness: number): Promise<void> =>
    page.evaluate(
      ([full, clean]) => {
        const state = window.__state!;
        state.setWorld({ ...state.world, gauges: { ...state.world.gauges, fullness: full, cleanliness: clean } });
      },
      [fullness, cleanliness],
    );
  await setGauges(50, 100);
  await expect(page.locator('#portrait')).toHaveAttribute('data-mood', 'normal');
  await setGauges(25, 20);
  await expect(page.locator('#portrait')).toHaveAttribute('data-mood', 'tired');
  await expect(page.locator('#portrait')).toHaveClass(/portrait--dirty/);
  await expect(page.locator('.bead--pulse')).toHaveCount(2);
  await setGauges(10, 100);
  await expect(page.locator('#portrait')).toHaveAttribute('data-mood', 'faint');
  await expect(page.locator('.bead--fullness.bead--alert')).toHaveCount(5);
  await expect(page.locator('#player-bubble')).toBeVisible();
  await expect(page.locator('#player-bubble')).toContainText('หิว');
});

test('Tab and Esc open and close the phone on a keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  await open(page);
  await page.keyboard.press('Tab');
  await expect(page.locator('#phone')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#phone')).toBeHidden();
});
