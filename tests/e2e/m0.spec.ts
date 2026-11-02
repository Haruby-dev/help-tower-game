import { expect, test, type Page } from '@playwright/test';

const GAME_URL = '/help-tower-game/?test';

interface GameSnapshot {
  canvasWidth: number;
  canvasHeight: number;
  devicePixelRatio: number;
  innerWidth: number;
  innerHeight: number;
  zoom: number;
  gioFrame: string | number;
  isPaused: boolean;
}

async function openGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => window.__game?.scene.isActive('Base'));
  return errors;
}

function readSnapshot(page: Page): Promise<GameSnapshot> {
  return page.evaluate(() => {
    const game = window.__game!;
    const scene = game.scene.getScene('Base');
    const gio = scene.children.getByName('gio') as import('phaser').GameObjects.Sprite;
    return {
      canvasWidth: game.canvas.width,
      canvasHeight: game.canvas.height,
      devicePixelRatio: window.devicePixelRatio,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      zoom: scene.cameras.main.zoom,
      gioFrame: gio.frame.name,
      isPaused: game.isPaused,
    };
  });
}

test('renders at a whole-number zoom with no errors', async ({ page, isMobile }) => {
  const errors = await openGame(page);
  const snapshot = await readSnapshot(page);

  expect(snapshot.canvasWidth).toBe(Math.floor(snapshot.innerWidth * snapshot.devicePixelRatio));
  expect(snapshot.canvasHeight).toBe(Math.floor(snapshot.innerHeight * snapshot.devicePixelRatio));
  expect(Number.isInteger(snapshot.zoom)).toBe(true);
  expect(snapshot.zoom).toBe(
    Math.floor(Math.min(snapshot.canvasWidth / 640, snapshot.canvasHeight / 360)) + (isMobile ? 1 : 0),
  );
  expect(errors).toEqual([]);
});

test('Thai text uses the bundled Mali font', async ({ page }) => {
  await openGame(page);
  const label = page.locator('#phone-cover-time');
  await expect(label).toBeVisible();
  await expect(label).toHaveCSS('font-family', /Mali/);
  await page.evaluate(() => document.fonts.ready);
  const fontLoaded = await page.evaluate(() =>
    [...document.fonts].some((font) => font.family.includes('Mali') && font.status === 'loaded'),
  );
  expect(fontLoaded).toBe(true);
});

test('Fullscreen button is at least 44px, or absent where fullscreen is unsupported', async ({ page }) => {
  await openGame(page);
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="settings"]').click();
  const button = page.locator('#fullscreen-button');
  if (!(await page.evaluate(() => document.fullscreenEnabled))) {
    await expect(button).toHaveCount(0);
    return;
  }
  const box = await button.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
});

test('Portrait pauses the game on touch screens and landscape resumes it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch screens only');
  await openGame(page);
  const landscape = page.viewportSize()!;
  const prompt = page.locator('#rotate-prompt');
  await expect(prompt).toBeHidden();

  await page.setViewportSize({ width: landscape.height, height: landscape.width });
  await expect(prompt).toBeVisible();
  await expect(page.locator('.rotate-prompt__gio')).toBeVisible();
  await expect.poll(async () => (await readSnapshot(page)).isPaused).toBe(true);

  await page.setViewportSize(landscape);
  await expect(prompt).toBeHidden();
  await expect.poll(async () => (await readSnapshot(page)).isPaused).toBe(false);
  await expect.poll(async () => (await readSnapshot(page)).gioFrame, { timeout: 3000 }).not.toBe(
    (await readSnapshot(page)).gioFrame,
  );
});

test('A narrow desktop window keeps running and stays sharp', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  await openGame(page);
  await page.setViewportSize({ width: 700, height: 900 });
  await expect(page.locator('#rotate-prompt')).toBeHidden();
  await expect.poll(async () => (await readSnapshot(page)).canvasWidth).toBe(700);
  const snapshot = await readSnapshot(page);
  expect(snapshot.isPaused).toBe(false);
  expect(snapshot.zoom).toBe(1);
});

test('A game opened in portrait starts once the phone is rotated', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch screens only');
  const landscape = page.viewportSize()!;
  await page.setViewportSize({ width: landscape.height, height: landscape.width });
  await page.goto('/help-tower-game/?test');
  await expect(page.locator('#rotate-prompt')).toBeVisible();
  await expect(page.locator('.rotate-prompt__hint')).toBeVisible();
  await page.setViewportSize(landscape);
  await expect(page.locator('#rotate-prompt')).toBeHidden();
  await page.waitForFunction(() => window.__game?.scene.isActive('Base'), undefined, { timeout: 60_000 });
});
