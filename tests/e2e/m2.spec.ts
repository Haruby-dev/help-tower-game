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

test('shows the day, time and 3 gauges, and the clock runs', async ({ page }) => {
  await open(page);
  await expect(page.locator('#status-clock')).toContainText('06:');
  await expect(page.locator('.gauge')).toHaveCount(3);
  const before = await world(page);
  await expect.poll(async () => (await world(page)).hour).toBeGreaterThan(before.hour);
  await expect.poll(async () => (await world(page)).fullness).toBeLessThan(100);
});

test('the clock stops while settings are open', async ({ page }) => {
  await open(page);
  await page.locator('#settings-button').click();
  await page.waitForTimeout(100);
  const paused = await world(page);
  await page.waitForTimeout(400);
  expect((await world(page)).hour).toBe(paused.hour);
  await page.keyboard.press('Escape');
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
  await page.locator('#settings-button').click();
  const download = page.waitForEvent('download');
  await page.locator('#save-export').click();
  expect((await download).suggestedFilename()).toContain('help-tower-save-1-day-1');
});
