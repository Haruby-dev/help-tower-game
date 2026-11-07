import { expect, test, type Page } from '@playwright/test';

interface SoundWorld {
  hour: number;
  weather: string;
  bag: { item: string; count: number }[];
  gauges: { fullness: number; happiness: number; cleanliness: number; homesickness: number };
  farm: { plots: unknown[] };
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
  ambienceLevels: Record<string, number>;
  volume(group: string): number;
}

test.setTimeout(180_000);

/** ambience คือเสียงฟ้า (นก จิ้งหรีด ฝน) · near คือเสียงตามระยะ (บ่อน้ำ กองไฟ) */
const NEAR_KEYS = ['amb_pond', 'amb_campfire'];
const sound = (page: Page): Promise<{ log: string[]; musicKey: string | null; running: boolean; bgm: number; ambience: Record<string, number>; near: Record<string, number> }> =>
  page.evaluate((nearKeys) => {
    const s = (window as unknown as { __sound: TestSound }).__sound;
    const levels = Object.entries(s.ambienceLevels);
    return {
      log: [...s.log],
      musicKey: s.musicKey,
      running: s.running,
      bgm: s.volume('bgm'),
      ambience: Object.fromEntries(levels.filter(([key]) => !nearKeys.includes(key))),
      near: Object.fromEntries(levels.filter(([key]) => nearKeys.includes(key))),
    };
  }, NEAR_KEYS);
const log = async (page: Page): Promise<string[]> => (await sound(page)).log;
const change = (page: Page, patch: Partial<SoundWorld>): Promise<void> =>
  page.evaluate((next) => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, ...next });
  }, patch);
const moveTo = (page: Page, point: { x: number; y: number }): Promise<void> =>
  page.evaluate((at) => (window as unknown as { __state: TestState }).__state.movePlayer(at), point);

async function open(page: Page, query = '?test'): Promise<void> {
  await page.goto(`/help-tower-game/${query}`);
  await page.waitForFunction(() => (window as unknown as { __game?: { scene: { isActive(k: string): boolean } } }).__game?.scene.isActive('Base'));
}

/** WebKit ของ Playwright บน Windows ไม่มี Web Audio เลย (iPhone จริงมี) เกมยังเล่นได้แต่ไม่มีเสียง จึงข้ามการตรวจเสียงในเบราว์เซอร์นั้น */
async function skipWithoutWebAudio(page: Page): Promise<void> {
  test.skip(!(await page.evaluate(() => 'AudioContext' in window)), 'no Web Audio in this test browser');
}

async function openBag(page: Page): Promise<void> {
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="inventory"]').click();
}

test('the title plays its own music, and the farm plays day music with birds, then night music with crickets from 18:00', async ({ page }) => {
  await page.goto('/help-tower-game/?test&saves');
  await skipWithoutWebAudio(page);
  await expect.poll(async () => (await sound(page)).musicKey).toBe('bgm_title');
  await expect.poll(async () => (await sound(page)).log).toContain('bgm_title');
  expect((await sound(page)).ambience).toEqual({});
  await open(page);
  // แตะครั้งแรกเปิดเสียงได้บนมือถือ
  await page.locator('#settings-button').click();
  await page.locator('#settings-close').click();
  await expect.poll(async () => (await sound(page)).running).toBe(true);
  await expect.poll(async () => (await sound(page)).musicKey).toBe('bgm_farm_day');
  await expect.poll(() => log(page)).toContain('bgm_farm_day');
  await expect.poll(async () => (await sound(page)).ambience).toEqual({ amb_day_birds: 1 });
  await expect.poll(() => log(page)).toContain('amb_day_birds');
  await change(page, { hour: 18.2 });
  await expect.poll(async () => (await sound(page)).musicKey).toBe('bgm_farm_night');
  await expect.poll(() => log(page)).toContain('bgm_farm_night');
  await expect.poll(async () => (await sound(page)).ambience).toEqual({ amb_night_crickets: 1 });
  await expect.poll(() => log(page)).toContain('amb_night_crickets');
  await change(page, { hour: 25 });
  expect((await sound(page)).musicKey).toBe('bgm_farm_night');
});

