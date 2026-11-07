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
  await expect(page.locator('#coin-pill')).toHaveCount(0);
  await expect(page.locator('#portrait')).toHaveAttribute('data-mood', 'happy');
  const before = await world(page);
  await expect.poll(async () => (await world(page)).hour).toBeGreaterThan(before.hour);
  await expect.poll(async () => (await world(page)).fullness).toBeLessThan(100);
});

test('the clock stops while the phone is open', async ({ page }) => {
  await open(page);
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.waitForTimeout(100);
  const paused = await world(page);
  await page.waitForTimeout(400);
  expect((await world(page)).hour).toBe(paused.hour);
  await page.locator('#phone-close').click();
  await expect.poll(async () => (await world(page)).hour).toBeGreaterThan(paused.hour);
});

test('sleeps at the door, starts the next day, and the save loads after reopening', async ({ page }) => {
  await open(page, '/help-tower-game/?test&saves');
  await page.locator('#title-load').click();
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
  await page.locator('#title-load').click();
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
  test.setTimeout(120_000);
  await open(page);
  // ล้มก่อน: บันทึกทุกเฟรมของท่าเป็นลม พร้อมสถานะม่านและนาฬิกาตอนเฟรมนั้น
  await page.evaluate(() => {
    const sprite = window.__game!.scene.getScene('Base').children.getByName('player') as import('phaser').GameObjects.Sprite;
    const seen: { frame: number; curtain: boolean; clock: boolean }[] = [];
    (window as unknown as { __faint: typeof seen }).__faint = seen;
    sprite.on('animationupdate', (animation: { key: string }, frame: { textureFrame: string | number }) => {
      if (animation.key !== 'anim_faint_south') return;
      seen.push({ frame: Number(frame.textureFrame), curtain: !document.querySelector<HTMLElement>('#rest-curtain')!.hidden, clock: window.__state!.clockRunning });
    });
    const state = window.__state!;
    state.setWorld({ ...state.world, hour: 10, gauges: { ...state.world.gauges, fullness: 0.01 } });
  });
  // ท่าเป็นลมราว 2 วินาที แต่ Phaser เดินท่าได้ไม่เกิน 1/60 วินาทีต่อภาพ WebKit จำลองบนเครื่องนี้เหลือราว 10–30 ภาพต่อวินาทีตอนรันทั้งชุด ท่าจึงช้าลงหลายเท่า
  await expect(page.locator('#rest-curtain')).toBeVisible({ timeout: 60_000 });
  const seen = await page.evaluate(() => (window as unknown as { __faint: { frame: number; curtain: boolean; clock: boolean }[] }).__faint);
  expect(seen.map((entry) => entry.frame)).toContain(8);
  expect(seen.every((entry) => !entry.curtain && !entry.clock)).toBe(true);
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

test('opens from the mini phone, to the small lock screen, to home with 10 apps and no outfit app', async ({ page }) => {
  await open(page);
  await expect(page.locator('#phone-cover-day')).toHaveText('เสาร์ 1');
  await page.locator('#phone-button').click();
  await expect(page.locator('#lock-screen')).toBeVisible();
  await expect(page.locator('#phone')).toHaveAttribute('data-state', 'lock');
  await expect(page.locator('.pl-card p')).not.toBeEmpty();
  await page.locator('#lock-open').click();
  await expect(page.locator('#phone')).toHaveAttribute('data-state', 'open');
  await expect(page.locator('.phone-app')).toHaveCount(10);
  await expect(page.locator('[data-app="outfit"]')).toHaveCount(0);
  await expect(page.locator('[data-app="settings"]')).toHaveCount(1);
  await expect(page.locator('.phone-app__name')).toHaveCount(10);
  await expect(page.locator('[data-app="support"]')).toBeInViewport();
  // แตะแอปได้ง่าย กว้างและสูงอย่างน้อย 44 พิกเซล
  for (const app of await page.locator('.phone-app').all()) {
    const box = (await app.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  // ร้านค้าเปิดในหน้าต่างโทรศัพท์ ส่วนสนับสนุนเดฟเป็นการ์ดใบเดียวบนเกม ไม่มีปุ่มจ่ายเงิน ปิดแล้วกลับมาที่หน้าหลัก
  await page.locator('[data-app="shop"]').click();
  await expect(page.locator('.shop-page')).toBeVisible();
  await page.locator('#phone-back').click();
  await page.locator('[data-app="support"]').click();
  await expect(page.locator('#support-window')).toBeVisible();
  await expect(page.locator('#support-window')).toContainText('สนับสนุนเดฟ');
  await expect(page.locator('#support-window button')).toHaveCount(0);
  await expect(page.locator('#phone')).toBeHidden();
  await page.locator('#support-window-close').click();
  await expect(page.locator('#phone')).toBeVisible();
  await page.locator('#phone-close').click();
  await expect(page.locator('#phone')).toBeHidden();
});

test('home shows the calendar and stuck counter, folds back to the lock screen, and has no flip button', async ({ page }) => {
  await open(page);
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await expect(page.locator('#stuck-counter')).toBeVisible();
  await expect(page.locator('#tower-calendar')).toContainText('เดือนที่ 1');
  await expect(page.locator('#phone')).not.toContainText('ฤดู');
  await page.locator('#phone-fold').click();
  await expect(page.locator('#phone')).toHaveAttribute('data-state', 'lock');
  await expect(page.locator('#lock-screen')).toBeVisible();
  await page.locator('#lock-open').click();
  // ปุ่มพลิกและด้านหลังเครื่องเอาออกแล้ว การ์ดขวาเหลือแค่ ⇆ กับ ✕ (phone update 2026-11-07c)
  await expect(page.locator('#phone-flip')).toHaveCount(0);
  await expect(page.locator('#phone-back-side')).toHaveCount(0);
  await expect(page.locator('.pw-ctrl__btn:visible')).toHaveCount(2);
  // การ์ดยื่นขึ้นไปทับแถบบน ขอบบนเท่าขอบซ้ายและล่าง กระดาษเป็นกระจกฝ้าไม่มีสีพื้น
  const measure = (): Promise<{ top: number; left: number; bottom: number; image: string; colour: string }> => page.evaluate(() => {
    const window = document.querySelector('#phone')!.getBoundingClientRect();
    const card = document.querySelector('.pw-card--l')!.getBoundingClientRect();
    const style = getComputedStyle(document.querySelector('.pw-card--l')!);
    return { top: card.top - window.top, left: card.left - window.left, bottom: window.bottom - card.bottom, image: style.backgroundImage, colour: style.backgroundColor };
  });
  // หน้าต่างค่อย ๆ ขยายจากจอล็อก รอให้ขยายเสร็จก่อนวัด
  await expect.poll(async () => { const now = await measure(); return Math.abs(now.bottom - now.left) < 1.5; }).toBe(true);
  const layout = await measure();
  expect(Math.abs(layout.top - layout.left)).toBeLessThan(1.5);
  expect(Math.abs(layout.bottom - layout.left)).toBeLessThan(1.5);
  expect(layout.image).toContain('paper_glass');
  expect(layout.colour).toBe('rgba(0, 0, 0, 0)');
});

test('money shows a floating number and the wallet log, with no pill on screen', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const change = (window as unknown as { __changeMoney: (c: string, a: number, l: string, k: string) => void }).__changeMoney;
    change('coins', 1250, 'wallet.test_income', 'wallet.category_test');
    change('stars', 38, 'wallet.test_income', 'wallet.category_test');
  });
  await expect(page.locator('#money-pop p').first()).toContainText('+1,250');
  await expect(page.locator('#coin-pill')).toHaveCount(0);
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="wallet"]').click();
  await expect(page.locator('[data-balance="coins"]')).toHaveText('1,250');
  await expect(page.locator('[data-balance="stars"]')).toHaveText('38');
  await expect(page.locator('.wallet-entry')).toHaveCount(2);
  // จอเล็กรายการเลื่อนได้ ต้องเลื่อนไปถึงรายการสุดท้ายจนเห็นเต็มใบ
  await page.locator('.wallet-entry').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.wallet-entry').last()).toBeInViewport({ ratio: 0.9 });
  await expect(page.locator('#phone-back')).toBeInViewport();
  expect((await page.locator('.pw-card--l').boundingBox())!.height).toBeGreaterThan(120);
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
  await expect(page.locator('#lock-screen')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#lock-screen')).toBeHidden();
});

test('settings and the phone sit top right, and settings opens on its own', async ({ page }) => {
  await open(page);
  const viewport = page.viewportSize()!;
  for (const id of ['#phone-button', '#settings-button']) {
    const box = (await page.locator(id).boundingBox())!;
    expect(box.y).toBeLessThan(viewport.height / 4);
    expect(box.x).toBeGreaterThan(viewport.width / 2);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.locator('#settings-button').click();
  await expect(page.locator('#settings-window')).toBeVisible();
  await expect(page.locator('#lighting-toggle')).toBeVisible();
  await expect(page.locator('#phone')).toBeHidden();
  const paused = await page.evaluate(() => {
    const before = window.__state!.world.hour;
    return new Promise((resolve) => setTimeout(() => resolve(window.__state!.world.hour === before), 1500));
  });
  expect(paused).toBe(true);
  await page.locator('#settings-close').click();
  await expect(page.locator('#settings-window')).toBeHidden();
});

test('the joystick is see-through and the run button changes its picture', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch screens only');
  await open(page);
  const opacity = await page.locator('#joystick').evaluate((node) => Number(getComputedStyle(node).opacity));
  expect(opacity).toBeGreaterThan(0.3);
  expect(opacity).toBeLessThan(1);
  const image = page.locator('#run-button img');
  await expect(image).toHaveAttribute('src', /run_button_off/);
  const box = (await page.locator('#run-button').boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(64);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(image).toHaveAttribute('src', /run_button_on/);
  await page.mouse.up();
  await expect(image).toHaveAttribute('src', /run_button_off/);
});

test('a short screen with the Safari bars still fits every app without clipping', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch screens only');
  await open(page);
  await page.setViewportSize({ width: 932, height: 320 });
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await expect(page.locator('[data-app="support"]')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-app="album"]')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#phone')).toBeInViewport({ ratio: 1 });
  await page.locator('[data-app="wallet"]').click();
  const clipped = await page.locator('#wallet-log').evaluate((node) => node.scrollWidth > node.clientWidth);
  expect(clipped).toBe(false);
});

test('the game can be added to the home screen to play full screen', async ({ page }) => {
  await open(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await page.request.get(new URL(href!, page.url()).href)).json();
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.orientation).toBe('landscape');
  const icon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await page.request.get(new URL(icon!, page.url()).href)).ok()).toBe(true);
});
