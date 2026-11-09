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
async function enterGate(page: Page, floor = 3): Promise<void> {
  await page.evaluate((target) => (window as unknown as { __enterGate: (floor: number) => void }).__enterGate(target), floor);
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

test('gate portal in the yard: the floor menu is the tower book, floor 3 opens after Mookmik reaches 100%, the enter button goes in, and the book then shows the reward and forage of today', async ({ page }) => {
  await open(page);
  const act = page.locator('#action-button');
  const book = page.locator('#gate-book');
  // ยืนหน้าประตูเกตบนลานเกต ปุ่มกระทำเป็นอุ้งเท้า "ประตูเกต"
  await page.evaluate(() => (window as unknown as { __state: { movePlayer(at: { x: number; y: number }): void } }).__state.movePlayer({ x: 800, y: 126 }));
  await expect(act).toHaveAttribute('aria-label', 'ประตูเกต');
  await expect(act).toHaveAttribute('data-icon', 'interact');
  await act.click();
  await expect(book).toBeVisible();
  // มุกมิกยังไม่ครบ 100% ชั้น 3 ยังปิด ไม่มีปุ่มเข้า
  await expect(page.locator('#gate-enter')).toHaveCount(0);
  await page.locator('#gate-book-close').click();
  await expect(book).toBeHidden();

  await page.evaluate(() => {
    const state = (window as unknown as { __state: TestState & { world: GateWorld & { monsters: { affection: Record<string, unknown> } } } }).__state;
    const monsters = state.world.monsters;
    state.setWorld({ ...state.world, monsters: { ...monsters, affection: { ...monsters.affection, mookmik: { points: 9999, signature: true } } } });
  });
  await act.click();
  await expect(book).toBeVisible();
  // เปิดที่ชั้นบนสุดที่เข้าได้ (ชั้น 3) มีจุดทองของป่าวันนี้
  await expect(page.locator('.gt-fl[data-floor="3"]')).not.toHaveClass(/dk/);
  await expect(page.locator('#gate-book .gt-dot')).toHaveCount(1);
  await expect(page.locator('#gate-book .gt-row').filter({ hasText: 'รางวัลแรก' })).toContainText('???');
  // ชั้นที่ภาพยังไม่มาก็เข้าได้ (ฉากกล่องสี ผู้ใช้เลือก 9 พ.ย. 2026)
  await page.evaluate(() => {
    const state = (window as unknown as { __state: TestState & { world: GateWorld & { monsters: { affection: Record<string, unknown> } } } }).__state;
    const monsters = state.world.monsters;
    state.setWorld({ ...state.world, monsters: { ...monsters, affection: { ...monsters.affection, puinun: { points: 9999, signature: true } } } });
  });
  await page.locator('.gt-fl[data-floor="1"]').click();
  await expect(page.locator('#gate-enter')).toHaveCount(1);
  await page.locator('.gt-fl[data-floor="3"]').click();
  await page.locator('#gate-enter').click();
  await expect(book).toBeHidden();
  await page.waitForFunction(() => {
    const game = (window as unknown as Win).__game;
    return game.scene.isActive('Gate') && (game.scene.getScene('Gate') as GateView).ready;
  });

  // เปิดหีบ เก็บของป่าทุกจุด แล้วออกมาดูในสมุด: รางวัลแรกมีชื่อ ของป่าวันนี้เก็บหมดแล้ว จุดทองหาย
  await page.waitForTimeout(400);
  await standAt(page, 15.0, 4.1);
  await act.click();
  await expect.poll(async () => (await world(page)).gates.chests).toEqual([3]);
  await page.evaluate(() => {
    const state = (window as unknown as Win).__state;
    // ชั้น 1 เปิดแล้วด้วย (ฉากกล่องสีมีดอกเดซี่) เก็บครบทั้งสองชั้น จุดทองจึงหายหมด
    state.setWorld({ ...state.world, gates: { ...state.world.gates, forage: { '1': { day: state.world.day, picked: [0, 1, 2, 3] }, '3': { day: state.world.day, picked: [0, 1, 2, 3] } } } });
  });
  await standAt(page, 13.9, 12.7);
  await page.keyboard.down('s');
  await page.waitForFunction(() => (window as unknown as Win).__game.scene.isActive('Base'), undefined, { timeout: 10_000 });
  await page.keyboard.up('s');
  await page.waitForTimeout(400);
  await expect(act).toHaveAttribute('aria-label', 'ประตูเกต');
  await act.click();
  await expect(page.locator('#gate-book .gt-row').filter({ hasText: 'รางวัลแรก' })).toContainText('เมล็ดผักกาดเมฆ ×5 ✓');
  await expect(page.locator('#gate-book .gt-row').filter({ hasText: 'ของป่า' })).toContainText('เก็บแล้ววันนี้');
  await expect(page.locator('#gate-book .gt-dot')).toHaveCount(0);
  await page.locator('#gate-book-close').click();

  // แอปเกตในโทรศัพท์ดูข้อมูลอย่างเดียว ไม่มีปุ่มเข้าเกต (ยืนหน้าประตูอยู่ก็ตาม)
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="gate"]').click();
  await expect(book).toBeVisible();
  await page.locator('.gt-fl[data-floor="3"]').click();
  await expect(page.locator('#gate-book .gt-row').filter({ hasText: 'รางวัลแรก' })).toContainText('✓');
  await expect(page.locator('#gate-enter')).toHaveCount(0);
});

