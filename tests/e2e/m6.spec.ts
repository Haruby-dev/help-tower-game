import { expect, test, type Page } from '@playwright/test';

interface ShopWorld {
  day: number;
  hour: number;
  bag: { item: string; count: number }[];
  wallet: { coins: number };
  gio: { happiness: number; consignment: unknown; report: { coins: number } | null };
}
interface TestState {
  world: ShopWorld;
  setWorld(world: unknown): void;
  movePlayer(point: { x: number; y: number }): void;
}
interface GioView {
  feetX: number;
  feetY: number;
  present: boolean;
}

test.setTimeout(180_000);

const state = (page: Page): Promise<ShopWorld> => page.evaluate(() => (window as unknown as { __state: TestState }).__state.world);
const change = (page: Page, patch: Partial<ShopWorld>): Promise<void> =>
  page.evaluate((next) => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, ...next });
  }, patch);
const count = async (page: Page, item: string): Promise<number> =>
  (await state(page)).bag.filter((stack) => stack.item === item).reduce((sum, stack) => sum + stack.count, 0);
const gio = (page: Page): Promise<GioView> =>
  page.evaluate(() => {
    const scene = (window as unknown as { __game: { scene: { getScene(k: string): { gio: GioView } } } }).__game.scene.getScene('Base');
    return { feetX: scene.gio.feetX, feetY: scene.gio.feetY, present: scene.gio.present };
  });

async function open(page: Page): Promise<void> {
  await page.goto('/help-tower-game/?test');
  await page.waitForFunction(() => (window as unknown as { __game?: { scene: { isActive(k: string): boolean } } }).__game?.scene.isActive('Base'));
}

async function standByGio(page: Page): Promise<void> {
  const where = await gio(page);
  await page.evaluate(({ x, y }) => (window as unknown as { __state: TestState }).__state.movePlayer({ x: x + 26, y }), { x: where.feetX, y: where.feetY });
  await expect(page.locator('#action-button')).toHaveAttribute('aria-label', 'คุย');
  await expect(page.locator('#action-button .action-button__icon')).toHaveAttribute('src', /icon_talk/);
}

test('buys cat treats and seeds in the system shop, and the money is logged', async ({ page }) => {
  await open(page);
  await change(page, { wallet: { ...(await state(page)).wallet, coins: 2000 } });
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="shop"]').click();
  await expect(page.locator('#phone')).toHaveAttribute('data-app', 'shop');
  await expect(page.locator('#phone-close')).toBeHidden();
  await expect(page.locator('#shop-coins')).toHaveText('2,000');
  await page.locator('[data-offer="treats:treat_salmon"]').click();
  await page.locator('#shop-more').click();
  await expect(page.locator('#shop-qty')).toHaveText('2');
  await expect(page.locator('#shop-buy')).toContainText('400');
  await page.locator('#shop-buy').click();
  await expect.poll(() => count(page, 'treat_salmon')).toBe(2);
  await expect(page.locator('#shop-coins')).toHaveText('1,600');
  await page.locator('[data-offer="seeds:scallion"]').click();
  await page.locator('#shop-buy').click();
  await expect.poll(() => count(page, 'seed_scallion')).toBe(1);
  expect((await state(page)).wallet.coins).toBe(1520);
  await page.locator('[data-shop-tab="random"]').click();
  await expect(page.locator('.shop-item')).toHaveCount(5);
  await page.locator('[data-shop-tab="equipment"]').click();
  await expect(page.locator('.shop-closed')).toBeVisible();
});

test('Gio is away selling in the day and home in the evening, where she can talk, give a treat and pet him', async ({ page }) => {
  await open(page);
  await change(page, { hour: 12 });
  await expect.poll(async () => (await gio(page)).present).toBe(false);
  await change(page, { hour: 19, bag: [...(await state(page)).bag, { item: 'treat_tuna', count: 2 }] });
  await expect.poll(async () => (await gio(page)).present).toBe(true);
  await standByGio(page);
  await page.locator('#action-button').click();
  await expect(page.locator('#gio-window')).toBeVisible();
  const clock = (await state(page)).hour;
  await expect(page.locator('[data-gio-action="treat"]')).toContainText('×2');
  await expect(page.locator('[data-gio-action="news"] .gio-talk__dot')).toHaveCount(1);
  // มีรสเดียวให้ทันที จีโอนั่งเลียพร้อมหัวใจ
  await page.locator('[data-gio-action="treat"]').click();
  await expect(page.locator('#gio-line')).toContainText('อร่อย');
  expect((await state(page)).gio.happiness).toBe(65);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __game: { scene: { getScene(k: string): { gio: { sprite: { anims: { currentAnim: { key: string } | null } } } } } } }).__game.scene.getScene('Base').gio.sprite.anims.currentAnim?.key)).toBe('gio_eat_lick');
  expect(await page.evaluate(() => (window as unknown as { __game: { scene: { getScene(k: string): { children: { list: { texture?: { key: string }; visible: boolean }[] } } } } }).__game.scene.getScene('Base').children.list.filter((c) => c.texture?.key === 'fx_heart_5').length)).toBe(1);
  await page.locator('[data-gio-action="pet"]').click();
  expect((await state(page)).gio.happiness).toBe(68);
  await expect(page.locator('[data-gio-action="pet"] .gio-talk__check')).toBeVisible();
  await page.locator('[data-gio-action="pet"]').click();
  await expect(page.locator('#gio-line')).toContainText('ลูบไปแล้ว');
  await page.locator('[data-gio-action="news"]').click();
  await expect(page.locator('[data-gio-action="news"] .gio-talk__dot')).toHaveCount(0);
  expect((await state(page)).hour).toBe(clock);
  // แมวเลียหมดแล้วปุ่มเป็นสีเทา กดไม่ได้
  await change(page, { bag: [] });
  await page.locator('[data-gio-action="close"]').click();
  await page.locator('#action-button').click();
  await expect(page.locator('[data-gio-action="treat"]')).toBeDisabled();
  await expect(page.locator('[data-gio-action="treat"]')).toContainText('×0');
  await page.locator('[data-gio-action="close"]').click();
  await expect(page.locator('#gio-window')).toBeHidden();
});

