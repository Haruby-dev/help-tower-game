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
  // ทำครั้งเดียว เวลาเดียว: วัตถุดิบลอยลงภาชนะแล้วหน้าต่างปิดเอง ตัวเอกทำท่าราว 2–3 วินาที แล้วอาหารเด้งเข้ากระเป๋าเอง
  await expect(page.locator('#cook-window')).toBeHidden();
  expect((await state(page)).cooking.slot?.recipe).toBe('home_kaprao');
  expect(await count(page, 'ing_pork')).toBe(0);
  // ระบบดาว 5 พ.ย. 2026: ผัก 1 ดาวได้อาหาร 1 ดาว เกจสุขมีโอกาส 10% ได้เพิ่ม 1 ดาว
  const stars = (await state(page)).cooking.slot!.stars;
  expect([1, 2]).toContain(stars);
  const dish = `dish_home_kaprao_${stars}`;
  await expect.poll(() => count(page, dish), { timeout: 30_000 }).toBe(1);
  expect((await state(page)).cooking.slot).toBeNull();
  // อาหารออกแล้วเด้งหน้าแต่งจาน ไม่แต่งกดข้าม
  await expect(page.locator('#decorate-window')).toBeVisible();
  await page.locator('#decorate-skip').click();
  await expect(page.locator('#decorate-window')).toBeHidden();

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
  // เปลี่ยนหน้าเฉพาะสูตรที่รู้แล้ว ไม่มีหน้า ? ? ? (ข้อ A6) ไข่เจียวต้นหอมยังไม่รู้จึงข้ามไป
  const known = (await state(page) as unknown as { recipes: { known: string[] } }).recipes.known;
  expect(known).not.toContain('scallion_omelet');
  for (let turn = 0; turn < 8; turn += 1) {
    await page.locator('#book-next').click();
    const shown = await book.getAttribute('data-recipe');
    expect(known).toContain(shown);
    await expect(page.locator('.book-title')).not.toHaveText('? ? ?');
  }
  await expect(page.locator('.book-note--hint')).toHaveCount(0);
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

test('mystery food left at the campfire from an old save is still collected, and the mixing tab is gone', async ({ page }) => {
  await open(page);
  await standAtFire(page);
  const act = page.locator('#action-button');
  await act.click();
  // โหมดทดลองผสมเอาออกแล้ว (zone1 food update 1.6) · เกมใหม่มีแค่แท็บคาวกับหวาน
  // แท็บเครื่องดื่มขึ้นเมื่อมีแก้วไม้ไผ่ แท็บจัดชุดขึ้นเมื่อมีถาดสาน (ข้อ A11)
  await expect(page.locator('[data-cook-tab="mix"]')).toHaveCount(0);
  await expect(page.locator('[data-cook-tab]')).toHaveCount(2);
  await page.locator('#cook-close').click();
  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, bag: [...s.world.bag, { item: 'bamboo_cup', count: 1 }, { item: 'small_woven_tray', count: 1 }] });
  });
  await act.click();
  await expect(page.locator('[data-cook-tab]')).toHaveCount(4);
  await expect(page.locator('[data-cook-tab="set"]')).toHaveText('จัดชุด');
  await expect(page.locator('[data-cook-tab="set"]')).toBeEnabled();
  await page.locator('#cook-close').click();
  // ใช้ถาดสานหมดแล้ว แท็บจัดชุดยังอยู่แต่เป็นสีเทา กดไม่ได้ (ผู้ใช้ตัดสิน 10 พ.ย. 2026)
  await page.waitForFunction(() => (window as unknown as { __state: TestState & { world: { crafting: { noticed: string[] } } } }).__state.world.crafting.noticed.includes('small_woven_tray'));
  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, bag: s.world.bag.filter((stack) => stack.item !== 'small_woven_tray') });
  });
  await act.click();
  await expect(page.locator('[data-cook-tab]')).toHaveCount(4);
  await expect(page.locator('[data-cook-tab="set"]')).toBeDisabled();
  await expect(page.locator('[data-cook-tab="set"]')).toHaveClass(/is-off/);
  await page.locator('#cook-close').click();
  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, cooking: { slot: { recipe: 'mystery', stars: 1, minutesLeft: 0, count: 1 } } });
  });
  const before = (await state(page)).gauges.happiness;
  await act.click();
  await expect(page.locator('#player-bubble')).toContainText('หน้าตาแปลก');
  expect(await count(page, 'dish_mystery_1')).toBe(1);
  expect((await state(page)).gauges.happiness).toBeLessThan(before - 4);
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