test('gate 3 collision: the player stops at Mookmik, the reward chest and the top hedge, and can always walk back, also after going out and in again (fix B1)', async ({ page }) => {
  await open(page);
  // เข้าแล้วออกหนึ่งรอบก่อน ฉากเกตครั้งที่สองต้องชนได้เหมือนครั้งแรก
  await enterGate(page);
  await standAt(page, 13.9, 12.7);
  await page.keyboard.down('s');
  await page.waitForFunction(() => (window as unknown as Win).__game.scene.isActive('Base'), undefined, { timeout: 15_000 });
  await page.keyboard.up('s');
  await page.waitForTimeout(500);
  await enterGate(page);
  const feet = (): Promise<{ x: number; y: number }> => gate(page, (scene) => ({ x: scene.player.feetX, y: scene.player.feetY }));
  const walk = async (key: string, ms: number): Promise<void> => {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
    await page.waitForTimeout(100);
  };
  const map = await page.evaluate(() => {
    const scene = (window as unknown as Win).__game.scene.getScene('Gate') as unknown as { map: { owner: { pos: [number, number] }; reward_chest: { pos: [number, number] } } };
    return { owner: scene.map.owner.pos, chest: scene.map.reward_chest.pos };
  });

  // เดินขึ้นหามุกมิกจากข้างล่าง: หยุดก่อนถึงตัว ไม่ทะลุขึ้นไป
  await standAt(page, map.owner[0], map.owner[1] + 1.2);
  await walk('w', 1200);
  expect((await feet()).y).toBeGreaterThan(map.owner[1] * TILE);
  await walk('s', 500);
  expect((await feet()).y).toBeGreaterThan(map.owner[1] * TILE + 8);

  // หีบรางวัลก็ชนเหมือนกัน
  await standAt(page, map.chest[0], map.chest[1] + 1.2);
  await walk('w', 1200);
  expect((await feet()).y).toBeGreaterThan(map.chest[1] * TILE);

  // พุ่มไม้ขอบบน (แถว 0–1 เดินไม่ได้): เดินขึ้นจนสุดแล้วหยุดใต้แถว 1 และเดินกลับลงได้เสมอ
  const topHedge = async (): Promise<void> => {
    await standAt(page, 9, 3.5);
    await walk('w', 2500);
    const top = await feet();
    expect(top.y).toBeGreaterThanOrEqual(2 * TILE);
    await walk('s', 800);
    expect((await feet()).y).toBeGreaterThan(top.y + 8);
  };
  await topHedge();

  // หลังเปิดหีบ คุยกับมุกมิก เก็บของป่า และกินของ ก็ยังชนได้เหมือนเดิม (ตามที่ผู้เล่นเจอในเกมจริง)
  const act = page.locator('#action-button');
  await standAt(page, 15.0, 4.1);
  await act.click();
  await expect.poll(async () => (await world(page)).gates.chests).toEqual([3]);
  await standAt(page, 14.3, 4.75);
  await act.click();
  await standAt(page, 5.44, 4.5);
  await act.click();
  await page.waitForTimeout(500);
  await topHedge();
  await standAt(page, map.owner[0], map.owner[1] + 1.2);
  await walk('w', 1200);
  expect((await feet()).y).toBeGreaterThan(map.owner[1] * TILE);
  // หีบเปิดแล้วหายไป ตรงนั้นเดินผ่านได้
  await standAt(page, map.chest[0], map.chest[1] + 1.2);
  await walk('w', 600);
  expect((await feet()).y).toBeLessThan((map.chest[1] + 1.2) * TILE - 8);
});

