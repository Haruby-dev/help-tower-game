import { expect, test, type Page } from '@playwright/test';

interface PetState {
  stage: string;
  treatedDays: number;
  homeOwned: boolean;
  stored: number;
}
interface PetWorld {
  day: number;
  hour: number;
  bag: { item: string; count: number }[];
  pets: Record<string, PetState>;
  wallet: { coins: number };
}
interface PlayerView {
  feetX: number;
  feetY: number;
  body: { x: number; y: number };
  moveTo(point: { x: number; y: number }): void;
}
type Win = {
  __state: { world: PetWorld; setWorld(world: unknown): void };
  __enterGate(floor: number): void;
  __game: { scene: { getScene(key: string): unknown; isActive(key: string): boolean; isSleeping(key: string): boolean } };
};

test.setTimeout(150_000);

/** ภาพหน้าจอระหว่างพัฒนา (ตั้ง PET_SHOTS เป็นโฟลเดอร์) ปกติไม่ถ่าย */
const shot = async (page: Page, name: string): Promise<void> => {
  if (process.env.PET_SHOTS) await page.screenshot({ path: `${process.env.PET_SHOTS}/${name}.png` });
};

const TILE = 32;
const world = (page: Page): Promise<PetWorld> => page.evaluate(() => (window as unknown as Win).__state.world);
const change = (page: Page, patch: (world: PetWorld) => PetWorld): Promise<void> =>
  page.evaluate(`(() => { const s = window.__state; s.setWorld((${patch.toString()})(s.world)); })()`) as Promise<void>;
const count = async (page: Page, item: string): Promise<number> => (await world(page)).bag.filter((stack) => stack.item === item).reduce((sum, stack) => sum + stack.count, 0);

async function open(page: Page): Promise<void> {
  await page.goto('/help-tower-game/?test');
  await page.waitForFunction(() => (window as unknown as Partial<Win>).__game?.scene.isActive('Base'));
}

/** ยืนให้เท้าอยู่ที่จุดนี้ (พิกเซลโลก) ในฉากที่บอก */
const standAt = (page: Page, sceneKey: string, x: number, y: number): Promise<void> =>
  page.evaluate(
    ([key, feetX, feetY]) => {
      const scene = (window as unknown as Win).__game.scene.getScene(key as string) as { player: PlayerView };
      scene.player.moveTo({ x: feetX as number, y: (feetY as number) - (scene.player.feetY - scene.player.body.y) });
    },
    [sceneKey, x, y],
  );

/** ยืนข้างสัตว์ตัวนี้ในลานบ้าน */
async function standByPet(page: Page, id: string): Promise<void> {
  const spot = await page.evaluate((pet) => {
    const scene = (window as unknown as Win).__game.scene.getScene('Base') as { petsView: { spot(id: string): { x: number; y: number } | null } };
    return scene.petsView.spot(pet);
  }, id);
  if (!spot) throw new Error(`no ${id} in the yard`);
  await standAt(page, 'Base', spot.x + 16, spot.y + 4);
}