test('cooking plays the pose of the dish vessel with a fast clock, then the dish comes out by itself', async ({ page }) => {
  await open(page);
  await standAtFire(page);
  await page.locator('#action-button').click();
  // ไข่ต้มใช้หม้อดินเก่า: ยืนใต้กองไฟหันหน้าขึ้น ใช้ท่าย่อตัวทิศหลังร่วมกับต้ม ย่าง ยำ
  await page.locator('[data-recipe="boiled_egg"]').click();
  const clock = (): Promise<number> =>
    page.evaluate(() => {
      const world = (window as unknown as { __state: { world: { day: number; hour: number } } }).__state.world;
      return (world.day * 24 + world.hour) * 60;
    });
  // นาฬิกาหยุดระหว่างเปิดหน้าต่าง จึงอ่านเวลาเริ่มก่อนกดเริ่มทำ
  const startMinute = await clock();
  await page.locator('#cook-go').click();
  await expect(page.locator('#cook-window')).toBeHidden();
  const anim = (): Promise<string> =>
    page.evaluate(
      () =>
        (window as unknown as { __game: { scene: { getScene(k: string): { children: { getByName(n: string): { anims: { currentAnim?: { key: string } } } } } } } }).__game.scene
          .getScene('Base')
          .children.getByName('player').anims.currentAnim?.key ?? '',
    );
  await expect.poll(anim).toContain('anim_crouch_north');
  await expect.poll(() => count(page, 'dish_boiled_egg_1'), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.locator('#decorate-skip').click();
  // เวลาในเกมผ่านไปเท่าเวลาของแรงก์ครั้งเดียว (F 20 นาที) ในไม่กี่วินาที แล้วลุกขึ้นกลับเป็นภาพยืน (ชื่อท่าล่าสุดยังค้างอยู่ จึงดูแผ่นภาพแทน)
  expect((await clock()) - startMinute).toBeGreaterThanOrEqual(19.5);
  const sheet = (): Promise<string> =>
    page.evaluate(
      () =>
        (window as unknown as { __game: { scene: { getScene(k: string): { children: { getByName(n: string): { texture: { key: string } } } } } } }).__game.scene
          .getScene('Base')
          .children.getByName('player').texture.key,
    );
  await expect.poll(sheet).not.toContain('anim_crouch_north');
});

test('the campfire window shows what is missing', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, bag: [...s.world.bag.filter((stack) => stack.item !== 'ing_pork'), { item: 'bamboo_cup', count: 1 }] });
  });
  await standAtFire(page);
  await page.locator('#action-button').click();
  await page.locator('[data-recipe="home_kaprao"]').click();
  await expect(page.locator('[data-plate="ing_pork"]')).toHaveClass(/is-short/);
  await expect(page.locator('#cook-go')).toBeDisabled();
  await expect(page.locator('#cook-batch-total')).toContainText('ขาด: หมูสับ 1');
  await expect(page.locator('.cook-panel')).toHaveAttribute('data-theme', 'savory');
  // ภาชนะตามวิธีทำ: กะเพราใช้กระทะเหล็กเก่า ไข่ต้มหม้อดินเก่า ปลาย่างตะแกรงไม้ไผ่ (รวมในภาพกองไฟ ไม่มีภาชนะแยก)
  await expect(page.locator('.ck-fire__vessel')).toHaveAttribute('data-art', 'cook_vessel_iron_pan');
  await expect(page.locator('.ck-bubble__sub')).toContainText('กระทะเหล็กเก่า');
  await page.locator('[data-recipe="boiled_egg"]').click();
  await expect(page.locator('.ck-fire__vessel')).toHaveAttribute('data-art', 'cook_vessel_clay_pot');
  await page.locator('[data-recipe="grilled_fish"]').click();
  await expect(page.locator('.ck-fire__art')).toHaveAttribute('data-art', 'cook_fire_grill');
  await expect(page.locator('.ck-fire__vessel')).toHaveCount(0);
  // เมนูที่ทำได้ขึ้นก่อน
  const order = await page.locator('.ck-card').evaluateAll((cards) => cards.map((card) => card.classList.contains('is-missing')));
  expect(order.indexOf(true)).toBeGreaterThan(0);
  expect(order.slice(order.indexOf(true)).every(Boolean)).toBe(true);
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

