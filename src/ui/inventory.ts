import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type BagStack } from '../core/state';
import balance from '../data/balance.json';
import { MYSTERY, eatItem, fullnessOf, isDish, isIngredient, parseDish, recipes } from '../systems/cooking';
import { cosmeticTable, isChest } from '../systems/chests';
import { crops, cropOfItem, isFertilizer, isSeed } from '../systems/farm';
import { baseItem, starsOf } from '../systems/stars';
import { fishOfItem, isBait, isFish, makeBait } from '../systems/fishing';
import { artUrl } from './pixelArt';
import { isTreat } from '../systems/gio';
import { eatVoice, uiSound } from './sound';


type BagTab = 'all' | 'seeds' | 'produce' | 'goods' | 'collection';

const TABS: { id: BagTab; label: TextKey }[] = [
  { id: 'all', label: 'bag.tab_all' },
  { id: 'seeds', label: 'bag.tab_seeds' },
  { id: 'produce', label: 'bag.tab_produce' },
  { id: 'goods', label: 'bag.tab_goods' },
  { id: 'collection', label: 'bag.tab_collection' },
];
/** ภาพเคสและวอลเปเปอร์ใหญ่กว่าช่อง จึงแสดงเป็นชื่อแทน ห้ามย่อ */
const MAX_SLOT_ART_PX = 40;
/** ของแต่งที่ใช้แล้วเห็นผลในเกม ช่องอื่นเก็บธงไว้จนกว่าระบบจะมา */
const EQUIPPABLE = { canSkins: 'canSkin', cases: 'case' } as const;

type CollectionKind = 'cosmetic' | 'toy' | 'stash';
interface CollectionItem {
  id: string;
  kind: CollectionKind;
  count: number;
}

const isProduce = (item: string): boolean => item.startsWith('produce_');
const isKnownCrop = (item: string): boolean => (isSeed(item) || isProduce(item)) && crops[cropOfItem(item)] !== undefined;

const flavourKey = (item: string): TextKey => {
  if (isSeed(item)) return 'bag.flavour_seed';
  if (isFertilizer(item)) return 'bag.flavour_fertilizer';
  if (isFish(item)) return 'bag.flavour_fish';
  if (isBait(item)) return 'bag.flavour_bait';
  if (isChest(item)) return 'bag.flavour_chest';
  if (isTreat(item)) return 'bag.flavour_treat';
  if (isDish(item)) return 'bag.flavour_dish';
  return isIngredient(item) ? 'bag.flavour_ingredient' : 'bag.flavour_produce';
};

/** ปุ๋ยอยู่แท็บเมล็ด เพราะใช้กับแปลงผักผ่านช่องถุงเมล็ดเหมือนกัน */
const inTab = (item: string, tab: BagTab): boolean => {
  if (tab === 'seeds') return isSeed(item) || isFertilizer(item);
  if (tab === 'produce') return isProduce(item);
  if (tab === 'goods') return !isSeed(item) && !isFertilizer(item) && !isProduce(item);
  return true;
};

/** ของที่ยังไม่รู้จักแสดงเป็นรหัสแทน กระเป๋าจะได้เปิดได้เสมอ */
export const itemName = (item: string): string => {
  if (isDish(item)) {
    const key = `dish.${parseDish(item).recipe}.name` as TextKey;
    return t(key) ?? item;
  }
  if (isIngredient(item)) return t(`ingredient.${item.slice('ing_'.length)}.name` as TextKey) ?? item;
  if (isFish(item)) return t(`fish.${fishOfItem(item)}.name` as TextKey) ?? item;
  if (cosmeticTable[item]) return t(`cosmetic.${item}.name` as TextKey) ?? item;
  if (!isKnownCrop(item)) return t(`item.${baseItem(item)}.name` as TextKey) ?? item;
  const crop = t(`crop.${cropOfItem(item)}.name` as TextKey);
  return isSeed(item) ? `${t('bag.seed_prefix')}${crop}` : crop;
};

