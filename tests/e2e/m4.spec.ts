import { expect, test, type Page } from '@playwright/test';

interface CookWorld {
  bag: { item: string; count: number }[];
  gauges: { fullness: number; happiness: number };
  cooking: { slot: { recipe: string; stars: number; minutesLeft: number; count: number } | null };
  recipes: { known: string[]; bestStars: Record<string, number> };
}
interface TestState {
  world: CookWorld;
  setWorld(world: unknown): void;
  movePlayer(point: { x: number; y: number }): void;
}

test.setTimeout(180_000);

const state = (page: Page): Promise<CookWorld> => page.evaluate(() => (window as unknown as { __state: TestState }).__state.world);

async function open(page: Page): Promise<void> {
  await page.goto('/help-tower-game/?test');
  await page.waitForFunction(() => (window as unknown as { __game?: { scene: { isActive(k: string): boolean } } }).__game?.scene.isActive('Base'));
}

/** ยืนใต้กองไฟ ตำแหน่งกองไฟอยู่ใน base-layout.json */
const standAtFire = (page: Page): Promise<void> =>
  page.evaluate(() => (window as unknown as { __state: TestState }).__state.movePlayer({ x: 544, y: 372 }));

const finishCooking = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, cooking: { slot: { ...s.world.cooking.slot!, minutesLeft: 0 } } });
  });

const count = async (page: Page, item: string): Promise<number> =>
  (await state(page)).bag.filter((stack) => stack.item === item).reduce((sum, stack) => sum + stack.count, 0);

test('cooks the home kaprao at the campfire, then eats it to fill up', async ({ page }) => {
  await open(page);
  await standAtFire(page);
  const act = page.locator('#action-button');
  await expect(act).toHaveAttribute('aria-label', /ทำอาหาร/);
  await act.click();
  await expect(page.locator('#cook-window')).toBeVisible();
  await page.locator('[data-recipe="home_kaprao"]').click();
  await expect(page.locator('[data-plate="ing_pork"]')).toContainText('1/1');
  await page.locator('#cook-go').click();
  await expect(page.locator('#cook-window')).toBeHidden();
  expect((await state(page)).cooking.slot?.recipe).toBe('home_kaprao');
  expect(await count(page, 'ing_pork')).toBe(0);
  // ระบบดาว 5 พ.ย. 2026: ผัก 1 ดาวได้อาหาร 1 ดาว เกจสุขมีโอกาส 10% ได้เพิ่ม 1 ดาว
  const stars = (await state(page)).cooking.slot!.stars;
  expect([1, 2]).toContain(stars);
  const dish = `dish_home_kaprao_${stars}`;

  await finishCooking(page);
  await expect(act).toHaveAttribute('aria-label', /เก็บ/);
  await act.click();
  await expect.poll(() => count(page, dish)).toBe(1);

  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, gauges: { ...s.world.gauges, fullness: 30 } });
  });
  // กินจากแถบอาหาร: ปุ่มกลมซ้ายของแถบเครื่องมือสลับเป็นอาหาร เลือกแล้วปุ่มกระทำเป็น "กิน"
  await expect(page.locator('#bag-eat')).toHaveCount(0);
  await page.locator('#toolbar-mode').click();
  await page.locator(`.food-slot[data-food="${dish}"]`).click();
  await expect(act).toHaveAttribute('data-action', 'action.eat');
  // ท่ากินมือว่าง อาหารจริงจิ๋ว (กะเพรา) อยู่ในมือ ปลายนิ้ววาดทับ แล้วกลับมายืนตามเดิม · บันทึกทุกเฟรมของเกม
  await page.evaluate(() => {
    const scene = (window as unknown as { __game: import('phaser').Game }).__game.scene.getScene('Base') as unknown as import('phaser').Scene & {
      player: { sprite: import('phaser').GameObjects.Sprite };
      eatArt: { dish: import('phaser').GameObjects.Image | null; hands: import('phaser').GameObjects.Image } | null;
    };
    const seen: { anim: string; held: boolean }[] = [];
    (window as unknown as { __eat: typeof seen }).__eat = seen;
    scene.events.on('postupdate', () => {
      const art = scene.eatArt;
      const sprite = scene.player.sprite;
      const held =
        art !== null &&
        art.dish !== null &&
        art.dish.visible &&
        art.hands.visible &&
        art.dish.texture.key === 'tray_mini_home_kaprao' &&
        art.hands.depth > art.dish.depth &&
        art.dish.depth > sprite.depth;
      seen.push({ anim: sprite.anims.isPlaying ? (sprite.anims.currentAnim?.key ?? '') : '', held });
    });
  });
  await act.click();
  await expect.poll(() => count(page, dish)).toBe(0);
  expect((await state(page)).gauges.fullness).toBeGreaterThanOrEqual(49);
  const eatLog = (): Promise<{ anim: string; held: boolean }[]> => page.evaluate(() => (window as unknown as { __eat: { anim: string; held: boolean }[] }).__eat);
  await expect.poll(async () => (await eatLog()).some((entry) => entry.held && entry.anim === 'anim_eat_south'), { timeout: 60_000 }).toBe(true);
  await expect.poll(async () => (await eatLog()).at(-1)?.anim, { timeout: 60_000 }).toBe('');
  await page.locator('#toolbar-mode').click();

  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="recipes"]').click();
  const book = page.locator('.book-page');
  await expect(book).toHaveAttribute('data-recipe', 'home_kaprao');
  await expect(book).toHaveAttribute('data-theme', 'savory');
  await expect(page.locator('.book-stars')).toHaveAttribute('data-stars', String(stars));
  await expect(page.locator('.book-note')).toContainText('เหมือนสูตรที่บ้าน');
  await expect(page.locator('.book-steam')).toHaveCount(1);
  await page.locator('#book-next').click();
  await expect(book).toHaveAttribute('data-recipe', 'scallion_omelet');
  await expect(page.locator('.book-title')).toHaveText('? ? ?');
  await expect(page.locator('.book-float')).toHaveCount(0);
  await expect(page.locator('.book-sparkle')).toHaveCount(3);
  await page.locator('[data-book-tab="drink"]').click();
  await expect(book).toHaveAttribute('data-theme', 'drink');
  await expect(page.locator('.book-title')).toHaveText('นมอุ่นน้ำผึ้ง');
  await page.locator('#book-next').click();
  await page.locator('#book-next').click();
  await expect(page.locator('.book-title')).toHaveText('ชากะเพรา');
  await expect(page.locator('.book-steam')).toHaveCount(1);
  await page.locator('#recipe-book-close').click();
  await expect(page.locator('#recipe-book')).toBeHidden();
  // ปิดสมุดแล้วกลับมาที่หน้าหลักของโทรศัพท์
  await expect(page.locator('#phone')).toBeVisible();
});

