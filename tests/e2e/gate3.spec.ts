import { expect, test, type Page } from '@playwright/test';

interface GateWorld {
  day: number;
  hour: number;
  player: { x: number; y: number } | null;
  bag: { item: string; count: number }[];
  gates: { chests: number[]; forage: Record<string, { day: number; picked: number[] }> };
}
interface Sprite {
  depth: number;
  active: boolean;
}
interface GateView {
  ready: boolean;
  leaving: boolean;
  player: { feetX: number; feetY: number; body: { x: number; y: number }; sprite: Sprite; moveTo(point: { x: number; y: number }): void };
  owner: { feetX: number; feetY: number; sprite: Sprite & { texture: { key: string } } } | null;
  kin: { monster: { feetX: number; feetY: number; sprite: { texture: { key: string } } } }[];
  chest: Sprite | null;
  forage: (Sprite | null)[];
  children: { list: { texture?: { key: string }; depth: number }[] };
  isBlocked(x: number, y: number): boolean;
}
interface TestState {
  world: GateWorld;
  setWorld(world: unknown): void;
}
type Win = {
  __state: TestState;
  __game: { scene: { getScene(key: string): unknown; isActive(key: string): boolean; isSleeping(key: string): boolean } };
};

test.setTimeout(120_000);

/** ภาพหน้าจอระหว่างพัฒนา (ตั้ง GATE_SHOTS เป็นโฟลเดอร์) ปกติไม่ถ่าย */
const shot = async (page: Page, name: string): Promise<void> => {
  if (process.env.GATE_SHOTS) await page.screenshot({ path: `${process.env.GATE_SHOTS}/${name}.png` });
};
const TILE = 32;
const world = (page: Page): Promise<GateWorld> => page.evaluate(() => (window as unknown as Win).__state.world);
const count = async (page: Page, item: string): Promise<number> => (await world(page)).bag.filter((stack) => stack.item === item).reduce((sum, stack) => sum + stack.count, 0);
const gate = <T>(page: Page, read: (scene: GateView) => T): Promise<T> =>
  page.evaluate(`(${read.toString()})(window.__game.scene.getScene('Gate'))`) as Promise<T>;

async function open(page: Page): Promise<void> {
  await page.goto('/help-tower-game/?test');
  await page.waitForFunction(() => (window as unknown as Partial<Win>).__game?.scene.isActive('Base'));
}

/** เข้าเกต 3 ทางตัวช่วยทดสอบ (ปุ่มทดสอบในตั้งค่าเอาออกแล้ว ประตูเกตในลานมาใน M8) แล้วรอจนภาพเกตโหลดเสร็จ */
async function enterGate(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { __enterGate: (floor: number) => void }).__enterGate(3));
  await page.waitForFunction(() => {
    const game = (window as unknown as Win).__game;
    const scene = game.scene.getScene('Gate') as GateView | undefined;
    return game.scene.isSleeping('Base') && game.scene.isActive('Gate') && scene?.ready === true;
  });
  // รอภาพสว่างขึ้นจนสุด
  await page.waitForTimeout(400);
}

/** ยืนให้เท้าอยู่ที่ช่อง (x, y) ของแผนที่เกต */
const standAt = (page: Page, x: number, y: number): Promise<void> =>
  page.evaluate(
    ([feetX, feetY]) => {
      const scene = (window as unknown as Win).__game.scene.getScene('Gate') as GateView;
      scene.player.moveTo({ x: feetX!, y: feetY! - (scene.player.feetY - scene.player.body.y) });
    },
    [x * TILE, y * TILE],
  );

