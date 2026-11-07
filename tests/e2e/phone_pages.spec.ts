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

test('pets book: a not-met pet is a silhouette on the paper with a green "?", a pet with no art is just a big "?"', async ({ page }) => {
  await open(page);
  await openApp(page, 'pets');
  const book = page.locator('#pets-book');
  await book.locator('[data-pet="pangpok"]').click();
  await expect(book.locator('.pt-scene')).toHaveCount(0);
  const sil = book.locator('.pt-sil');
  await expect(sil).toHaveAttribute('src', /sil_pangpok/);
  // ขยาย 2 เท่า (28×31 → 56×62) กลางที่ x 148 เท้าที่ y 120
  expect(await sil.evaluate((node) => [(node as HTMLElement).offsetLeft + (node as HTMLElement).offsetWidth / 2, (node as HTMLElement).offsetTop + (node as HTMLElement).offsetHeight, (node as HTMLElement).offsetWidth])).toEqual([148, 120, 56]);
  await expect(book.locator('.pt-q-sil')).toHaveCSS('color', 'rgb(122, 174, 150)');
  await book.locator('[data-pet="mumu"]').click();
  expect(await book.locator('.pt-sil').evaluate((node) => (node as HTMLElement).offsetWidth)).toBe(56);
  await book.locator('[data-pet="pokpaek"]').click();
  await expect(book.locator('.pt-sil')).toHaveCount(0);
  await expect(book.locator('.pt-q-big')).toHaveText('?');
  await expect(book.locator('.pt-q-big')).toHaveCSS('color', 'rgb(122, 174, 150)');
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