test('a wrong mix makes mystery food and the player says so', async ({ page }) => {
  await open(page);
  await standAtFire(page);
  const act = page.locator('#action-button');
  await act.click();
  await page.locator('[data-cook-tab="mix"]').click();
  await page.locator('[data-mix-item="produce_chili"]').click();
  await page.locator('[data-mix-item="produce_chili"]').click();
  await page.locator('#mix-go').click();
  expect((await state(page)).cooking.slot?.recipe).toBe('mystery');
  await finishCooking(page);
  const before = (await state(page)).gauges.happiness;
  await act.click();
  await expect(page.locator('#player-bubble')).toContainText('หน้าตาแปลก');
  expect(await count(page, 'dish_mystery_1')).toBe(1);
  expect((await state(page)).gauges.happiness).toBeLessThan(before - 4);
});

test('a right mix unlocks the recipe', async ({ page }) => {
  await open(page);
  await standAtFire(page);
  await page.locator('#action-button').click();
  await page.locator('[data-cook-tab="mix"]').click();
  for (const item of ['produce_tomato', 'produce_tomato', 'produce_garlic', 'ing_salt']) await page.locator(`[data-mix-item="${item}"]`).click();
  await page.locator('#mix-go').click();
  const world = await state(page);
  expect(world.recipes.known).toContain('tomato_soup');
  expect(world.cooking.slot?.recipe).toBe('tomato_soup');
});

test('the title screen shows the logo board and opens the save slots', async ({ page }) => {
  await page.goto('/help-tower-game/?test&saves');
  await expect(page.locator('#title-screen')).toBeVisible();
  await expect(page.locator('.title-logo')).toHaveAttribute('aria-label', 'Floor & Flavor');
  await expect(page.locator('.title-tagline')).toHaveAttribute('aria-label', 'ติดหอคอยทั้งที ขอเปิดร้านข้าวก่อนนะ!');
  await expect(page.locator('.title-twinkle')).toHaveCount(11);
  await expect(page).toHaveTitle('Floor & Flavor');
  const buttonTop = (await page.locator('#title-start').boundingBox())!.y;
  const offsets = new Set<string>();
  for (let i = 0; i < 12; i += 1) {
    offsets.add(await page.locator('.title-sign').evaluate((node) => (node as HTMLElement).style.transform));
    await page.waitForTimeout(250);
  }
  expect(offsets.size).toBeGreaterThan(1);
  expect((await page.locator('#title-start').boundingBox())!.y).toBe(buttonTop);
  await page.locator('#title-load').click();
  await expect(page.locator('.slot-button')).toHaveCount(3);
  await page.locator('#slot-back').click();
  await expect(page.locator('#slot-picker')).toHaveCount(0);
  await page.locator('#title-start').click();
  await expect(page.locator('#title-screen')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __state: { started: boolean } }).__state.started)).toBe(true);
});

test('the recipe book fits the screen at a whole-number size', async ({ page }) => {
  await open(page);
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="recipes"]').click();
  const box = (await page.locator('.book-page').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.height).toBeLessThanOrEqual(viewport.height);
  const ratio = await page.evaluate(() => {
    const pixel = Number.parseFloat(getComputedStyle(document.getElementById('ui')!).getPropertyValue('--bpx'));
    return pixel * window.devicePixelRatio;
  });
  expect(Number.isInteger(Math.round(ratio * 1000) / 1000)).toBe(true);
  await page.locator('[data-book-tab="sweet"]').click();
  await expect(page.locator('.book-page')).toHaveAttribute('data-theme', 'sweet');
  await expect(page.locator('.book-steam')).toHaveCount(0);
});