test('gate 3 rabbits stay inside their wander area with their whole body off the hedges, and do not stand on each other (fix B3)', async ({ page }) => {
  await open(page);
  await enterGate(page);
  // เร่งให้เดินบ่อย: พักสั้น
  await page.evaluate(() => {
    const scene = (window as unknown as Win).__game.scene.getScene('Gate') as unknown as { info: { kinIdleMs: [number, number] } };
    scene.info.kinIdleMs = [100, 200];
  });
  const area = await page.evaluate(() => ((window as unknown as Win).__game.scene.getScene('Gate') as unknown as { map: { kin: { wander_area: number[] } } }).map.kin.wander_area);
  const spawn = await gate(page, (scene) => scene.kin.map((one) => ({ x: one.monster.feetX, y: one.monster.feetY })));
  const out = spawn.map(() => false);
  for (let sample = 0; sample < 30; sample += 1) {
    await page.waitForTimeout(400);
    const kin = await gate(page, (scene) => scene.kin.map((one) => ({ x: one.monster.feetX, y: one.monster.feetY, sides: [scene.isBlocked(one.monster.feetX - 12, one.monster.feetY), scene.isBlocked(one.monster.feetX + 12, one.monster.feetY), scene.isBlocked(one.monster.feetX, one.monster.feetY - 12)] })));
    for (const [index, one] of kin.entries()) {
      // หน้าโพรงติดพุ่มไม้ ตรวจหลังตัวนั้นเดินออกมาไกลกว่า 24 พิกเซลแล้ว (ออกแล้วต้องไม่กลับไปทับพุ่มไม้อีก)
      out[index] ||= Math.hypot(one.x - spawn[index]!.x, one.y - spawn[index]!.y) > 24;
      if (out[index]) {
        expect(one.sides, JSON.stringify({ index, sample, x: one.x, y: one.y, spawn: spawn[index] })).toEqual([false, false, false]);
        expect(one.x).toBeGreaterThanOrEqual(area[0]! * TILE - 2);
        expect(one.x).toBeLessThanOrEqual(area[2]! * TILE + 2);
        expect(one.y).toBeLessThanOrEqual(area[3]! * TILE + 2);
      }
    }
  }
  // จุดที่แต่ละตัวยืนหรือกำลังเดินไปห่างกันพอ ไม่ซ้อนกัน
  const spots = await gate(page, (scene) => (scene as unknown as { kin: { target?: { x: number; y: number } | null; monster: { feetX: number; feetY: number } }[] }).kin.map((one) => one.target ?? { x: one.monster.feetX, y: one.monster.feetY }));
  for (let a = 0; a < spots.length; a += 1) {
    for (let b = a + 1; b < spots.length; b += 1) expect(Math.hypot(spots[a]!.x - spots[b]!.x, spots[a]!.y - spots[b]!.y)).toBeGreaterThan(20);
  }
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
  // WebKit ของเทสต์บางรอบวาดภาพช้า เวลาในฉากเดินช้ากว่านาฬิกาจริง (เคยล้มรอบแรกที่ 10 วินาที) จึงรอนานขึ้น
  await page.waitForFunction(() => (window as unknown as Win).__game.scene.isActive('Base'), undefined, { timeout: 25_000 });
  expect(await page.evaluate(() => (window as unknown as Win).__game.scene.isActive('Gate'))).toBe(false);
});

