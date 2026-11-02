import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { createRng } from '../core/rng';
import { gameState, type BagStack } from '../core/state';
import balance from '../data/balance.json';
import { convertToSeeds, cropOfItem, isSeed } from '../systems/farm';
import { artUrl } from './pixelArt';

const rng = createRng(Date.now());

export const itemName = (item: string): string => {
  const crop = t(`crop.${cropOfItem(item)}.name` as TextKey);
  return isSeed(item) ? `${t('bag.seed_prefix')}${crop}` : crop;
};

export const itemIcon = (item: string): string => artUrl(isSeed(item) ? `seed_${cropOfItem(item)}` : `icon_${cropOfItem(item)}`);

function slotButton(stack: BagStack | undefined, selected: boolean, onPick: () => void): HTMLElement {
  const slot = document.createElement('button');
  slot.type = 'button';
  slot.className = `bag-slot${selected ? ' is-selected' : ''}`;
  if (!stack) {
    slot.disabled = true;
    return slot;
  }
  slot.dataset.item = stack.item;
  slot.setAttribute('aria-label', itemName(stack.item));
  const icon = document.createElement('img');
  icon.className = 'pixel-img';
  icon.alt = '';
  icon.src = itemIcon(stack.item);
  const count = document.createElement('b');
  count.textContent = String(stack.count);
  slot.append(icon, count);
  slot.addEventListener('click', onPick);
  return slot;
}

export function createInventoryPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'phone-page bag-page';
  page.id = 'bag-page';
  const title = document.createElement('h2');
  title.textContent = t('app.inventory');
  const detail = document.createElement('div');
  detail.className = 'bag-detail';
  const grid = document.createElement('div');
  grid.className = 'bag-grid';
  page.append(title, detail, grid);

  let picked: string | null = null;
  let shownBag: BagStack[] | null = null;

  const render = (): void => {
    const { bag } = gameState.world;
    shownBag = bag;
    if (picked && !bag.some((stack) => stack.item === picked)) picked = null;
    grid.replaceChildren(
      ...Array.from({ length: balance.farm.bag.slots }, (_, index) =>
        slotButton(bag[index], Boolean(picked && bag[index]?.item === picked), () => {
          picked = bag[index]?.item ?? null;
          render();
        }),
      ),
    );
    detail.replaceChildren();
    if (!picked) {
      detail.append(Object.assign(document.createElement('small'), { textContent: t('bag.hint') }));
      return;
    }
    detail.append(Object.assign(document.createElement('b'), { textContent: itemName(picked) }));
    if (isSeed(picked)) return;
    const convert = document.createElement('button');
    convert.id = 'bag-convert';
    convert.type = 'button';
    convert.className = 'phone-tool';
    convert.textContent = t('bag.convert');
    convert.addEventListener('click', () => {
      const next = picked ? convertToSeeds(gameState.world, cropOfItem(picked), rng) : null;
      if (next) gameState.setWorld(next);
      else eventBus.emit('player-says', 'bagFull');
      render();
    });
    detail.append(convert);
  };

  // หน้าเดียวกันเปิดซ้ำได้ จึงวาดใหม่เมื่อของในกระเป๋าเปลี่ยน
  eventBus.on('world-changed', ({ bag }) => {
    if (bag !== shownBag) render();
  });
  render();
  return page;
}
