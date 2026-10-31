import { expect, test, type Page } from '@playwright/test';

const GAME_URL = '/help-tower-game/?test';
const TILE = 32;

declare global {
  interface Window {
    __game?: import('phaser').Game;
  }
}

interface WorldSnapshot {
  x: number;
  y: number;
  zoom: number;
  viewX: number;
  viewY: number;
  viewWidth: number;
  viewHeight: number;
  worldWidth: number;
  worldHeight: number;
  depth: number;
  texture: string;
}

async function openGame(page: Page): Promise<void> {
  await page.goto(GAME_URL);
  await page.waitForFunction(() => window.__game?.scene.isActive('Base'));
}

function snapshot(page: Page): Promise<WorldSnapshot> {
  return page.evaluate(() => {
    const scene = window.__game!.scene.getScene('Base');
    const body = scene.children.getByName('player_body') as import('phaser').GameObjects.Zone;
    const sprite = scene.children.getByName('player') as import('phaser').GameObjects.Sprite;
    const camera = scene.cameras.main;
    return {
      x: body.x,
      y: body.y,
      zoom: camera.zoom,
      viewX: camera.worldView.x,
      viewY: camera.worldView.y,
      viewWidth: camera.worldView.width,
      viewHeight: camera.worldView.height,
      worldWidth: scene.physics.world.bounds.width,
      worldHeight: scene.physics.world.bounds.height,
      depth: sprite.depth,
      texture: sprite.texture.key,
    };
  });
}

function teleport(page: Page, x: number, y: number): Promise<void> {
  return page.evaluate(
    ([targetX, targetY]) => {
      const scene = window.__game!.scene.getScene('Base');
      const body = scene.children.getByName('player_body') as import('phaser').GameObjects.Zone;
      (body.body as import('phaser').Physics.Arcade.Body).reset(targetX ?? 0, targetY ?? 0);
    },
    [x, y],
  );
}

test.describe('keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');

  test('walks with WASD and arrow keys, then stands still', async ({ page }) => {
    await openGame(page);
    const start = await snapshot(page);

    await page.keyboard.down('d');
    await expect.poll(async () => (await snapshot(page)).x).toBeGreaterThan(start.x + 20);
    expect((await snapshot(page)).texture).toBe('player_girl_walk');
    await page.keyboard.up('d');

    await page.keyboard.down('ArrowUp');
    await expect.poll(async () => (await snapshot(page)).y).toBeLessThan(start.y - 20);
    await page.keyboard.up('ArrowUp');

    await expect.poll(async () => (await snapshot(page)).texture).toBe('player_girl_stand');
    const stopped = await snapshot(page);
    await page.waitForTimeout(200);
    expect((await snapshot(page)).x).toBe(stopped.x);
  });

  test('cannot walk into the pond', async ({ page }) => {
    await openGame(page);
    await teleport(page, 27 * TILE, 14 * TILE);
    await page.keyboard.down('s');
    await page.waitForTimeout(1500);
    await page.keyboard.up('s');
    const { y } = await snapshot(page);
    expect(y).toBeLessThan(16 * TILE);
    expect(y).toBeGreaterThan(14 * TILE);
  });

  test('cannot walk through the cave', async ({ page }) => {
    await openGame(page);
    await teleport(page, 5 * TILE, 8 * TILE);
    await page.keyboard.down('w');
    await page.waitForTimeout(1500);
    await page.keyboard.up('w');
    expect((await snapshot(page)).y).toBeGreaterThan(6 * TILE);
  });

  test('stops at the edge of the map with the camera inside it', async ({ page }) => {
    await openGame(page);
    await teleport(page, TILE, 8 * TILE);
    await page.keyboard.down('a');
    await page.waitForTimeout(800);
    await page.keyboard.up('a');
    const state = await snapshot(page);
    expect(state.x).toBeGreaterThanOrEqual(8);
    expect(state.viewX).toBeGreaterThanOrEqual(0);
    expect(state.viewY).toBeGreaterThanOrEqual(0);
    expect(state.viewX + state.viewWidth).toBeLessThanOrEqual(state.worldWidth);
    expect(Number.isInteger(state.zoom)).toBe(true);
  });

  test('camera follows the player and depth tracks the feet', async ({ page }) => {
    await openGame(page);
    const before = await snapshot(page);
    await page.keyboard.down('s');
    await expect.poll(async () => (await snapshot(page)).y).toBeGreaterThan(before.y + 40);
    await page.keyboard.up('s');
    const after = await snapshot(page);
    expect(after.viewY).toBeGreaterThan(before.viewY);
    expect(after.depth).toBeGreaterThan(before.depth);
  });

  test('has no joystick on a mouse screen', async ({ page }) => {
    await openGame(page);
    await expect(page.locator('#joystick')).toHaveCount(0);
  });
});

