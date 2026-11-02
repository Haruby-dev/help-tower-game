import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { createRng } from '../core/rng';
import { gameState, type BagStack } from '../core/state';
import balance from '../data/balance.json';
import { eatItem, fullnessOf, isDish, isIngredient, parseDish, recipes } from '../systems/cooking';
import { convertToSeeds, crops, cropOfItem, isSeed } from '../systems/farm';
import { artUrl } from './pixelArt';

const rng = createRng(Date.now());

type BagTab = 'all' | 'seeds' | 'produce' | 'goods';

const TABS: { id: BagTab; label: TextKey }[] = [
  { id: 'all', label: 'bag.tab_all' },
  { id: 'seeds', label: 'bag.tab_seeds' },
  { id: 'produce', label: 'bag.tab_produce' },
  { id: 'goods', label: 'bag.tab_goods' },
];

const isProduce = (item: string): boolean => item.startsWith('produce_');
const isKnownCrop = (item: string): boolean => crops[cropOfItem(item)] !== undefined;

const STAR = '★';
const flavourKey = (item: string): TextKey => {
  if (isSeed(item)) return 'bag.flavour_seed';
  if (isDish(item)) return 'bag.flavour_dish';
  return isIngredient(item) ? 'bag.flavour_ingredient' : 'bag.flavour_produce';
};

const inTab = (item: string, tab: BagTab): boolean => {
  if (tab === 'seeds') return isSeed(item);
  if (tab === 'produce') return isProduce(item);
  if (tab === 'goods') return !isSeed(item) && !isProduce(item);
  return true;
};

/** ของที่ยังไม่รู้จักแสดงเป็นรหัสแทน กระเป๋าจะได้เปิดได้เสมอ */
export const itemName = (item: string): string => {
  if (isDish(item)) {
    const key = `dish.${parseDish(item).recipe}.name` as TextKey;
    return t(key) ?? item;
  }
  if (isIngredient(item)) return t(`ingredient.${item.slice('ing_'.length)}.name` as TextKey) ?? item;
  if (!isKnownCrop(item)) return item;
  const crop = t(`crop.${cropOfItem(item)}.name` as TextKey);
  return isSeed(item) ? `${t('bag.seed_prefix')}${crop}` : crop;
};

/** รูปในช่องกระเป๋าไม่มีประกาย รูปในการ์ดรายละเอียดมีประกาย */
function artFor(item: string, sparkly: boolean): string | null {
  if (isDish(item)) return recipes[parseDish(item).recipe]?.icon ?? null;
  if (!isKnownCrop(item)) return null;
  const crop = cropOfItem(item);
  if (isSeed(item)) return `seed_${crop}`;
  return sparkly ? `icon_${crop}` : `icon_bag_${crop}`;
}

/** ไม่มีภาพใช้กล่องสีแทนตามกฎทะเบียน ขนาดเป็นจำนวนเท่าของจุดพิกเซลเสมอ */
export function itemImage(item: string, sparkly: boolean, scale = 1): HTMLElement {
  const id = artFor(item, sparkly);
  const entry = id ? registry[id] : undefined;
  if (!id || entry?.type !== 'local') {
    const box = document.createElement('i');
    box.className = 'item-missing';
    box.textContent = itemName(item);
    return box;
  }
  const image = document.createElement('img');
  image.className = 'pixel-img';
  image.alt = '';
  image.src = artUrl(id);
  image.style.width = `calc(var(--px) * ${entry.width * scale})`;
  image.style.height = `calc(var(--px) * ${entry.height * scale})`;
  return image;
}

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
  const count = document.createElement('b');
  count.textContent = String(stack.count);
  slot.append(itemImage(stack.item, false), count);
  slot.addEventListener('click', onPick);
  return slot;
}