test('settings has four volume sliders, music starts at 65%, and the choice is remembered', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await page.locator('#settings-button').click();
  await expect.poll(() => log(page)).toContain('ui_open');
  const music = page.locator('#volume-bgm');
  await expect(music).toHaveValue('65');
  await expect(page.locator('#volume-sfx')).toHaveValue('100');
  await expect(page.locator('#volume-voice')).toHaveValue('100');
  await expect(page.locator('#volume-amb')).toHaveValue('100');
  expect((await music.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await music.fill('30');
  expect((await sound(page)).bgm).toBeCloseTo(0.3);
  // แถบเสียงพูดเล่นเสียงออกแรงของตัวเอกให้ฟัง (เสียงพูดเดียวที่เหลือ)
  await page.locator('#volume-voice').fill('80');
  await page.locator('#volume-voice').dispatchEvent('change');
  await expect.poll(() => log(page)).toContain('voice_till_effort');
  // ปุ่มที่เปิดหรือปิดหน้าต่างมีเสียงเปิดปิด ไม่มีเสียงแตะซ้อน
  const before = (await log(page)).length;
  await page.locator('#settings-close').click();
  await expect.poll(async () => (await log(page)).slice(before)).toContain('ui_close');
  await page.waitForTimeout(200);
  expect((await log(page)).slice(before)).not.toContain('ui_tap');
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __game?: { scene: { isActive(k: string): boolean } } }).__game?.scene.isActive('Base'));
  expect((await sound(page)).bgm).toBeCloseTo(0.3);
});

test('eating or drinking plays one crunchy bite each time, no voice', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await change(page, { bag: [{ item: 'dish_home_kaprao_1', count: 3 }, { item: 'dish_tomato_juice_1', count: 1 }] });
  await page.locator('#toolbar-mode').click();
  const act = page.locator('#action-button');
  const bites = async (): Promise<number> => (await log(page)).filter((key) => key === 'eat_crunch').length;
  // กินทีละคำจากแถบอาหาร รอเสียงคำก่อนแล้วค่อยกดคำถัดไป
  for (const [index, food] of ['dish_home_kaprao_1', 'dish_tomato_juice_1', 'dish_home_kaprao_1'].entries()) {
    await page.locator(`.food-slot[data-food="${food}"]`).click();
    await expect(act).toHaveAttribute('data-action', 'action.eat');
    await act.click();
    await expect.poll(bites).toBe(index + 1);
  }
  expect((await log(page)).some((key) => key.startsWith('eat_rapid_') || key.startsWith('voice_'))).toBe(false);
});

test('fainting plays the faint sound once when the curtain comes up', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await change(page, { hour: 10, gauges: { fullness: 0.01, happiness: 80, cleanliness: 80, homesickness: 0 } });
  await expect(page.locator('#rest-curtain')).toBeVisible();
  await expect.poll(async () => (await log(page)).filter((key) => key === 'faint').length).toBe(1);
});

test('the pond and the campfire sound louder as she walks closer and fade out far away', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  // ริมบ่อ (จุดตกปลาในเทสต์ตกปลา) ดังเต็ม ไกลออกไปเงียบ
  await moveTo(page, { x: 752, y: 600 });
  await expect.poll(async () => (await sound(page)).near.amb_pond ?? 0).toBe(1);
  // ยืนที่จุดทำอาหารข้างกองไฟ เสียงกองไฟดังเต็ม
  const fire = await page.evaluate(() => {
    const scene = (window as unknown as { __game: { scene: { getScene(k: string): { campfire: { x: number; y: number } } } } }).__game.scene.getScene('Base');
    return { x: scene.campfire.x, y: scene.campfire.y };
  });
  await moveTo(page, { x: fire.x + 30, y: fire.y + 12 });
  await expect.poll(async () => (await sound(page)).near.amb_campfire ?? 0).toBe(1);
  await moveTo(page, { x: 1400, y: 300 });
  await expect.poll(async () => (await sound(page)).near).toEqual({});
});