/** รูปในช่องกระเป๋าไม่มีประกาย รูปในการ์ดรายละเอียดมีประกาย */
function artFor(item: string, sparkly: boolean): string | null {
  if (isDish(item)) {
    const { recipe } = parseDish(item);
    if (recipe === MYSTERY) return sparkly ? balance.cooking.mystery.icon : balance.cooking.mystery.bagIcon;
    const info = recipes[recipe];
    return (sparkly ? info?.icon : info?.bagIcon) ?? null;
  }
  if (isIngredient(item)) return `ing_icon_${item.slice('ing_'.length).toLowerCase()}`;
  const cosmetic = cosmeticTable[item];
  if (cosmetic) {
    const art = registry[cosmetic.art];
    return art?.type === 'local' && art.width <= MAX_SLOT_ART_PX ? cosmetic.art : null;
  }
  // ปลา เหยื่อ หีบ ของเล่น ใช้รหัสของเป็นรหัสภาพ
  if (!isKnownCrop(item)) return registry[item] ? item : null;
  const crop = cropOfItem(item);
  if (isSeed(item)) return `seed_${crop}`;
  return sparkly ? `icon_${crop}` : `icon_bag_${crop}`;
}

/** ป้ายดาวสีทอง (ภาพ 1–3 ดาว) ใส่ตัวเลขดาวหรือรหัสของที่มีดาว */
export function starBadge(of: number | string): HTMLElement {
  const stars = Math.min(3, Math.max(1, typeof of === 'number' ? of : starsOf(of) ?? 1));
  const id = `star_badge_${stars}`;
  const entry = registry[id];
  const image = document.createElement('img');
  image.className = 'pixel-img star-badge';
  image.alt = '';
  image.dataset.stars = String(stars);
  image.src = artUrl(id);
  if (entry?.type === 'local') {
    image.style.width = `calc(var(--px) * ${entry.width})`;
    image.style.height = `calc(var(--px) * ${entry.height})`;
  }
  return image;
}

