import { expect, test, type Page } from '@playwright/test';

interface CookWorld {
  bag: { item: string; count: number }[];
  gauges: { fullness: number; happiness: number };
  cooking: { slot: { recipe: string; stars: number; minutesLeft: number } | null };
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
  await expect(act).toContainText('ทำอาหาร');
  await act.click();
  await expect(page.locator('#cook-window')).toBeVisible();
  await page.locator('[data-recipe="home_kaprao"]').click();
  await expect(page.locator('[data-plate="ing_pork"]')).toContainText('1/1');
  await page.locator('#cook-go').click();
  await expect(page.locator('#cook-window')).toBeHidden();
  expect((await state(page)).cooking.slot?.recipe).toBe('home_kaprao');
  expect(await count(page, 'ing_pork')).toBe(0);

  await finishCooking(page);
  await expect(act).toContainText('เก็บ');
  await act.click();
  await expect.poll(() => count(page, 'dish_home_kaprao_2')).toBe(1);

  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, gauges: { ...s.world.gauges, fullness: 30 } });
  });
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="inventory"]').click();
  await page.locator('[data-item="dish_home_kaprao_2"]').click();
  await page.locator('#bag-eat').click();
  expect(await count(page, 'dish_home_kaprao_2')).toBe(0);
  expect((await state(page)).gauges.fullness).toBeGreaterThanOrEqual(49);

  await page.locator('#phone-back').click();
  await page.locator('[data-app="recipes"]').click();
  const book = page.locator('.book-page');
  await expect(book).toHaveAttribute('data-recipe', 'home_kaprao');
  await expect(book).toHaveAttribute('data-theme', 'savory');
  await expect(page.locator('.book-stars')).toHaveAttribute('data-stars', '2');
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
  await page.locator('#book-close').click();
  await expect(page.locator('#recipe-book')).toBeHidden();
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

test('the save screen shows the new game name', async ({ page }) => {
  await page.goto('/help-tower-game/?test&saves');
  await expect(page.locator('#slot-picker h1')).toHaveText('Floor & Flavor');
  await expect(page.locator('#slot-picker')).toContainText('ติดหอคอยทั้งที ขอเปิดร้านข้าวก่อนนะ!');
  await expect(page).toHaveTitle('Floor & Flavor');
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