test('hoeing a plot plays the till sound (and sometimes her effort voice) on the hit frame, and walking plays footsteps by the ground', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await moveTo(page, { x: 176, y: 336 });
  // ให้สุ่มเสียงออกแรงออกทุกครั้ง จะได้ตรวจได้แน่นอน (ปกติราว 1 ใน 3)
  await page.evaluate(() => {
    const scene = (window as unknown as { __game: { scene: { getScene(k: string): { voiceRng: { next(): number } } } } }).__game.scene.getScene('Base');
    scene.voiceRng.next = () => 0;
  });
  await page.locator('[data-tool="hoe"]').click();
  await page.locator('#action-button').click();
  await expect.poll(() => log(page), { timeout: 20_000 }).toContain('farm_till');
  await expect.poll(() => log(page)).toContain('voice_till_effort');
  expect((await log(page)).some((key) => key.startsWith('step_'))).toBe(false);
  // แปลงผักเป็นดิน เดินบนดินเป็นเสียงเท้าบนดิน นับรอบของตัวเอง
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await log(page)).filter((key) => key.startsWith('step_dirt_')).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  await page.keyboard.up('ArrowRight');
  expect((await log(page)).filter((key) => key.startsWith('step_dirt_')).slice(0, 2)).toEqual(['step_dirt_1', 'step_dirt_2']);
  // บนหญ้าเป็นเสียงเท้าบนหญ้า
  await moveTo(page, { x: 1100, y: 520 });
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await log(page)).filter((key) => key.startsWith('step_grass_')).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  await page.keyboard.up('ArrowRight');
  expect((await log(page)).filter((key) => key.startsWith('step_grass_')).slice(0, 2)).toEqual(['step_grass_1', 'step_grass_2']);
});

test('a crop that becomes ready twinkles once, even when several plots are ready together', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  const growing = (daysGrown: number) => ({ tilled: true, watered: false, crop: { id: 'scallion', daysGrown, harvests: 0 }, fertilizer: 0 });
  await page.evaluate((plot) => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, farm: { plots: s.world.farm.plots.map((old, index) => (index < 3 ? plot : old)) } });
  }, growing(2));
  await page.waitForTimeout(300);
  expect(await log(page)).not.toContain('farm_grown');
  await page.evaluate((plot) => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, farm: { plots: s.world.farm.plots.map((old, index) => (index < 3 ? plot : old)) } });
  }, growing(3));
  await expect.poll(() => log(page)).toContain('farm_grown');
  await page.waitForTimeout(500);
  expect((await log(page)).filter((key) => key === 'farm_grown')).toHaveLength(1);
});

test('cooking plays the start, the sizzle loop while she cooks, and the done sound without a voice line', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await moveTo(page, { x: 544, y: 372 });
  const act = page.locator('#action-button');
  await expect(act).toHaveAttribute('aria-label', /ทำอาหาร/);
  await act.click();
  await page.locator('[data-recipe="home_kaprao"]').click();
  await page.locator('#cook-go').click();
  await expect.poll(() => log(page)).toContain('cook_start');
  await expect.poll(() => log(page), { timeout: 20_000 }).toContain('cook_loop');
  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState & { world: { cooking: { slot: object } } } }).__state;
    s.setWorld({ ...s.world, cooking: { slot: { ...s.world.cooking.slot, minutesLeft: 0 } } });
  });
  await expect.poll(() => log(page)).toContain('cook_done');
  await page.waitForTimeout(1200);
  expect((await log(page)).some((key) => key.startsWith('voice_'))).toBe(false);
});

test('bathing scoops and splashes in time with the picture, splashes take turns, and ends with a sparkle', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await change(page, { gauges: { fullness: 90, happiness: 90, cleanliness: 20, homesickness: 0 } });
  await moveTo(page, { x: 752, y: 600 });
  const act = page.locator('#action-button');
  await expect(act).toHaveAttribute('aria-label', /อาบน้ำ/);
  await act.click();
  await expect.poll(async () => (await log(page)).filter((key) => key.startsWith('bath_splash_')).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  const bath = (await log(page)).filter((key) => key.startsWith('bath_'));
  expect(bath.slice(0, 4)).toEqual(['bath_scoop', 'bath_splash_1', 'bath_scoop', 'bath_splash_2']);
  expect(bath).not.toContain('bath_sparkle');
  await act.click();
  await expect.poll(() => log(page)).toContain('bath_sparkle');
});