test('pets: find Pangpok hurt in gate 2, take it home, treat it 2 days, buy the coop, then collect its egg and see it in the pets book', async ({ page }) => {
  await open(page);
  const act = page.locator('#action-button');

  // เจอปังป๊อกบาดเจ็บในเกต 2 พากลับบ้าน
  await page.evaluate(() => (window as unknown as Win).__enterGate(2));
  await page.waitForFunction(() => {
    const game = (window as unknown as Win).__game;
    return game.scene.isActive('Gate') && (game.scene.getScene('Gate') as { ready: boolean }).ready;
  });
  const hurt = await page.evaluate(() => {
    const scene = (window as unknown as Win).__game.scene.getScene('Gate') as { pet: { id: string; image: { x: number; y: number } } | null };
    return scene.pet ? { id: scene.pet.id, x: scene.pet.image.x, y: scene.pet.image.y } : null;
  });
  expect(hurt?.id).toBe('pangpok');
  await shot(page, 'pet_01_gate');
  await standAt(page, 'Gate', hurt!.x + 18, hurt!.y + 2);
  await expect(act).toHaveAttribute('aria-label', 'พากลับบ้าน');
  await act.click();
  await expect.poll(async () => (await world(page)).pets.pangpok?.stage).toBe('treating');
  expect(await page.evaluate(() => ((window as unknown as Win).__game.scene.getScene('Gate') as { pet: unknown }).pet)).toBeNull();
  await standAt(page, 'Gate', 11 * TILE, 11.4 * TILE);
  await page.keyboard.down('s');
  await page.waitForFunction(() => (window as unknown as Win).__game.scene.isActive('Base'), undefined, { timeout: 10_000 });
  await page.keyboard.up('s');

  // รักษาวันละครั้ง ข้าวโพด 2 กับผ้าพันแผลกะเพรา 1 ครบ 2 วันหาย แล้วรอเล้า
  await page.waitForTimeout(300);
  await standByPet(page, 'pangpok');
  await shot(page, 'pet_02_treating');
  await expect(act).toHaveAttribute('aria-label', 'รักษา');
  await act.click();
  expect((await world(page)).pets.pangpok?.treatedDays).toBe(0);
  await change(page, (w) => ({ ...w, bag: [...w.bag, { item: 'produce_corn', count: 4 }, { item: 'basil_bandage', count: 2 }] }));
  await act.click();
  await expect.poll(async () => (await world(page)).pets.pangpok?.treatedDays).toBe(1);
  await act.click();
  expect((await world(page)).pets.pangpok?.treatedDays).toBe(1);
  await change(page, (w) => ({ ...w, day: w.day + 1, hour: 9 }));
  await act.click();
  await expect.poll(async () => (await world(page)).pets.pangpok?.stage).toBe('needs_home');

  // ซื้อเล้าในจีโอมาร์ท หมวดบ้าน&ฟาร์ม ทุ่งสัตว์เลี้ยงเปิด ปังป๊อกย้ายไปอยู่ข้างเล้า
  await change(page, (w) => ({ ...w, wallet: { ...w.wallet, coins: 10_000 } }));
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="shop"]').click();
  await page.locator('[data-shop-tab="farm"]').click();
  await page.locator('[data-offer="farm:home_coop_kaipok"]').click();
  await page.locator('#shop-buy').click();
  await expect.poll(async () => (await world(page)).pets.pangpok?.stage).toBe('living');
  expect((await world(page)).wallet.coins).toBe(4_000);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect
    .poll(() => page.evaluate(() => ((window as unknown as Win).__game.scene.getScene('Base') as { petHomes: Map<string, unknown>; meadowShown: boolean }).petHomes.has('home_coop_kaipok')))
    .toBe(true);
  expect(await page.evaluate(() => ((window as unknown as Win).__game.scene.getScene('Base') as { meadowShown: boolean }).meadowShown)).toBe(true);

  // เช้าวันใหม่มีไข่รอเก็บ · เก็บแล้วให้อาหาร แล้วลูบ
  await change(page, (w) => ({ ...w, pets: { ...w.pets, pangpok: { ...w.pets.pangpok!, stored: 1 } } }));
  await page.waitForTimeout(300);
  await standByPet(page, 'pangpok');
  await shot(page, 'pet_03_home');
  await expect(act).toHaveAttribute('aria-label', 'เก็บผลผลิต');
  const eggs = await count(page, 'ing_egg');
  await act.click();
  await expect.poll(() => count(page, 'ing_egg')).toBe(eggs + 1);
  await expect(act).toHaveAttribute('aria-label', 'ให้อาหาร');

  // สมุดดูแลสัตว์: ปังป๊อกอยู่ด้วยแล้ว
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator('[data-app="pets"]').click();
  const book = page.locator('#pets-book');
  await expect(book.locator('[data-pet="pangpok"]')).toHaveAttribute('data-state', 'living');
  await expect(book.locator('.pt-tc')).toContainText('1');
  await expect(book).toContainText('ไข่');
  await shot(page, 'pet_04_book');
});