test('gate 3: enter, layers, chest once, forage once a day, talk to Mookmik, rabbits wander, walk out to the yard', async ({ page }) => {
  await open(page);
  await enterGate(page);
  await shot(page, '01_enter');

  // ชั้นภาพ: พื้นหลังล่างสุด ชั้นหน้าบนตัวละคร มุกมิกใช้ท่ายืนตอนหวาน กระต่าย 3 สี
  const layers = await gate(page, (scene) => {
    const depthOf = (key: string): number => scene.children.list.find((child) => child.texture?.key === key)!.depth;
    return { bg: depthOf('gate3_bg'), fg: depthOf('gate3_fg'), player: scene.player.sprite.depth, owner: scene.owner?.sprite.texture.key, kin: scene.kin.map((one) => one.monster.sprite.texture.key) };
  });
  expect(layers.bg).toBeLessThan(layers.player);
  expect(layers.fg).toBeGreaterThan(layers.player);
  expect(layers.owner).toBe('monster_mookmik_sweet_stand');
  expect(layers.kin).toEqual(['gate3_kin_brown_sweet_stand', 'gate3_kin_grey_sweet_stand', 'gate3_kin_cream_sweet_stand']);
  // ตำแหน่งในเซฟเป็นหน้าประตูเกตในลาน (เซฟในเกตแล้วเปิดใหม่อยู่ที่ลานบ้าน)
  expect((await world(page)).player).toEqual({ x: 800, y: 126 });

  const act = page.locator('#action-button');
  // หีบรางวัล: อุ้งเท้า "เปิดหีบ" ได้เมล็ดผักกาดเมฆ 5 เมล็ด หีบหายไป
  // ยืนข้างหีบ (หีบมีตัวชน ยืนทับไม่ได้)
  await standAt(page, 15.0, 4.1);
  await expect(act).toHaveAttribute('aria-label', 'เปิดหีบ');
  await expect(act).toHaveAttribute('data-icon', 'interact');
  await shot(page, '02_chest');
  await act.click();
  await page.waitForTimeout(450);
  await shot(page, '03_chest_opened');
  expect(await count(page, 'seed_cloud_lettuce')).toBe(5);
  expect((await world(page)).gates.chests).toEqual([3]);
  expect(await gate(page, (scene) => scene.chest)).toBeNull();

  // ของป่า: เก็บจุดละ 1 วันละครั้ง
  await standAt(page, 5.44, 4.5);
  await expect(act).toHaveAttribute('aria-label', 'เก็บของป่า');
  await act.click();
  await page.waitForTimeout(450);
  await shot(page, '04_forage');
  expect(await count(page, 'ing_wild_cloud_lettuce')).toBe(1);
  expect(await gate(page, (scene) => scene.forage.map((one) => one !== null))).toEqual([false, true, true, true]);
  // ไม่มีอะไรทำปุ่มซ่อน
  await expect(act).toBeHidden();
  await page.keyboard.press('e');
  expect(await count(page, 'ing_wild_cloud_lettuce')).toBe(1);

  // มุกมิกเจ้าของชั้น: ปุ่มคุย พูดประโยคเดิมของตัวเอง
  await standAt(page, 14.3, 4.75);
  await expect(act).toHaveAttribute('aria-label', 'คุย');
  await act.click();
  await expect(page.locator('.world-bubble').filter({ hasText: 'เชฟ วันนี้ทำอะไรล่ะ' })).toBeVisible();
  await shot(page, '05_talk');

  // กระต่ายเดินเล่นช้า ๆ ในเขต ไม่เหยียบช่องเดินไม่ได้
  const start = await gate(page, (scene) => scene.kin.map((one) => [one.monster.feetX, one.monster.feetY]));
  let moved = false;
  for (let sample = 0; sample < 16; sample += 1) {
    await page.waitForTimeout(500);
    const now = await gate(page, (scene) => scene.kin.map((one) => ({ at: [one.monster.feetX, one.monster.feetY], blocked: scene.isBlocked(one.monster.feetX, one.monster.feetY) })));
    for (const one of now) expect(one.blocked).toBe(false);
    if (now.some((one, index) => Math.hypot(one.at[0]! - start[index]![0]!, one.at[1]! - start[index]![1]!) > 8)) moved = true;
  }
  expect(moved).toBe(true);

  // ตัวเอกเดินเข้าไม่ได้ในช่องแดง (ขอบป่าด้านซ้าย)
  await standAt(page, 3, 7);
  await page.keyboard.down('a');
  await page.waitForTimeout(900);
  await page.keyboard.up('a');
  expect(await gate(page, (scene) => scene.player.feetX)).toBeGreaterThanOrEqual(2 * TILE);

  // เดินลงทางออก → กลับลานบ้านหน้าประตูเกต
  await standAt(page, 13.9, 12.7);
  await page.keyboard.down('s');
  await page.waitForFunction(() => (window as unknown as Win).__game.scene.isActive('Base'), undefined, { timeout: 10_000 });
  await page.keyboard.up('s');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as unknown as Win).__game.scene.isActive('Gate'))).toBe(false);
  const yard = await page.evaluate(() => ((window as unknown as Win).__game.scene.getScene('Base') as { player: { body: { x: number; y: number } } }).player.body);
  expect(Math.abs(yard.x - 800)).toBeLessThan(4);
  expect(Math.abs(yard.y - 126)).toBeLessThan(40);
  await shot(page, '06_back_in_yard');

  // เข้าใหม่วันเดิม: หีบไม่มีแล้ว จุดที่เก็บไปยังว่าง · วันถัดไปของป่างอกใหม่ครบ
  await enterGate(page);
  expect(await gate(page, (scene) => [scene.chest === null, scene.forage.map((one) => one !== null)])).toEqual([true, [false, true, true, true]]);
  await standAt(page, 13.9, 12.7);
  await page.keyboard.down('s');
  await page.waitForFunction(() => (window as unknown as Win).__game.scene.isActive('Base'), undefined, { timeout: 10_000 });
  await page.keyboard.up('s');
  await page.evaluate(() => {
    const state = (window as unknown as Win).__state;
    state.setWorld({ ...state.world, day: state.world.day + 1, hour: 9 });
  });
  await enterGate(page);
  expect(await gate(page, (scene) => [scene.chest === null, scene.forage.map((one) => one !== null)])).toEqual([true, [true, true, true, true]]);
});

test('gate 3: after 2 game hours the player says a short line and goes back to the yard', async ({ page }) => {
  await open(page);
  await enterGate(page);
  await page.evaluate(() => {
    const state = (window as unknown as Win).__state;
    state.setWorld({ ...state.world, hour: state.world.hour + 2 });
  });
  await expect(page.locator('#player-bubble')).toContainText('อยู่ในเกตนานแล้ว');
  await shot(page, '07_time_up');
  await page.waitForFunction(() => (window as unknown as Win).__game.scene.isActive('Base'), undefined, { timeout: 10_000 });
  expect(await page.evaluate(() => (window as unknown as Win).__game.scene.isActive('Gate'))).toBe(false);
});