test('rain that starts while playing plays the rain start once, then the rain loop with the birds at half', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await page.locator('#settings-button').click();
  await page.locator('#settings-close').click();
  await change(page, { weather: 'sunny', hour: 9 });
  await expect.poll(async () => (await sound(page)).ambience).toEqual({ amb_day_birds: 1 });
  await change(page, { weather: 'rain' });
  await expect.poll(() => log(page)).toContain('rain_start');
  // เสียงฝนวนตามมาหลังเสียงฝนเริ่มราว 1.5 วินาที
  await expect.poll(async () => (await sound(page)).ambience, { timeout: 5000 }).toEqual({ amb_day_birds: 0.5, amb_rain: 1 });
  await change(page, { hour: 9.5 });
  await page.waitForTimeout(300);
  expect((await log(page)).filter((key) => key === 'rain_start')).toHaveLength(1);
  await change(page, { weather: 'sunny' });
  await expect.poll(async () => (await sound(page)).ambience).toEqual({ amb_day_birds: 1 });
});

test('loading a game while it already rains starts the rain loop without the rain start sound', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await page.locator('#settings-button').click();
  await page.locator('#settings-close').click();
  // เริ่มเกมจากเซฟที่ฝนตกอยู่แล้ว (แบบเดียวกับกดโหลดเซฟ)
  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState & { startGame(slot: number, world: unknown): void } }).__state;
    s.startGame(1, { ...s.world, weather: 'rain', hour: 9 });
  });
  await expect.poll(async () => (await sound(page)).ambience).toEqual({ amb_day_birds: 0.5, amb_rain: 1 });
  expect(await log(page)).not.toContain('rain_start');
});

test('low fullness growls, low happiness and low cleanliness give the soft warning, once per entry', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await change(page, { gauges: { fullness: 10, happiness: 90, cleanliness: 90, homesickness: 0 } });
  await expect.poll(() => log(page)).toContain('warn_hungry');
  await change(page, { gauges: { fullness: 10, happiness: 90, cleanliness: 10, homesickness: 0 } });
  await expect.poll(() => log(page)).toContain('warn_generic');
  await change(page, { gauges: { fullness: 10, happiness: 10, cleanliness: 10, homesickness: 0 } });
  await page.waitForTimeout(300);
  // สุขเพิ่งลงถึงจุดเตือนก็ดังของมันเอง แต่อิ่มกับสะอาดไม่ดังซ้ำ
  const warnings = (await log(page)).filter((key) => key.startsWith('warn_'));
  expect(warnings).toEqual(['warn_hungry', 'warn_generic', 'warn_generic']);
});

test('opening a chest rattles, opens and pops each reward one step higher', async ({ page }) => {
  await open(page);
  await skipWithoutWebAudio(page);
  await change(page, { bag: [{ item: 'chest_wooden', count: 1 }] });
  await openBag(page);
  await page.locator('[data-item="chest_wooden"]').click();
  await page.locator('#bag-open-chest').click();
  await expect.poll(() => log(page)).toContain('chest_shake');
  await expect.poll(() => log(page)).toContain('chest_open');
  await expect.poll(() => log(page)).toContain('chest_item_1');
  await page.waitForTimeout(1500);
  const chest = (await log(page)).filter((key) => key.startsWith('chest_'));
  expect(chest).not.toContain('chest_open_golden');
  const pops = chest.filter((key) => key.startsWith('chest_item_'));
  expect(pops[0]).toBe('chest_item_1');
  if (pops.length > 1) expect(pops[1]).toBe('chest_item_2');
});

test('fishing plays cast, plop, the "!" alert, reel and catch', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  await skipWithoutWebAudio(page);
  await change(page, { hour: 12 });
  await moveTo(page, { x: 752, y: 600 });
  await page.locator('[data-tool="rod"]').click();
  await page.locator('.bait-slot[data-bait="cloud_lettuce"]').click();
  const act = page.locator('#action-button');
  await expect(act).toHaveAttribute('aria-label', /ตกปลา/);
  await act.click();
  await expect.poll(() => log(page), { timeout: 20_000 }).toContain('fish_cast');
  await expect.poll(() => log(page), { timeout: 20_000 }).toContain('fish_plop');
  await expect(act).toHaveAttribute('aria-label', /ดึง/, { timeout: 90_000 });
  await page.keyboard.press('e');
  await expect.poll(() => log(page), { timeout: 30_000 }).toContain('fish_reel');
  await expect.poll(() => log(page), { timeout: 30_000 }).toEqual(expect.arrayContaining(['fish_nibble', 'fish_alert']));
  await expect.poll(async () => (await log(page)).some((key) => key === 'fish_catch' || key === 'fish_escape'), { timeout: 30_000 }).toBe(true);
  expect((await log(page)).some((key) => key.startsWith('voice_'))).toBe(false);
});