test('cooks several plates in one cooking time with the − n + stepper, and they all come out together', async ({ page }) => {
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
  const minutes = Number((await page.locator('.ck-bubble__sub').textContent())!.match(/\d+/)![0]);
  await page.locator('#cook-more').click();
  await page.locator('#cook-more').click();
  await expect(count1).toHaveText('3');
  // ไข่มี 3 ฟอง ทำได้มากสุด 3 จาน
  await expect(page.locator('#cook-more')).toBeDisabled();
  await expect(page.locator('[data-plate="ing_egg"]')).toContainText('3/3');
  // เวลาเท่าเดิมไม่คูณจำนวนจาน แถบล่างบอก "ใช้ ไข่ ×3 · 20 นาที"
  await expect(page.locator('#cook-batch-total')).toContainText('×3');
  await expect(page.locator('#cook-batch-total')).toContainText(`· ${minutes} `);
  await expect(page.locator('.ck-bubble__sub')).toContainText(`${minutes} `);
  await page.locator('#cook-go').click();
  // ไข่ลอยลงหม้อดินในหน้าต่างก่อน กดปิดไม่ได้ระหว่างนั้น แล้วหน้าต่างปิดเอง
  await expect(page.locator('.ck-flyer')).toHaveCount(1);
  await expect(page.locator('#cook-close')).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('#cook-window')).toBeHidden();
  const slot = (await state(page)).cooking.slot!;
  expect(slot.count).toBe(3);
  expect(slot.minutesLeft).toBeLessThanOrEqual(minutes);
  expect(await count(page, 'ing_egg')).toBe(0);
  await expect.poll(() => count(page, 'dish_boiled_egg_1'), { timeout: 30_000 }).toBe(3);
});