export function createInventoryPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'bag-page';
  page.id = 'bag-page';
  const title = document.createElement('h2');
  title.textContent = t('app.inventory');
  const tabs = document.createElement('div');
  tabs.className = 'bag-tabs';
  const used = document.createElement('b');
  used.id = 'bag-used';
  const header = document.createElement('div');
  header.className = 'bag-header';
  header.append(title, tabs, used);
  const grid = document.createElement('div');
  grid.className = 'bag-grid';
  const detail = document.createElement('div');
  detail.className = 'bag-detail';
  const body = document.createElement('div');
  body.className = 'bag-body';
  body.append(grid, detail);
  page.append(header, body);

  let tab: BagTab = 'all';
  let picked: string | null = null;
  let shownBag: BagStack[] | null = null;

  const renderDetail = (bag: BagStack[]): void => {
    detail.replaceChildren();
    if (!picked) {
      detail.append(Object.assign(document.createElement('small'), { textContent: t('bag.hint') }));
      return;
    }
    const item = picked;
    const count = bag.filter((stack) => stack.item === item).reduce((sum, stack) => sum + stack.count, 0);
    const stars = isDish(item) ? ` ${STAR.repeat(parseDish(item).stars)}` : '';
    const name = Object.assign(document.createElement('b'), { textContent: `${itemName(item)}${stars}` });
    const amount = Object.assign(document.createElement('span'), { className: 'bag-detail__count', textContent: `×${count}` });
    const flavour = Object.assign(document.createElement('small'), {
      textContent: t(flavourKey(item)),
    });
    // ภาพอาหารผืน 48px ใหญ่พออยู่แล้ว จึงไม่ขยาย 2 เท่า
    detail.append(itemImage(item, true, isDish(item) ? 1 : 2), name, amount, flavour);
    if (fullnessOf(item) !== null) {
      const eat = document.createElement('button');
      eat.id = 'bag-eat';
      eat.type = 'button';
      eat.className = 'phone-tool';
      eat.textContent = t('bag.eat');
      eat.addEventListener('click', () => {
        const next = eatItem(gameState.world, item);
        if (next) gameState.setWorld(next);
        render();
      });
      detail.append(eat);
    }
    if (!isProduce(item)) return;
    const convert = document.createElement('button');
    convert.id = 'bag-convert';
    convert.type = 'button';
    convert.className = 'phone-tool';
    convert.textContent = t('bag.convert');
    convert.addEventListener('click', () => {
      const next = convertToSeeds(gameState.world, cropOfItem(item), rng);
      if (next) gameState.setWorld(next);
      else eventBus.emit('player-says', 'bagFull');
      render();
    });
    // เปิดใช้เมื่อมีการฝากขายใน M6
    const sell = document.createElement('button');
    sell.id = 'bag-sell';
    sell.type = 'button';
    sell.className = 'phone-tool';
    sell.disabled = true;
    sell.textContent = t('bag.sell_tray');
    detail.append(convert, sell);
  };

  function render(): void {
    const { bag } = gameState.world;
    shownBag = bag;
    if (picked && !bag.some((stack) => stack.item === picked)) picked = null;
    tabs.replaceChildren(
      ...TABS.map(({ id, label }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `bag-tab${id === tab ? ' is-active' : ''}`;
        button.dataset.bagTab = id;
        button.textContent = t(label);
        button.addEventListener('click', () => {
          tab = id;
          render();
        });
        return button;
      }),
    );
    used.textContent = `${bag.length}/${balance.farm.bag.slots}`;
    const shown = bag.filter((stack) => inTab(stack.item, tab));
    grid.replaceChildren(
      ...Array.from({ length: balance.farm.bag.slots }, (_, index) => {
        const stack = shown[index];
        return slotButton(stack, Boolean(stack && stack.item === picked), () => {
          picked = stack?.item ?? null;
          render();
        });
      }),
    );
    renderDetail(bag);
  }

  // หน้าเดียวกันเปิดซ้ำได้ จึงวาดใหม่เมื่อของในกระเป๋าเปลี่ยน
  eventBus.on('world-changed', ({ bag }) => {
    if (bag !== shownBag) render();
  });
  render();
  return page;
}