test('consigns produce to Gio, and the next evening he pays after commission and shows the summary', async ({ page }) => {
  await open(page);
  await change(page, { hour: 19, bag: [{ item: 'produce_scallion', count: 10 }, { item: 'fish_silver_minnow', count: 1 }] });
  await standByGio(page);
  await page.locator('#action-button').click();
  await page.locator('[data-gio-action="consign"]').click();
  await expect(page.locator('#consign-window')).toBeVisible();
  await expect(page.locator('#consign-commission')).toContainText('20%');
  await page.locator('.consign-slot[data-item="produce_scallion"]').click();
  await page.locator('.consign-slot[data-item="fish_silver_minnow"]').click();
  // ต้นหอม 1 × 80 + ปลา 1 × 150 = 230 หักคอม 20% เหลือ 184
  await expect(page.locator('#consign-estimate')).toContainText('184');
  await page.locator('#consign-go').click();
  await expect(page.locator('#consign-window')).toBeHidden();
  await expect(page.locator('#gio-line')).toContainText('ฝากไว้แล้ว');
  expect(await count(page, 'produce_scallion')).toBe(9);
  await page.locator('[data-gio-action="close"]').click();

  await change(page, { day: 2, hour: 18.2 });
  await expect.poll(async () => (await state(page)).gio.report?.coins).toBe(184);
  expect((await state(page)).wallet.coins).toBe(184);
  // เดินมาใกล้จีโอแล้วใบสรุปยอดเปิดเอง ซ่อน HUD และนาฬิกาหยุด
  const where = await gio(page);
  await page.evaluate(({ x, y }) => (window as unknown as { __state: TestState }).__state.movePlayer({ x: x + 26, y }), { x: where.feetX, y: where.feetY });
  await expect(page.locator('#gio-report')).toBeVisible();
  await expect(page.locator('#gio-window')).toBeHidden();
  await expect(page.locator('#report-coins')).toContainText('184');
  await expect(page.locator('#report-commission')).toContainText('20%');
  await expect(page.locator('#gio-report .receipt__row')).toHaveCount(2);
  await expect(page.locator('#gio-report .receipt__more')).toHaveCount(0);
  await expect(page.locator('#toolbar')).toBeHidden();
  await expect(page.locator('#gio-report .coin-icon').first()).toHaveAttribute('src', /coin_paw_12/);
  const clock = (await state(page)).hour;
  await page.waitForTimeout(600);
  expect((await state(page)).hour).toBe(clock);
  await page.locator('.gio-report__ok').click();
  await expect(page.locator('#receipt-window')).toBeHidden();
  await expect(page.locator('#toolbar')).toBeVisible();
  expect((await state(page)).gio.report).toBeNull();
});

test('the bag no longer has the turn-into-seeds button and cat treats say they are Gio snacks', async ({ page }) => {
  await open(page);
  await change(page, { bag: [{ item: 'produce_tomato', count: 2 }, { item: 'treat_chicken', count: 1 }] });
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="inventory"]').click();
  await page.locator('[data-item="produce_tomato"]').click();
  await expect(page.locator('#bag-convert')).toHaveCount(0);
  await page.locator('[data-bag-tab="goods"]').click();
  await page.locator('[data-item="treat_chicken"]').click();
  await expect(page.locator('.bag-detail')).toContainText('ขนมของจีโอ');
});