/** ของที่มีดาว (ผักจากแปลงและอาหาร) มีป้ายดาวที่มุมซ้ายล่างของช่อง ห่างขอบ 1 พิกเซล */
export function cornerBadge(slot: HTMLElement, item: string): void {
  if (starsOf(item) === null) return;
  const badge = starBadge(item);
  badge.classList.add('star-badge--corner');
  slot.append(badge);
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
  cornerBadge(slot, stack.item);
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
    const name = Object.assign(document.createElement('b'), { textContent: itemName(item) });
    if (starsOf(item) !== null) name.append(' ', starBadge(item));
    const amount = Object.assign(document.createElement('span'), { className: 'bag-detail__count', textContent: `×${count}` });
    const flavour = Object.assign(document.createElement('small'), {
      textContent: t(flavourKey(item)),
    });
    // ภาพอาหารผืน 48px ใหญ่พออยู่แล้ว จึงไม่ขยาย 2 เท่า
    detail.append(itemImage(item, true, isDish(item) ? 1 : 2), name, amount, flavour);
    if (isChest(item)) {
      const open = document.createElement('button');
      open.id = 'bag-open-chest';
      open.type = 'button';
      open.className = 'phone-tool';
      open.textContent = t('bag.open_chest');
      open.addEventListener('click', () => eventBus.emit('chest-open', item));
      detail.append(open);
    }
    if (fullnessOf(item) !== null) {
      const eat = document.createElement('button');
      eat.id = 'bag-eat';
      eat.type = 'button';
      eat.className = 'phone-tool';
      eat.textContent = t('bag.eat');
      eat.addEventListener('click', () => {
        const next = eatItem(gameState.world, item);
        if (next) {
          eatVoice();
          gameState.setWorld(next);
        } else uiSound('ui_error');
        render();
      });
      detail.append(eat);
    }
    // ปุ่มแปลงผักเป็นเมล็ดเอาออกแล้วเมื่อร้านค้ามาใน M6 เหลือแค่บทสอนวันแรกใน M9 (ผู้ใช้ตัดสิน 4 พ.ย. 2026)
    if (!isProduce(item)) return;
    const bait = document.createElement('button');
    bait.id = 'bag-make-bait';
    bait.type = 'button';
    bait.className = 'phone-tool';
    bait.textContent = t('bag.make_bait');
    bait.addEventListener('click', () => {
      const next = makeBait(gameState.world, item);
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
    detail.append(bait, sell);
  };

  /** ของแต่ง ของเล่น และของที่ยังไม่มีระบบ ไม่กินช่องกระเป๋า */
  const collectionOf = (): CollectionItem[] => {
    const { cosmetics, toys, stash } = gameState.world;
    const order = ['canSkins', 'cases', 'wallpapers', 'charms', 'clips'] as const;
    return [
      ...order.flatMap((slot) => cosmetics.owned[slot].map((id): CollectionItem => ({ id, kind: 'cosmetic', count: 1 }))),
      ...toys.map((id): CollectionItem => ({ id, kind: 'toy', count: 1 })),
      ...Object.entries(stash).map(([id, count]): CollectionItem => ({ id, kind: 'stash', count })),
    ];
  };

  const renderCollectionDetail = (entry: CollectionItem | undefined): void => {
    detail.replaceChildren();
    if (!entry) {
      detail.append(Object.assign(document.createElement('small'), { textContent: t('bag.collection_empty') }));
      return;
    }
    const flavour = entry.kind === 'cosmetic' ? 'bag.flavour_cosmetic' : entry.kind === 'toy' ? 'bag.flavour_toy' : 'bag.flavour_stash';
    detail.append(
      itemImage(entry.id, true),
      Object.assign(document.createElement('b'), { textContent: itemName(entry.id) }),
      Object.assign(document.createElement('small'), { textContent: t(flavour) }),
    );
    const slot = cosmeticTable[entry.id]?.slot;
    if (entry.kind !== 'cosmetic' || (slot !== 'canSkins' && slot !== 'cases')) return;
    const key = EQUIPPABLE[slot];
    const { cosmetics } = gameState.world;
    const wearing = cosmetics.equipped[key] === entry.id;
    const equip = document.createElement('button');
    equip.id = 'bag-equip';
    equip.type = 'button';
    equip.className = 'phone-tool';
    equip.disabled = wearing;
    equip.textContent = t(wearing ? 'bag.equipped' : 'bag.equip');
    equip.addEventListener('click', () => {
      gameState.setWorld({ ...gameState.world, cosmetics: { ...cosmetics, equipped: { ...cosmetics.equipped, [key]: entry.id } } });
      render();
    });
    detail.append(equip);
  };

  const renderCollection = (): void => {
    const items = collectionOf();
    if (picked && !items.some((entry) => entry.id === picked)) picked = null;
    grid.replaceChildren(
      ...items.map((entry) => {
        const slot = slotButton({ item: entry.id, count: entry.count }, entry.id === picked, () => {
          picked = entry.id;
          render();
        });
        slot.dataset.collection = entry.kind;
        // ของแต่งกับของเล่นมีชิ้นเดียวเสมอ ไม่ต้องบอกจำนวน
        if (entry.kind !== 'stash') slot.querySelector('b')?.remove();
        return slot;
      }),
    );
    renderCollectionDetail(items.find((entry) => entry.id === picked) ?? items[0]);
  };

  function render(): void {
    const { bag } = gameState.world;
    shownBag = bag;
    if (tab !== 'collection' && picked && !bag.some((stack) => stack.item === picked)) picked = null;
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
    if (tab === 'collection') {
      renderCollection();
      return;
    }
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
  let shownCollection: unknown = null;
  eventBus.on('world-changed', ({ bag, cosmetics, toys, stash }) => {
    const collection = [cosmetics, toys, stash];
    const changed = shownCollection === null || collection.some((part, index) => part !== (shownCollection as unknown[])[index]);
    shownCollection = collection;
    if (bag !== shownBag || (tab === 'collection' && changed)) render();
  });
  render();
  return page;
}
