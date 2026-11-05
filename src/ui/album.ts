import { t, type TextKey } from '../core/i18n';
import { gameState } from '../core/state';
import shopJson from '../data/shop.json';
import type { ShopData } from '../data/schema';
import { artUrl } from './pixelArt';

const shop = shopJson as ShopData;
const PHOTO = 'gio_eat_lick';
/** เฟรมที่จีโอเลียแมวเลียเห็นชัดที่สุด ใช้เป็นรูปในอัลบั้มจนกว่าจะมีรูปของแต่ละรส */
const PHOTO_FRAME = 6;
const PHOTO_PX = 56;
const PHOTO_FRAMES = 12;

/**
 * อัลบั้มจีโอ: รูปจีโอกินแมวเลียแต่ละรส รสที่เคยให้แล้วรูปเปิด รสที่ยังไม่เคยเป็นเงา
 * GDD ให้อัลบั้มเปิดวันที่ 7 จากเควส ตอนนี้เปิดได้เลย ผูกกับเควสใน M9 · กรอบรูปยังไม่มีภาพ ใช้กรอบสีแทน
 */
export function createAlbumPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'phone-page album-page';
  const title = document.createElement('h2');
  title.textContent = t('album.title');
  const grid = document.createElement('div');
  grid.className = 'album-grid';
  const count = document.createElement('p');
  count.className = 'album-count';
  page.append(title, count, grid);

  const render = (): void => {
    const seen = gameState.started ? gameState.world.gio.album : [];
    count.textContent = t('album.count').replace('{n}', String(seen.filter((item) => shop.treats.some((treat) => treat.item === item)).length)).replace('{total}', String(shop.treats.length));
    grid.replaceChildren(
      ...shop.treats.map(({ item }) => {
        const open = seen.includes(item);
        const card = document.createElement('div');
        card.className = `album-card${open ? '' : ' is-locked'}`;
        card.dataset.album = item;
        const photo = document.createElement('i');
        photo.className = 'album-photo';
        photo.style.backgroundImage = `url("${artUrl(PHOTO)}")`;
        photo.style.setProperty('--frame', String(PHOTO_FRAME));
        photo.style.setProperty('--size', String(PHOTO_PX));
        photo.style.setProperty('--frames', String(PHOTO_FRAMES));
        const treat = document.createElement('img');
        treat.className = 'album-treat';
        treat.alt = '';
        treat.src = artUrl(item);
        const name = document.createElement('b');
        name.textContent = open ? t(`item.${item}.name` as TextKey) : t('album.locked');
        // พื้นชมพูอยู่ที่กรอบ ภาพเงาของรสที่ยังไม่เปิดจึงเป็นเงาจีโอบนพื้นชมพู ไม่ใช่กล่องดำ
        const frame = document.createElement('span');
        frame.className = 'album-frame';
        frame.append(photo);
        card.append(frame, treat, name);
        return card;
      }),
    );
  };
  page.addEventListener('phone-page-shown', render);
  render();
  return page;
}