test('decorates the dishes that just came out: one topping per dish, at most 3 pieces, soup-only and too-few are grey', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState }).__state;
    const bag = [
      { item: 'fish_shrimp', count: 4 },
      { item: 'ing_salt', count: 2 },
      { item: 'produce_scallion', count: 4 },
      { item: 'ing_honey', count: 2 },
      { item: 'ing_umami_powder', count: 1 },
      { item: 'ing_fish_ball', count: 2 },
    ];
    s.setWorld({ ...s.world, bag, recipes: { ...s.world.recipes, known: [...s.world.recipes.known, 'grilled_shrimp'] } });
  });
  await standAtFire(page);
  await page.locator('#action-button').click();
  await page.locator('[data-recipe="grilled_shrimp"]').click();
  await page.locator('#cook-more').click();
  await page.locator('#cook-go').click();
  const decorate = page.locator('#decorate-window');
  await expect(decorate).toBeVisible({ timeout: 30_000 });
  await expect(decorate.locator('.dk-name')).toContainText('กุ้งเผา ×2');
  // ลูกชิ้นใส่ได้แค่ซุป/แกง · ผงนัวมีชิ้นเดียว ไม่พอทั้งสองจาน
  await expect(decorate.locator('[data-topping="fish_ball"]')).toHaveAttribute('data-block', 'soupOnly');
  await expect(decorate.locator('[data-topping="umami_powder"]')).toHaveAttribute('data-block', 'notEnough');
  // น้ำผึ้งผิดประเภทกับของคาว แต่หน้าแต่งจานไม่บอกเลย (ข้อ A3) การ์ดดูเหมือนท็อปปิ้งอื่นทุกอย่าง
  await expect(decorate.locator('[data-topping="honey"]')).not.toHaveClass(/is-wrong|is-blocked/);
  await expect(decorate.locator('.dk-card__yuck')).toHaveCount(0);
  const hour = (await state(page) as unknown as { hour: number }).hour;
  await expect(page.locator('#decorate-count')).toHaveText('0/3');
  await decorate.locator('[data-topping="scallion"]').click();
  await expect(page.locator('#decorate-count')).toHaveText('1/3');
  // น้ำผึ้งบนของคาวใส่ได้ (ไม่ได้โบนัส) และนับรวม 3 ชิ้นด้วย
  await decorate.locator('[data-topping="honey"]').click();
  await expect(page.locator('#decorate-count')).toHaveText('2/3');
  await expect(page.locator('#decorate-dish .dk-piece')).toHaveCount(2);
  await decorate.locator('[data-topping="scallion"]').click();
  await expect(page.locator('#decorate-count')).toHaveText('3/3');
  // ครบ 3 ชิ้นแล้ว ท็อปปิ้งที่เหลือเป็นสีเทา "ใส่ครบแล้ว"
  await expect(decorate.locator('[data-topping="scallion"]')).toHaveAttribute('data-block', 'full');
  await expect(decorate.locator('[data-topping="fish_ball"]')).toHaveAttribute('data-block', 'full');
  await expect(decorate.locator('[data-topping="scallion"] .dk-card__block')).toHaveText('ใส่ครบแล้ว');
  // นาฬิกาหยุดระหว่างแต่งจาน
  expect((await state(page) as unknown as { hour: number }).hour).toBe(hour);
  await page.locator('#decorate-done').click();
  await expect(decorate).toBeHidden();
  const bag = (await state(page)).bag;
  const topped = bag.find((stack) => stack.item.startsWith('dish_grilled_shrimp_'));
  expect(topped?.item).toMatch(/^dish_grilled_shrimp_\d~scallion\.scallion\.honey$/);
  expect(topped?.count).toBe(2);
  expect(await count(page, 'produce_scallion')).toBe(0);
  expect(await count(page, 'ing_honey')).toBe(0);
  expect(await count(page, 'ing_fish_ball')).toBe(2);
});

test('the old workbench makes the bamboo cup once, and the banana clump shakes once a day', async ({ page }) => {
  await open(page);
  const near = (key: 'workbench' | 'banana', dy: number): Promise<void> =>
    page.evaluate(
      ({ key, dy }) => {
        const scene = (window as unknown as { __game: { scene: { getScene(k: string): Record<string, { x: number; y: number }> } } }).__game.scene.getScene('Base');
        (window as unknown as { __state: TestState }).__state.movePlayer({ x: scene[key]!.x, y: scene[key]!.y + dy });
      },
      { key, dy },
    );
  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, bag: [{ item: 'bamboo', count: 2 }] });
  });
  await near('workbench', 30);
  const act = page.locator('#action-button');
  await expect(act).toHaveAttribute('aria-label', 'ทำของ');
  // จุดกดใช้ทั่วไปใช้ไอคอนอุ้งเท้าแมวของจอยสติ๊ก (ผู้ใช้ตัดสิน 9 พ.ย. 2026)
  await expect(page.locator('#action-button .action-button__icon')).toHaveAttribute('src', /joystick_knob_paw/);
  await act.click();
  const bench = page.locator('#workbench-window');
  await expect(bench).toBeVisible();
  await expect(bench.locator('.wb-title')).toHaveText('โต๊ะช่างเก่า');
  // ถาดตากยังไม่ปลด (ใบแรกตัวเอกคิดทำเองหลังเกต 2) · ลอบมีลอบเก่าอยู่แล้ว 1 อัน
  await expect(bench.locator('[data-craft="drying_tray"]')).toHaveCount(0);
  await expect(bench.locator('.wb-row[data-craft="trap"] .wb-row__have')).toHaveText('มี 1/3');
  await bench.locator('.wb-make[data-craft="bamboo_cup"]').click();
  await expect(bench.locator('.wb-make[data-craft="bamboo_cup"]')).toHaveText('มีแล้ว');
  await expect(bench.locator('.wb-make[data-craft="bamboo_cup"]')).toBeDisabled();
  expect(await count(page, 'bamboo_cup')).toBe(1);
  expect(await count(page, 'bamboo')).toBe(1);
  await page.locator('#workbench-close').click();
  await expect(bench).toBeHidden();

  await near('banana', 30);
  await expect(act).toHaveAttribute('aria-label', 'เขย่าต้นกล้วย');
  await expect(page.locator('#action-button .action-button__icon')).toHaveAttribute('src', /joystick_knob_paw/);
  await act.click();
  await expect.poll(() => count(page, 'ing_banana_leaf')).toBeGreaterThanOrEqual(2);
  expect(await count(page, 'banana_rope')).toBe(1);
  // เขย่าแล้ววันนี้ ไม่มีอะไรทำตรงนี้ ปุ่มกระทำซ่อน
  await expect(act).toBeHidden();
});