test('a long summary scrolls inside the receipt and keeps the same height, with a gift row', async ({ page }) => {
  await open(page);
  const sold = ['produce_strawberry', 'produce_corn', 'produce_tomato', 'produce_carrot', 'produce_rice', 'produce_garlic'].map((item) => ({ item, count: 2 }));
  await change(page, { hour: 19, bag: sold });
  const left = await page.evaluate(() => (window as unknown as { __state: TestState }).__state.world);
  await change(page, { gio: { ...(left.gio as object), consignment: { items: sold, returnDay: 1, tier: 1 } } as never });
  await expect.poll(async () => (await state(page)).gio.report !== null).toBe(true);
  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState & { world: { gio: { report: object } } } }).__state;
    s.setWorld({ ...s.world, gio: { ...s.world.gio, report: { ...s.world.gio.report, gift: { item: 'ing_honey', count: 1 } } } });
  });
  const where = await gio(page);
  await page.evaluate(({ x, y }) => (window as unknown as { __state: TestState }).__state.movePlayer({ x: x + 26, y }), { x: where.feetX, y: where.feetY });
  await expect(page.locator('#gio-report')).toBeVisible();
  await expect(page.locator('#gio-report .receipt__row')).toHaveCount(6);
  await expect(page.locator('#gio-report .receipt__more')).toContainText('เลื่อนดูอีก');
  await expect(page.locator('#gio-report .receipt__gift')).toContainText('ของฝากจากจีโอ');
  const list = page.locator('#gio-report .receipt__list');
  const height = await page.locator('#gio-report').evaluate((node) => node.getBoundingClientRect().height);
  await list.evaluate((node) => node.scrollTo(0, node.scrollHeight));
  await expect(page.locator('#gio-report .receipt__more')).toBeHidden();
  expect(await page.locator('#gio-report').evaluate((node) => node.getBoundingClientRect().height)).toBe(height);
  await page.locator('.gio-report__ok').click();
  expect((await state(page)).bag.some((stack) => stack.item === 'ing_honey')).toBe(true);
});

test('Gio sits inside his basket, gets out by the front, and every pose keeps his feet on one line with no fade', async ({ page }) => {
  await open(page);
  await change(page, { hour: 19 });
  const home = await gio(page);
  await page.evaluate(({ x, y }) => (window as unknown as { __state: TestState }).__state.movePlayer({ x: x + 150, y: y + 90 }), { x: home.feetX, y: home.feetY });
  const read = () =>
    page.evaluate(() => {
      const scene = (window as unknown as { __game: { scene: { getScene(k: string): any } } }).__game.scene.getScene('Base'); // eslint-disable-line @typescript-eslint/no-explicit-any
      const sprite = scene.gio.sprite;
      const seat = scene.gioSeat;
      const gios = scene.children.list.filter((child: { name: string }) => child.name === 'gio');
      return {
        feetX: scene.gio.feetX,
        feetY: scene.gio.feetY,
        seated: scene.gio.isSeated,
        walking: scene.gio.isWalking,
        texture: sprite.texture.key,
        footInFrame: sprite.originY * sprite.frame.height,
        spriteY: sprite.y,
        alpha: sprite.alpha,
        count: gios.length,
        moving: Math.hypot(scene.gio.body.body.velocity.x, scene.gio.body.body.velocity.y),
        anim: sprite.anims.isPlaying ? sprite.anims.currentAnim?.key : null,
        seat,
      };
    });
  const start = await read();
  expect(start.seated).toBe(true);
  expect(start.feetX).toBeCloseTo(start.seat.x, 0);
  expect(start.feetY).toBeGreaterThan(start.seat.top);
  expect(start.feetY).toBeLessThan(start.seat.bottom);
  const seen = new Set<string>();
  for (let step = 0; step < 150; step += 1) {
    const now = await read();
    expect(now.count).toBe(1);
    expect(now.alpha).toBe(1);
    // เท้าบนแผ่นภาพตรงกับตำแหน่งเท้าจริงทุกท่า
    expect(Math.abs(now.spriteY - now.feetY)).toBeLessThan(0.01);
    const expected = now.texture.startsWith('gio_sit') ? [45, 48, 49] : now.texture === 'gio_eat_lick' ? [47] : [60];
    expect(expected.some((value) => Math.abs(now.footInFrame - value) < 0.01)).toBe(true);
    // ขยับเมื่อไหร่ต้องเล่นท่าเดินของทิศนั้น
    if (now.moving > 0) expect(now.anim).toMatch(/^gio_walk4_/);
    seen.add(now.texture);
    if (seen.has('gio_walk4_south') && seen.has('gio_stand4')) break;
    await page.waitForTimeout(200);
  }
  expect(seen.has('gio_walk4_south')).toBe(true);
  expect(seen.has('gio_stand4')).toBe(true);
  const rim = await page.evaluate(() => {
    const scene = (window as unknown as { __game: { scene: { getScene(k: string): any } } }).__game.scene.getScene('Base'); // eslint-disable-line @typescript-eslint/no-explicit-any
    const image = scene.children.getByName('gio_seat_rim');
    return image ? { depth: image.depth, crop: image.isCropped } : null;
  });
  expect(rim?.crop).toBe(true);
  expect(rim!.depth).toBeGreaterThan(start.feetY);
});