test('settings test buttons on the second row can be reached and tapped, also inside a gate (fix B7)', async ({ page }) => {
  await open(page);
  await enterGate(page);
  await page.locator('#settings-button').click();
  for (const id of ['test-drying-tray', 'test-big-table']) {
    // เลื่อนกรอบทดสอบเอง (การ์ดตั้งค่าเลื่อนไม่ได้) แล้วจุดกลางปุ่มต้องเป็นปุ่มนั้นจริง ไม่ใช่ฉากหลังมืด
    const reach = await page.evaluate((buttonId) => {
      const button = document.getElementById(buttonId)!;
      const box = document.querySelector('.st-test')!;
      box.scrollTop = button.offsetTop - box.clientHeight / 2;
      const card = document.querySelector('.st-card')!;
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { cardScroll: card.scrollTop, self: hit === button || button.contains(hit) };
    }, id);
    expect(reach).toEqual({ cardScroll: 0, self: true });
  }
  await page.locator('#test-big-table').click();
  await page.locator('#test-drying-tray').click();
  const after = await page.evaluate(() => (window as unknown as { __state: { world: { crafting: { stations: { drying_tray: number } }; sets: { bigTable: { owned: boolean } } } } }).__state.world);
  expect(after.crafting.stations.drying_tray).toBe(1);
  expect(after.sets.bigTable.owned).toBe(true);
});

test('gates without art use the colour-box scene: the floor monster stands there, gate 2 gives bamboo, gate 5 gives its secret recipe, and the exit goes home', async ({ page }) => {
  await open(page);
  const act = page.locator('#action-button');
  await enterGate(page, 2);
  await shot(page, 'box_01_gate2');
  const scene2 = await gate(page, (scene) => ({ owner: scene.owner?.sprite.texture.key, kin: scene.kin.length, chest: scene.chest === null, forage: scene.forage.map((one) => one !== null) }));
  expect(scene2).toEqual({ owner: 'monster_popcorn_sweet_stand', kin: 0, chest: true, forage: [true, true, true, true] });
  await standAt(page, 4, 8.5);
  await expect(act).toHaveAttribute('aria-label', 'เก็บของป่า');
  await act.click();
  await page.waitForTimeout(450);
  expect(await count(page, 'bamboo')).toBe(1);
  // ทางออกด้านล่างกลับลานบ้าน
  await standAt(page, 11, 11.4);
  await page.keyboard.down('s');
  await page.waitForFunction(() => (window as unknown as Win).__game.scene.isActive('Base'), undefined, { timeout: 10_000 });
  await page.keyboard.up('s');

  await enterGate(page, 5);
  expect(await gate(page, (scene) => [scene.owner?.sprite.texture.key, scene.chest === null])).toEqual(['monster_tangkrading_sweet_stand', false]);
  await standAt(page, 15.3, 4.6);
  await expect(act).toHaveAttribute('aria-label', 'เปิดหีบ');
  await act.click();
  await page.waitForTimeout(450);
  expect(await page.evaluate(() => (window as unknown as { __state: { world: { recipes: { known: string[] } } } }).__state.world.recipes.known.includes('honey_pancake'))).toBe(true);
  expect((await world(page)).gates.chests).toEqual([5]);
});
