import { expect, test, type Page } from '@playwright/test';

// art update 2026-11-07b: แผนที่หอคอยเปิดครบ 10 ชั้น มอนสเตอร์ประจำชั้นยืนบนกระดาษ · สัตว์ที่ยังไม่เจอเป็นเงาบนกระดาษ · อัลบั้มมีรูปเงาใหญ่ของตัวที่เคยมา

interface TestState {
  world: { monsters: { affection: Record<string, unknown>; twins: Record<string, unknown> } };
  setWorld(world: unknown): void;
}

test.setTimeout(120_000);

async function open(page: Page): Promise<void> {
  await page.goto('/help-tower-game/?test');
  await page.waitForFunction(() => (window as unknown as { __game?: { scene: { isActive(k: string): boolean } } }).__game?.scene.isActive('Base'));
}

const IDS = ['puinun', 'popcorn', 'mookmik', 'toomtia', 'tangkrading', 'tangkrading_b', 'yaibaimai', 'wingwing', 'tubpong', 'jaotungtong', 'puefaotung'];

/** ทุกชั้นในโซน 1 ครบ 100% และแฝดเฉลยแล้ว */
const clearZone = (page: Page): Promise<void> =>
  page.evaluate((ids) => {
    const s = (window as unknown as { __state: TestState }).__state;
    const affection = Object.fromEntries(ids.map((id) => [id, { points: 100000, signature: true }]));
    s.setWorld({ ...s.world, monsters: { ...s.world.monsters, affection, twins: { ...s.world.monsters.twins, revealed: true, quizWon: true } } });
  }, IDS);

async function openApp(page: Page, app: string): Promise<void> {
  await page.locator('#phone-button').click();
  await page.locator('#lock-open').click();
  await page.locator(`[data-app="${app}"]`).click();
}

test('gate map: all ten floors drawn open, floor 10 shows its owner on the paper, a shut floor shows only the padlock', async ({ page }) => {
  await open(page);
  // ยังไม่มีชั้นไหนเปิด: หน้าขวามีแค่กุญแจ ไม่มีกรอบฉากเกต
  await openApp(page, 'gate');
  const book = page.locator('#gate-book');
  await expect(book.locator('.gt-lock')).toHaveCount(1);
  await expect(book.locator('.gt-owner')).toHaveCount(0);
  await expect(book.locator('.gt-scene')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.locator('#phone-close').click();

  await clearZone(page);
  await openApp(page, 'gate');
  await expect(book.locator('.gt-open')).toHaveCount(10);
  await book.locator('[data-floor="10"]').click();
  const owner = book.locator('.gt-owner');
  await expect(owner).toHaveAttribute('data-art', 'monster_puefaotung_sweet_stand');
  // ขนาดจริง 64×64 กลางที่ x 148 เท้าที่ y 118 (ผู้เฝ้าทุ่ง feetRow 60)
  const box = await owner.evaluate((node) => { const el = node as HTMLElement; return { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight }; });
  expect(box).toEqual({ left: 148 - 32, top: 118 - 61, width: 64, height: 64 });
  await expect(book.locator('.gt-lock')).toHaveCount(0);
  // ชั้น 5 เป็นแฝดพี่
  await book.locator('[data-floor="5"]').click();
  await expect(owner).toHaveAttribute('data-art', 'monster_tangkrading_sweet_stand');
});

test('pets and mail books show only what was found: nothing yet means one gentle line, no slots, gate numbers or zones', async ({ page }) => {
  await open(page);
  // ข้อ A8: ยังไม่เจอสัตว์ตัวไหน ไม่มีการ์ด 15 ช่อง ไม่มี "เกต N"
  await openApp(page, 'pets');
  const pets = page.locator('#pets-book');
  await expect(pets.locator('.pt-tc')).toHaveText('ยังไม่มีเพื่อนตัวไหนมาอยู่ด้วยเลย');
  await expect(pets.locator('[data-pet]')).toHaveCount(0);
  await expect(pets).not.toContainText('เกต');
  // ปิดสมุดแล้วกลับมาหน้าหลักโทรศัพท์
  await page.keyboard.press('Escape');
  // ข้อ A9: ยังไม่เคยเก็บขวด ไม่มีเงาขวด 20 ใบ ไม่มี "โซน N" หรือ "คิดถึงบ้าน"
  await page.locator('[data-app="mail"]').click();
  const mail = page.locator('#mail-book');
  await expect(mail.locator('.ml-tc')).toHaveText('ยังไม่เคยเก็บขวดจดหมายเลย');
  await expect(mail.locator('[data-letter]')).toHaveCount(0);
  await expect(mail).not.toContainText('โซน');
});

test('album: a monster that came but is not 100% yet shows its big silhouette photo', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __state: TestState }).__state;
    s.setWorld({ ...s.world, monsters: { ...s.world.monsters, affection: { toomtia: { points: 5, signature: false } } } });
  });
  await openApp(page, 'album');
  const book = page.locator('#album-book');
  await book.locator('[data-album-tab="monsters"]').click();
  await book.locator('.al-mp[data-floor="4"]').click();
  await expect(book.locator('.al-big__photo')).toHaveAttribute('src', /mpol_b_tumtia_met/);
});
