import { expect, test, type Page } from '@playwright/test';

interface SoundWorld {
  hour: number;
  bag: { item: string; count: number }[];
}
interface TestState {
  world: SoundWorld;
  setWorld(world: unknown): void;
  movePlayer(point: { x: number; y: number }): void;
}
interface TestSound {
  log: string[];
  musicKey: string | null;
  running: boolean;
  volume(group: string): number;
}

test.setTimeout(180_000);

const sound = (page: Page): Promise<{ log: string[]; musicKey: string | null; running: boolean; bgm: number }> =>
  page.evaluate(() => {
    const s = (window as unknown as { __sound: TestSound }).__sound;
    return { log: [...s.log], musicKey: s.musicKey, running: s.running, bgm: s.volume('bgm') };
  });
const change = (page: Page, patch: Partial<SoundWorld>): Promise<void> =>
  page.evaluate((next) => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, ...next });
  }, patch);

async function open(page: Page, query = '?test'): Promise<void> {
  await page.goto(`/help-tower-game/${query}`);
  await page.waitForFunction(() => (window as unknown as { __game?: { scene: { isActive(k: string): boolean } } }).__game?.scene.isActive('Base'));
}

/** WebKit ของ Playwright บน Windows ไม่มี Web Audio เลย (iPhone จริงมี) เกมยังเล่นได้แต่ไม่มีเสียง จึงข้ามการตรวจเสียงในเบราว์เซอร์นั้น */
async function skipWithoutWebAudio(page: Page): Promise<void> {
  test.skip(!(await page.evaluate(() => 'AudioContext' in window)), 'no Web Audio in this test browser');
}

test('the title plays its own music, and the farm plays day music, then night music from 18:00', async ({ page }) => {
  await page.goto('/help-tower-game/?test&saves');
  await skipWithoutWebAudio(page);
  await expect.poll(async () => (await sound(page)).musicKey).toBe('bgm_title');
  await expect.poll(async () => (await sound(page)).log).toContain('bgm_title');
  await open(page);
  // แตะครั้งแรกเปิดเสียงได้บนมือถือ
  await page.locator('#settings-button').click();
  await page.locator('#settings-close').click();
  await expect.poll(async () => (await sound(page)).running).toBe(true);
  await expect.poll(async () => (await sound(page)).musicKey).toBe('bgm_farm_day');
  await expect.poll(async () => (await sound(page)).log).toContain('bgm_farm_day');
  await change(page, { hour: 18.2 });
  await expect.poll(async () => (await sound(page)).musicKey).toBe('bgm_farm_night');
  await expect.poll(async () => (await sound(page)).log).toContain('bgm_farm_night');
  await change(page, { hour: 25 });
  expect((await sound(page)).musicKey).toBe('bgm_farm_night');
});

test('settings has three volume sliders, music starts at 65%, and the choice is remembered', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await page.locator('#settings-button').click();
  await expect.poll(async () => (await sound(page)).log).toContain('ui_open');
  const music = page.locator('#volume-bgm');
  await expect(music).toHaveValue('65');
  await expect(page.locator('#volume-sfx')).toHaveValue('100');
  await expect(page.locator('#volume-voice')).toHaveValue('100');
  expect((await music.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await music.fill('30');
  expect((await sound(page)).bgm).toBeCloseTo(0.3);
  // ปุ่มที่เปิดหรือปิดหน้าต่างมีเสียงเปิดปิด ไม่มีเสียงแตะซ้อน
  const before = (await sound(page)).log.length;
  await page.locator('#settings-close').click();
  await expect.poll(async () => (await sound(page)).log.slice(before)).toContain('ui_close');
  await page.waitForTimeout(200);
  expect((await sound(page)).log.slice(before)).not.toContain('ui_tap');
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __game?: { scene: { isActive(k: string): boolean } } }).__game?.scene.isActive('Base'));
  expect((await sound(page)).bgm).toBeCloseTo(0.3);
});

test('eating says "eat", and eating again quickly uses the rapid takes in turn', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await change(page, { bag: [{ item: 'dish_home_kaprao_1', count: 3 }] });
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="inventory"]').click();
  await page.locator('[data-item="dish_home_kaprao_1"]').click();
  await page.locator('#bag-eat').click();
  await expect.poll(async () => (await sound(page)).log).toContain('eat');
  // กดกินซ้ำเร็ว ๆ (เครื่องทดสอบช้า จึงกดผ่านหน้าเว็บตรง ๆ ให้ทันใน 1.5 วินาที)
  await page.evaluate(() => {
    (document.querySelector('[data-item="dish_home_kaprao_1"]') as HTMLElement).click();
    (document.querySelector('#bag-eat') as HTMLElement).click();
  });
  await expect.poll(async () => (await sound(page)).log).toContain('eat_rapid_1');
});

test('hoeing a plot plays the till sound on the hit frame', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await page.evaluate(() => (window as unknown as { __state: TestState }).__state.movePlayer({ x: 176, y: 336 }));
  await page.locator('[data-tool="hoe"]').click();
  await page.locator('#action-button').click();
  await expect.poll(async () => (await sound(page)).log, { timeout: 20_000 }).toContain('farm_till');
});

test('cooking plays the start, the sizzle loop while she cooks, and the done sound with her voice', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await page.evaluate(() => (window as unknown as { __state: TestState }).__state.movePlayer({ x: 544, y: 372 }));
  const act = page.locator('#action-button');
  await expect(act).toHaveAttribute('aria-label', /ทำอาหาร/);
  await act.click();
  await page.locator('[data-recipe="home_kaprao"]').click();
  await page.locator('#cook-go').click();
  await expect.poll(async () => (await sound(page)).log).toContain('cook_start');
  await expect.poll(async () => (await sound(page)).log, { timeout: 20_000 }).toContain('cook_loop');
  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState & { world: { cooking: { slot: object } } } }).__state;
    s.setWorld({ ...s.world, cooking: { slot: { ...s.world.cooking.slot, minutesLeft: 0 } } });
  });
  await expect.poll(async () => (await sound(page)).log).toContain('cook_done');
  await expect.poll(async () => (await sound(page)).log.some((key) => key.startsWith('voice_cook_done_'))).toBe(true);
});

test('fishing plays cast, plop, the "!" alert, her bite line, reel and catch with a yay', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  await skipWithoutWebAudio(page);
  await change(page, { hour: 12 });
  await page.evaluate(() => (window as unknown as { __state: TestState }).__state.movePlayer({ x: 752, y: 600 }));
  await page.locator('[data-tool="rod"]').click();
  await page.locator('.bait-slot[data-bait="cloud_lettuce"]').click();
  const act = page.locator('#action-button');
  await expect(act).toHaveAttribute('aria-label', /ตกปลา/);
  await act.click();
  await expect.poll(async () => (await sound(page)).log, { timeout: 20_000 }).toContain('fish_cast');
  await expect.poll(async () => (await sound(page)).log, { timeout: 20_000 }).toContain('fish_plop');
  await expect(act).toHaveAttribute('aria-label', /ดึง/, { timeout: 90_000 });
  await page.keyboard.press('e');
  const log = async (): Promise<string[]> => (await sound(page)).log;
  await expect.poll(log, { timeout: 30_000 }).toContain('fish_reel');
  await expect.poll(log, { timeout: 30_000 }).toEqual(expect.arrayContaining(['fish_nibble', 'fish_alert']));
  await expect.poll(async () => (await log()).some((key) => key === 'fish_catch' || key === 'fish_escape'), { timeout: 30_000 }).toBe(true);
});