test('the drying tray dries shrimp overnight, the old trap catches overnight, and the stone mortar pounds fish balls', async ({ page }) => {
  await open(page);
  const patchWorld = (code: string): Promise<void> =>
    page.evaluate((body) => {
      const state = (window as unknown as { __state: TestState & { world: Record<string, unknown> } }).__state;
      state.setWorld(new Function('w', `return (${body})(w)`)(state.world));
    }, code);
  const standBy = (kind: 'drying' | 'trap', index: number): Promise<void> =>
    page.evaluate(
      ({ kind, index }) => {
        const scene = (window as unknown as { __game: { scene: { getScene(k: string): { stationsView: { stations(w: unknown): { kind: string; index: number; x: number; y: number }[] } } } } }).__game.scene.getScene('Base');
        const state = (window as unknown as { __state: TestState & { world: unknown } }).__state;
        const station = scene.stationsView.stations(state.world).find((entry) => entry.kind === kind && entry.index === index)!;
        state.movePlayer({ x: station.x, y: station.y + 20 });
      },
      { kind, index },
    );
  await patchWorld(`(w) => ({ ...w, hour: 10, bag: [{ item: 'fish_shrimp', count: 4 }, { item: 'fish_silver_minnow', count: 1 }, { item: 'ing_salt', count: 2 }], crafting: { ...w.crafting, stations: { drying_tray: 1, trap: 1 } } })`);
  const act = page.locator('#action-button');
  await standBy('drying', 0);
  await expect(act).toHaveAttribute('aria-label', 'ตากของ');
  await act.click();
  const drying = page.locator('#drying-window');
  await expect(drying).toBeVisible();
  await page.locator('.dy-row[data-dry="dried_shrimp"]').click();
  await page.locator('#drying-more').click();
  await page.locator('#drying-more').click();
  await expect(page.locator('#drying-count')).toHaveText('3');
  await page.locator('#drying-go').click();
  await expect(drying).toBeHidden();
  expect(await count(page, 'fish_shrimp')).toBe(1);
  // ยังไม่แห้ง กดแล้วตัวเอกบอกให้รอ
  await act.click();
  await expect(page.locator('#player-bubble')).toContainText('ยังไม่แห้ง');
  // ลอบเก่าก่อน 17:00 วางไม่ได้ · ตอนเย็นวางได้
  await standBy('trap', 0);
  await expect(act).toHaveAttribute('aria-label', 'วางลอบ');
  await act.click();
  await expect(page.locator('#player-bubble')).toContainText('เย็น');
  await patchWorld(`(w) => ({ ...w, hour: 17.5 })`);
  await act.click();
  await expect(act).toHaveAttribute('aria-label', 'ยกลอบ');
  // เช้าวันถัดไป
  await patchWorld(`(w) => ({ ...w, day: w.day + 1, hour: 6.2 })`);
  await act.click();
  await expect.poll(async () => (await count(page, 'fish_shrimp')) + (await count(page, 'fish_crab'))).toBe(2);
  await standBy('drying', 0);
  await expect(act).toHaveAttribute('aria-label', 'เก็บของแห้ง');
  await act.click();
  await expect.poll(() => count(page, 'ing_dried_shrimp')).toBe(3);

  // ครกหินเก่าจากปุ่มทดสอบ: ครั้งแรกได้สูตรทอดมันกับลูกชิ้นปิ้ง · ตำลูกชิ้นปลาทุกครั้งเป๊ะ
  await page.evaluate(() => (window as unknown as { __mortarAuto(judge: string): void }).__mortarAuto('perfect'));
  await page.locator('#settings-button').click();
  await page.locator('#test-mortar').click();
  const mortar = page.locator('#mortar-window');
  await expect(mortar).toBeVisible();
  expect((await state(page)).recipes.known).toEqual(expect.arrayContaining(['fish_cake', 'grilled_meatball_skewer']));
  await mortar.locator('.wb-make[data-pound="fish_ball"]').click();
  await expect(page.locator('#mortar-collect')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.mt-beat[data-judge="perfect"]')).toHaveCount(6);
  await page.locator('#mortar-collect').click();
  await expect(mortar).toBeHidden();
  expect(await count(page, 'ing_fish_ball')).toBe(2);
});

test('arranges sets on woven trays, finds a secret set, places a medium set on the big table, and the book lists it', async ({ page }) => {
  await open(page);
  const rice = 'dish_plain_rice_1';
  const fish = 'dish_grilled_fish_1';
  const egg = 'dish_boiled_egg_1';
  const skewer = 'dish_strawberry_skewer_1';
  await page.evaluate(
    (bag) => {
      const s = (window as unknown as { __state: TestState }).__state;
      s.setWorld({ ...s.world, bag });
    },
    [
      { item: 'small_woven_tray', count: 1 },
      { item: 'medium_woven_tray', count: 1 },
      { item: rice, count: 2 },
      { item: fish, count: 1 },
      { item: egg, count: 1 },
      { item: skewer, count: 1 },
    ],
  );
  await standAtFire(page);
  await page.locator('#action-button').click();
  const cook = page.locator('#cook-window');
  await expect(cook).toBeVisible();
  await page.locator('[data-cook-tab="set"]').click();
  // ถาดเล็กก่อน (มีถาด) · ของหวานไม่มีป้ายแดงตอนเลือก
  await expect(page.locator('.sx-chip[data-tray-size="small"]')).toHaveClass(/is-active/);
  await expect(page.locator(`[data-set-dish="${skewer}"] .sx-tag`)).not.toHaveClass(/is-yuck/);
  await expect(page.locator(`[data-set-dish="${skewer}"] .sx-yuck`)).toHaveCount(0);
  await expect(page.locator('#set-go')).toBeDisabled();
  await page.locator(`[data-set-dish="${rice}"]`).click();
  await page.locator(`[data-set-dish="${fish}"]`).click();
  await expect(page.locator('.sx-combo')).toHaveText('ชุดข้าว');
  await expect(page.locator('.sx-progress')).toHaveText('ชุดใหม่! บันทึกลงสมุดสูตรแล้ว');
  await page.locator('#set-go').click();
  await expect(page.locator('.sx-made')).toContainText('ชุดข้าว');
  const small = `set_small|${fish}|${rice}`;
  expect(await count(page, small)).toBe(1);
  expect(await count(page, 'small_woven_tray')).toBe(0);
  type Sets = { reputation: number; combos: string[]; bigTable: { owned: boolean; sets: (string | null)[] } };
  const sets = (): Promise<Sets> => page.evaluate(() => (window as unknown as { __state: { world: { sets: Sets } } }).__state.world.sets);
  expect((await sets()).reputation).toBe(35);

  // ถาดกลาง: ชุดอิสระ 3 ชิ้น (แตะช่องเอาคืนได้)
  await page.locator('.sx-chip[data-tray-size="medium"]').click();
  await page.locator(`[data-set-dish="${rice}"]`).click();
  await page.locator(`[data-set-dish="${egg}"]`).click();
  await page.locator('.sx-slot[data-slot="1"]').click();
  await expect(page.locator('.sx-slot.is-filled')).toHaveCount(1);
  await page.locator(`[data-set-dish="${egg}"]`).click();
  await page.locator(`[data-set-dish="${skewer}"]`).click();
  await expect(page.locator('.sx-combo')).toHaveCount(0);
  // จัดครบแล้วไม่ตรงชุดลับและมีของหวาน: ไม่เตือนอะไรเลย ผู้เล่นรู้เองตอนมอนสเตอร์กิน (ข้อ A2)
  await expect(page.locator('.sx-progress')).toHaveText('3/3 ชิ้น · จัดตรงสูตรเพื่อเจอชุดลับ');
  await expect(page.locator('.sx-slot.is-yuck, .sx-yuck')).toHaveCount(0);
  await page.locator('#set-go').click();
  const medium = `set_medium|${egg}|${rice}|${skewer}`;
  expect(await count(page, medium)).toBe(1);
  expect((await sets()).reputation).toBe(35);
  await page.locator('#cook-close').click();
  await expect(cook).toBeHidden();

  // โต๊ะใหญ่จากปุ่มทดสอบ แล้ววางชุดถาดกลาง
  await page.locator('#settings-button').click();
  await page.locator('#test-big-table').click();
  await page.locator('#settings-close').click();
  expect((await sets()).bigTable.owned).toBe(true);
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __game: { scene: { getScene(k: string): { stationsView: { table: unknown } } } } }).__game.scene.getScene('Base').stationsView.table)))
    .toBe(true);
  await page.evaluate(() => {
    const scene = (window as unknown as { __game: { scene: { getScene(k: string): { stationsView: { table: { x: number; y: number } } } } } }).__game.scene.getScene('Base');
    (window as unknown as { __state: TestState }).__state.movePlayer({ x: scene.stationsView.table.x, y: scene.stationsView.table.y + 24 });
  });
  const act = page.locator('#action-button');
  await expect(act).toHaveAttribute('aria-label', 'โต๊ะใหญ่');
  await act.click();
  const table = page.locator('#table-window');
  await expect(table).toBeVisible();
  await expect(table.locator('.bt-row')).toHaveCount(1);
  await page.locator('#table-go').click();
  // โต๊ะถือได้ 3 ชุด ช่องละชุด (ผู้ใช้เลือก 9 พ.ย. 2026)
  expect((await sets()).bigTable.sets).toEqual([medium, null, null]);
  await expect(table.locator('.bt-slot.is-filled')).toHaveCount(1);
  await expect(table.locator('.bt-sub')).toContainText('1/3');
  await expect(page.locator('#table-go')).toBeDisabled();
  await table.locator('.bt-slot[data-table-slot="0"]').click();
  await expect(page.locator('#table-go')).toHaveText('เก็บคืน');
  await page.locator('#table-go').click();
  expect((await sets()).bigTable.sets).toEqual([null, null, null]);
  expect(await count(page, medium)).toBe(1);
  // แตะช่องว่างทางขวาเพื่อเลือกช่องที่จะวาง
  await table.locator('.bt-slot[data-table-slot="2"]').click();
  await expect(table.locator('.bt-slot[data-table-slot="2"]')).toHaveClass(/is-target/);
  await page.locator('#table-go').click();
  expect((await sets()).bigTable.sets).toEqual([null, null, medium]);
  await page.locator('#table-close').click();

  // สมุดสูตร หน้าชุดที่เคยจัด
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="recipes"]').click();
  await page.locator('[data-book-tab="set"]').click();
  // แสดงเฉพาะชุดที่เจอแล้ว ไม่บอกจำนวนทั้งหมด ไม่มีแถว ? ? ? (ข้อ A7)
  await expect(page.locator('.rb-sets-count')).toHaveCount(0);
  await expect(page.locator('.rb-set')).toHaveCount(1);
  await expect(page.locator('.rb-set[data-combo="rice_set"] .rb-set__name')).toHaveText('ชุดข้าว');
  await expect(page.locator('.rb-sets-note')).not.toContainText('ตรงสูตรลับ');
});