test('cooking at the campfire plays the cooking move until walking away', async ({ page }) => {
  await open(page);
  await standAtFire(page);
  await page.locator('#action-button').click();
  await page.locator('[data-recipe="boiled_egg"]').click();
  await page.locator('#cook-go').click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __game: { scene: { getScene(k: string): { children: { getByName(n: string): { anims: { currentAnim?: { key: string } } } } } } } }).__game.scene.getScene('Base').children.getByName('player').anims.currentAnim?.key ?? ''))
    .toContain('anim_cook_');
});

test('the campfire window shows what is missing and lets the pot be emptied', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, bag: s.world.bag.filter((stack) => stack.item !== 'ing_pork') });
  });
  await standAtFire(page);
  await page.locator('#action-button').click();
  await page.locator('[data-recipe="home_kaprao"]').click();
  await expect(page.locator('[data-plate="ing_pork"]')).toHaveClass(/is-short/);
  await expect(page.locator('#cook-go')).toBeDisabled();
  await page.locator('[data-cook-tab="mix"]').click();
  await page.locator('[data-mix-item="produce_tomato"]').click();
  await page.locator('[data-mix-item="produce_tomato"]').click();
  await expect(page.locator('[data-plate="produce_tomato"]')).toContainText('×2');
  await page.locator('[data-mix-remove="produce_tomato"]').click();
  await expect(page.locator('[data-plate="produce_tomato"]')).toContainText('×1');
  await page.locator('[data-mix-remove="produce_tomato"]').click();
  await expect(page.locator('#mix-go')).toBeDisabled();
  await expect(page.locator('.cook-panel')).toHaveAttribute('data-theme', 'savory');
  await page.locator('[data-cook-tab="drink"]').click();
  await expect(page.locator('.cook-panel')).toHaveAttribute('data-theme', 'drink');
});

test('the pond is drawn from the map and the trees sway', async ({ page }) => {
  await open(page);
  const info = await page.evaluate(() => {
    const game = (window as unknown as { __game: { textures: { exists(k: string): boolean }; scene: { getScene(k: string): { children: { list: { texture?: { key: string } }[] } } } } }).__game;
    const keys = game.scene.getScene('Base').children.list.map((child) => child.texture?.key ?? '');
    return {
      floor: game.textures.exists('pond_floor'),
      trees: keys.filter((key) => /^tree_big_\d$/.test(key)).length,
      canopies: keys.filter((key) => key.startsWith('tree_canopy_')).length,
    };
  });
  expect(info.floor).toBe(true);
  expect(info.canopies).toBe(info.trees);
  expect(info.trees).toBeGreaterThan(0);
});

test('cooks several plates of one recipe with the − n + stepper, then collects them all together', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState }).__state;
    const bag = [...s.world.bag.filter((stack) => stack.item !== 'ing_egg'), { item: 'ing_egg', count: 3 }];
    s.setWorld({ ...s.world, bag, gauges: { ...s.world.gauges, happiness: 50 } });
  });
  await standAtFire(page);
  const act = page.locator('#action-button');
  await act.click();
  await page.locator('[data-recipe="boiled_egg"]').click();
  const count1 = page.locator('#cook-count');
  await expect(count1).toHaveText('1');
  await expect(page.locator('#cook-less')).toBeDisabled();
  const minutes = Number((await page.locator('.cook-facts span').first().textContent())!.match(/\d+/)![0]);
  await page.locator('#cook-more').click();
  await page.locator('#cook-more').click();
  await expect(count1).toHaveText('3');
  // ไข่มี 3 ฟอง ทำได้มากสุด 3 จาน
  await expect(page.locator('#cook-more')).toBeDisabled();
  await expect(page.locator('[data-plate="ing_egg"]')).toContainText('3/3');
  await expect(page.locator('#cook-batch-total')).toContainText(`${minutes * 3}`);
  await expect(page.locator('.cook-facts span').first()).toContainText(`${minutes * 3}`);
  await page.locator('#cook-go').click();
  await expect(page.locator('#cook-window')).toBeHidden();
  const slot = (await state(page)).cooking.slot!;
  expect(slot.count).toBe(3);
  // นาฬิกาเดินต่อหลังปิดหน้าต่าง เวลาที่เหลือจึงน้อยกว่าเวลารวมเล็กน้อย
  expect(slot.minutesLeft).toBeLessThanOrEqual(minutes * 3);
  expect(slot.minutesLeft).toBeGreaterThan(minutes * 2);
  expect(await count(page, 'ing_egg')).toBe(0);

  await finishCooking(page);
  await expect(act).toHaveAttribute('aria-label', /เก็บ/);
  await act.click();
  await expect.poll(() => count(page, 'dish_boiled_egg_1')).toBe(3);
});
