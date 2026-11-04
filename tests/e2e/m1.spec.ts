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
    await teleport(page, 25 * TILE, 14 * TILE);
    await page.keyboard.down('s');
    await page.waitForTimeout(1500);
    await page.keyboard.up('s');
    const { y } = await snapshot(page);
    expect(y).toBeLessThan(15.5 * TILE);
    expect(y).toBeGreaterThanOrEqual(14 * TILE);
  });

  test('cannot walk through the house', async ({ page }) => {
    await openGame(page);
    await teleport(page, 24 * TILE, 9.2 * TILE);
    await page.keyboard.down('w');
    await page.waitForTimeout(1500);
    await page.keyboard.up('w');
    expect((await snapshot(page)).y).toBeGreaterThan(8.1 * TILE);
  });

  test('reaches the plateau around the left end but cannot walk through the cliff', async ({ page }) => {
    await openGame(page);
    await teleport(page, 18.8 * TILE, 2.4 * TILE);
    await page.keyboard.down('d');
    // จอใหญ่บนเครื่องที่ทำงานหนักเดินช้าลง จึงรอจนถึงลานบนแทนการรอเวลาตายตัว
    await expect.poll(async () => (await snapshot(page)).x, { timeout: 15_000 }).toBeGreaterThan(21.5 * TILE);
    await page.keyboard.up('d');

    await teleport(page, 29 * TILE, 8 * TILE);
    await page.keyboard.down('w');
    await page.waitForTimeout(1200);
    await page.keyboard.up('w');
    expect((await snapshot(page)).y).toBeGreaterThan(6.9 * TILE);
  });

  test('cannot walk into the forest', async ({ page }) => {
    await openGame(page);
    await teleport(page, 5 * TILE, 25 * TILE);
    await page.keyboard.down('a');
    await page.waitForTimeout(1500);
    await page.keyboard.up('a');
    expect((await snapshot(page)).x).toBeGreaterThanOrEqual(2 * TILE);
  });

  test('stops at the edge of the map with the camera inside it', async ({ page }) => {
    await openGame(page);
    await teleport(page, 4.5 * TILE, 25 * TILE);
    await page.keyboard.down('a');
    await page.waitForTimeout(800);
    await page.keyboard.up('a');
    const state = await snapshot(page);
    expect(state.x).toBeGreaterThanOrEqual(2 * TILE);
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
      .filter((child): child is import('phaser').GameObjects.Sprite => 'texture' in child && child.type !== 'Text')
      .filter(
        (sprite) =>
          sprite.scaleX !== 1 ||
          sprite.scaleY !== 1 ||
          sprite.displayWidth !== sprite.frame.realWidth ||
          sprite.displayHeight !== sprite.frame.realHeight,
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

test('Gio v2 walks on four legs near the seat, sits back down, and stays in play', async ({ page }) => {
  test.setTimeout(120_000);
  await openGame(page);
  const readGio = (): Promise<{ x: number; y: number; texture: string }> =>
    page.evaluate(() => {
      const scene = window.__game!.scene.getScene('Base');
      const body = scene.children.getByName('gio_body') as import('phaser').GameObjects.Zone;
      const sprite = scene.children.getByName('gio') as import('phaser').GameObjects.Sprite;
      return { x: body.x, y: body.y, texture: sprite.texture.key };
    });

  await page.waitForFunction(
    () => {
      const scene = window.__game!.scene.getScene('Base') as unknown as { gio: { isWalking: boolean } };
      if (scene.gio.isWalking) document.documentElement.dataset.gioWalked = 'yes';
      return document.documentElement.dataset.gioWalked === 'yes';
    },
    undefined,
    { timeout: 90_000, polling: 50 },
  );
  expect((await readGio()).texture).toMatch(/^gio_walk4_(south|north|east|west)$/);
  await expect.poll(async () => (await readGio()).texture, { timeout: 60_000 }).toMatch(/^gio_sit/);
  const gio = await readGio();
  expect(Math.hypot(gio.x - 11.2 * TILE, gio.y - 11.35 * TILE)).toBeLessThan(200);
});

test('shows the map art with no shadows and a price on each land sign', async ({ page }) => {
  await openGame(page);
  const seen = await page.evaluate(() => {
    const scene = window.__game!.scene.getScene('Base');
    const keys = scene.children.list
      .filter((child): child is import('phaser').GameObjects.Image => 'texture' in child)
      .map((child) => child.texture.key);
    const texts = scene.children.list
      .filter((child) => child.type === 'Text')
      .map((child) => (child as import('phaser').GameObjects.Text).text);
    return { keys, texts };
  });
  for (const key of [
    'house_main',
    'gate_portal',
    'monster_burrow',
    'rock_big_10',
    'tree_big_0',
    'campfire',
    'food_tray_3',
    'gio_seat',
    'fishing_dock',
    'fence_straight',
    'fence_straight_vines',
    'fence_post',
    'land_sale_sign',
  ]) {
    expect(seen.keys).toContain(key);
  }
  expect(seen.keys).not.toContain('stairs_cliff');
  expect(seen.texts.filter((text) => /^[\d,]+$/.test(text))).toEqual(['5,000', '15,000', '40,000']);
  expect(seen.keys.filter((key) => key.startsWith('petal_')).length).toBeGreaterThan(20);
  expect(seen.keys.filter((key) => key.startsWith('soft_') && !key.includes('238__243__240'))).toEqual([]);
});

test('the settings switch turns the lighting layer off and on', async ({ page }) => {
  await openGame(page);
  const lightingLayers = (): Promise<number> =>
    page.evaluate(() => window.__game!.scene.getScene('Base').cameras.main.postPipelines.length);
  expect(await lightingLayers()).toBe(1);

  await page.locator('#settings-button').click();
  const toggle = page.locator('#lighting-toggle');
  await expect(toggle).toBeVisible();
  const box = (await toggle.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(await lightingLayers()).toBe(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(await lightingLayers()).toBe(1);
});

test('the lighting layer leaves the phone button tappable', async ({ page }) => {
  await openGame(page);
  const box = (await page.locator('#phone-button').boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test('the zoom choice changes the whole-number zoom and is remembered', async ({ page, isMobile }) => {
  await openGame(page);
  const zoomNow = (): Promise<number> =>
    page.evaluate(() => window.__game!.scene.getScene('Base').cameras.main.zoom);
  const start = await zoomNow();
  const fitted = start - (isMobile ? 1 : 0);

  await page.locator('#settings-button').click();
  await page.locator('[data-zoom-step="2"]').click();
  await expect.poll(zoomNow).toBe(fitted + 2);
  const box = (await page.locator('[data-zoom-step="2"]').boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);

  await page.reload();
  await page.waitForFunction(() => window.__game?.scene.isActive('Base'));
  await expect.poll(zoomNow).toBe(fitted + 2);
});

test('holding Shift runs 1.6 times faster on a keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  await openGame(page);
  const speedWhile = async (run: boolean): Promise<number> => {
    await teleport(page, 25 * TILE, 12 * TILE);
    if (run) await page.keyboard.down('Shift');
    await page.keyboard.down('d');
    await page.waitForTimeout(150);
    const speed = await page.evaluate(() => {
      const body = window.__game!.scene.getScene('Base').children.getByName('player_body') as import('phaser').GameObjects.Zone;
      return (body.body as import('phaser').Physics.Arcade.Body).velocity.x;
    });
    await page.keyboard.up('d');
    if (run) await page.keyboard.up('Shift');
    return speed;
  };
  const walk = await speedWhile(false);
  const run = await speedWhile(true);
  expect(run / walk).toBeCloseTo(1.6);
  const fuller = await page.evaluate(() => window.__state!.world.gauges.fullness);
  expect(fuller).toBeGreaterThan(90);
});

test('holding the run button runs and letting go walks', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch screens only');
  await openGame(page);
  const button = page.locator('#run-button');
  const box = (await button.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('the run button works while another finger holds the joystick', async ({ page, isMobile, browserName }) => {
  test.skip(!isMobile || browserName !== 'chromium', 'needs real multi-touch from chromium');
  await openGame(page);
  const client = await page.context().newCDPSession(page);
  const center = async (selector: string): Promise<{ x: number; y: number }> => {
    const box = (await page.locator(selector).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const stick = { ...(await center('#joystick')), id: 1 };
  const run = { ...(await center('#run-button')), id: 2 };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stick] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...stick, x: stick.x + 30 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...stick, x: stick.x + 30 }, run] });
  const button = page.locator('#run-button');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});