test.describe('touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch screens only');

  test('walks with the joystick and stops on release', async ({ page }) => {
    await openGame(page);
    const joystick = page.locator('#joystick');
    await expect(joystick).toBeVisible();
    const box = (await joystick.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);

    const start = await snapshot(page);
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 50, centerY);
    await expect.poll(async () => (await snapshot(page)).x).toBeGreaterThan(start.x + 20);
    await page.mouse.up();

    await expect.poll(async () => (await snapshot(page)).texture).toBe('player_girl_stand');
    const stopped = await snapshot(page);
    await page.waitForTimeout(200);
    expect((await snapshot(page)).x).toBe(stopped.x);
  });

  test('does not keep walking after rotating mid-drag', async ({ page }) => {
    await openGame(page);
    const landscape = page.viewportSize()!;
    const box = (await page.locator('#joystick').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2);
    await page.setViewportSize({ width: landscape.height, height: landscape.width });
    await expect(page.locator('#rotate-prompt')).toBeVisible();
    await page.setViewportSize(landscape);
    await expect(page.locator('#rotate-prompt')).toBeHidden();
    await expect.poll(async () => (await snapshot(page)).texture).toBe('player_girl_stand');
    const stopped = await snapshot(page);
    await page.waitForTimeout(300);
    expect((await snapshot(page)).x).toBe(stopped.x);
    await page.mouse.up();
  });

  test('keeps the player still while paused in portrait', async ({ page }) => {
    await openGame(page);
    const landscape = page.viewportSize()!;
    await page.setViewportSize({ width: landscape.height, height: landscape.width });
    await expect(page.locator('#rotate-prompt')).toBeVisible();
    const paused = await snapshot(page);
    await page.waitForTimeout(200);
    expect((await snapshot(page)).x).toBe(paused.x);
    await page.setViewportSize(landscape);
    await expect(page.locator('#rotate-prompt')).toBeHidden();
  });
});

test('every sprite is drawn at 1:1 with no scaling', async ({ page }) => {
  await openGame(page);
  const scaled = await page.evaluate(() => {
    const scene = window.__game!.scene.getScene('Base');
    return scene.children.list
      .filter((child): child is import('phaser').GameObjects.Sprite => 'texture' in child)
      .filter(
        (sprite) =>
          sprite.scaleX !== 1 ||
          sprite.scaleY !== 1 ||
          sprite.displayWidth !== sprite.frame.width ||
          sprite.displayHeight !== sprite.frame.height,
      )
      .map((sprite) => sprite.texture.key);
  });
  expect(scaled).toEqual([]);
});

test('the player cannot walk through Gio', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  await openGame(page);
  const gio = await page.evaluate(() => {
    const scene = window.__game!.scene.getScene('Base') as unknown as {
      gio: { sitRemainingMs: number };
      children: import('phaser').GameObjects.DisplayList;
    };
    scene.gio.sitRemainingMs = Number.MAX_SAFE_INTEGER;
    const body = scene.children.getByName('gio_body') as import('phaser').GameObjects.Zone;
    return { x: body.x, y: body.y };
  });
  await teleport(page, gio.x - 40, gio.y);
  await page.keyboard.down('d');
  await page.waitForTimeout(1200);
  await page.keyboard.up('d');
  const { x } = await snapshot(page);
  expect(x).toBeLessThan(gio.x);
});

test('Gio hops around near the burrow without leaving play', async ({ page }) => {
  await openGame(page);
  const readGio = (): Promise<{ x: number; y: number; texture: string }> =>
    page.evaluate(() => {
      const scene = window.__game!.scene.getScene('Base');
      const body = scene.children.getByName('gio_body') as import('phaser').GameObjects.Zone;
      const sprite = scene.children.getByName('gio') as import('phaser').GameObjects.Sprite;
      return { x: body.x, y: body.y, texture: sprite.texture.key };
    });

  // ท่ากระโดดสั้นกว่าระยะการ poll จึงนับจากเหตุการณ์ของภาพแทนการเปิดดูเป็นช่วง ๆ
  await page.evaluate(() => {
    const scene = window.__game!.scene.getScene('Base');
    const sprite = scene.children.getByName('gio') as import('phaser').GameObjects.Sprite;
    sprite.on('animationstart', (animation: { key: string }) => {
      if (animation.key.startsWith('gio_hop')) document.documentElement.dataset.gioHopped = 'yes';
    });
  });
  await page.waitForFunction(() => document.documentElement.dataset.gioHopped === 'yes', undefined, {
    timeout: 15_000,
  });
  await expect.poll(async () => (await readGio()).texture, { timeout: 5_000 }).toBe('gio_idle');
  const gio = await readGio();
  expect(Math.hypot(gio.x - 27.5 * TILE, gio.y - 9 * TILE)).toBeLessThan(200);
});
