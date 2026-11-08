import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type BagStack } from '../core/state';
import balance from '../data/balance.json';
import { MYSTERY, fullnessOf, isDish, isIngredient, parseDish, recipes } from '../systems/cooking';
import { cosmeticTable, isChest } from '../systems/chests';
import { crops, cropOfItem, isFertilizer, isSeed } from '../systems/farm';
import { baseItem, starsOf } from '../systems/stars';
import { fishOfItem, isBait, isFish, makeBait } from '../systems/fishing';
import { toppingTable, toppingsOf } from '../systems/toppings';
import { artUrl } from './pixelArt';
import { isTreat } from '../systems/gio';
import type { PhonePage } from './phone';


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
const EQUIPPABLE = { canSkins: 'canSkin' } as const;

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

/** รหัสภาพของในช่องกระเป๋า (ไม่มีประกาย) null คือยังไม่มีภาพ */
export const bagArtId = (item: string): string | null => artFor(item, false);

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
  slot.className = `pb-slot${selected ? ' is-selected' : ''}${stack ? '' : ' is-empty'}`;
  if (!stack) {
    slot.disabled = true;
    return slot;
  }
  slot.dataset.item = stack.item;
  slot.setAttribute('aria-label', itemName(stack.item));
  const count = document.createElement('b');
  count.textContent = String(stack.count);
  const image = itemImage(stack.item, false);
  image.classList.add('pb-slot__art');
  slot.append(image, count);
  cornerBadge(slot, stack.item);
  slot.addEventListener('click', onPick);
  return slot;
}

/** ภาพใหญ่ในวงกลมการ์ดขวา: 2 เท่าถ้าใส่วงกลมได้ อาหารใช้ภาพในกระเป๋าเพราะภาพ 48 พิกเซลใหญ่เกินวง */
const DETAIL_FITS_PX = 37;
function detailImage(item: string, sparkly: boolean): HTMLElement {
  const shiny = sparkly && !isDish(item);
  const id = artFor(item, shiny);
  const entry = id ? registry[id] : undefined;
  const fits = entry?.type === 'local' && entry.width <= DETAIL_FITS_PX && entry.height <= DETAIL_FITS_PX;
  return itemImage(item, shiny, fits ? 2 : 1);
}

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** ป้ายข้อมูลสั้น ๆ ใต้ชื่อ: ประเภท แรงก์ อิ่ม และจำนวนที่มี */
/** ท็อปปิ้งบนจานเป็นตัวหนังสือ เช่น "ผงนัว · ต้นหอม ×2" (ใช้ชื่อของที่ใช้ทำท็อปปิ้ง) */
export function toppingText(toppings: string[]): string {
  const counts = new Map<string, number>();
  for (const id of toppings) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts]
    .map(([id, count]) => {
      const name = itemName(toppingTable[id]?.item ?? id);
      return count > 1 ? `${name} ×${count}` : name;
    })
    .join(' · ');
}

function factsOf(item: string, count: number): string[] {
  const facts: string[] = [];
  if (isDish(item)) {
    const recipe = recipes[parseDish(item).recipe];
    if (recipe) facts.push(`${t(`recipe.tab_${recipe.category}` as TextKey)} · ${recipe.rank}`);
    // ภาพในกระเป๋าเล็กเกินจะเห็นท็อปปิ้ง จึงบอกเป็นตัวหนังสือ
    const toppings = toppingsOf(item);
    if (toppings.length > 0) facts.push(`${t('bag.fact_toppings')} ${toppingText(toppings)}`);
  }
  const fullness = fullnessOf(item);
  if (fullness !== null) facts.push(`${t('bag.fact_full')} +${fullness}`);
  facts.push(`${t('bag.fact_have')} ${count}`);
  return facts;
}

/** ป้ายดาวใหญ่ใต้ชื่อในการ์ดขวา (ภาพป้ายดาวขนาด 2 เท่า) */
function bigBadge(item: string): HTMLElement {
  const stars = Math.min(3, Math.max(1, starsOf(item) ?? 1));
  const id = `star_badge_${stars}`;
  const entry = registry[id];
  const image = document.createElement('img');
  image.className = 'pixel-img pb-stars';
  image.alt = '';
  image.dataset.stars = String(stars);
  image.src = artUrl(id);
  if (entry?.type === 'local') {
    image.style.width = `calc(var(--px) * ${entry.width * 2})`;
    image.style.height = `calc(var(--px) * ${entry.height * 2})`;
  }
  return image;
}

/** แอปกระเป๋า (bag_status_A): การ์ดซ้ายช่องของแบบสมุดสติกเกอร์ 6×5 ช่อง การ์ดขวาของที่เลือกในวงกลมใหญ่ */
export function createInventoryPage(): PhonePage {
  const left = element('div', 'pz pb');
  left.id = 'bag-page';
  const title = element('div', 'tape pb-title', t('app.inventory'));
  const tabs = element('div', 'pb-tabs');
  const grid = element('div', 'pb-grid bag-grid');
  const used = element('div', 'pb-hint');
  const usedNumber = element('b', '');
  usedNumber.id = 'bag-used';
  left.append(title, tabs, grid, used);
  const right = element('div', 'pz pb-detail bag-detail');

  let tab: BagTab = 'all';
  let picked: string | null = null;
  let shownBag: BagStack[] | null = null;

  /** การ์ดขวา · ปุ่มเดียวที่ตำแหน่งเดิมเฉพาะของที่ไม่มีที่อื่นให้ใช้ (ผู้ใช้ตัดสิน 6 พ.ย. 2026): หีบ เปิดหีบ · ผัก ทำเหยื่อ · ของแต่ง ใช้แบบนี้ */
  const showDetail = (item: string | null, art: () => HTMLElement, name: string, facts: string[], flavour: string, button: HTMLButtonElement | null): void => {
    if (!item) {
      right.classList.remove('is-starless');
      right.replaceChildren(element('p', 'pb-empty', flavour));
      return;
    }
    const plate = element('div', 'pb-plate');
    plate.append(art());
    const parts: HTMLElement[] = [plate, element('div', 'pb-name', name)];
    const starred = starsOf(item) !== null;
    right.classList.toggle('is-starless', !starred);
    if (starred) parts.push(bigBadge(item));
    const factRow = element('div', 'pb-facts');
    factRow.append(...facts.map((fact) => element('span', 'pb-fact', fact)));
    parts.push(factRow, element('div', 'pb-desc', flavour));
    if (button) {
      const row = element('div', 'pb-btns');
      row.append(button);
      parts.push(row);
    }
    right.replaceChildren(...parts);
  };

  const actionButton = (id: string, label: TextKey, onClick: () => void, disabled = false): HTMLButtonElement => {
    const button = element('button', 'pb-btn', t(label));
    button.id = id;
    button.type = 'button';
    button.disabled = disabled;
    button.addEventListener('click', onClick);
    return button;
  };

  const renderDetail = (bag: BagStack[]): void => {
    if (!picked) {
      showDetail(null, () => element('i', ''), '', [], t('bag.hint'), null);
      return;
    }
    const item = picked;
    const count = bag.filter((stack) => stack.item === item).reduce((sum, stack) => sum + stack.count, 0);
    let button: HTMLButtonElement | null = null;
    if (isChest(item)) button = actionButton('bag-open-chest', 'bag.open_chest', () => eventBus.emit('chest-open', item));
    else if (isProduce(item))
      button = actionButton('bag-make-bait', 'bag.make_bait', () => {
        const next = makeBait(gameState.world, item);
        if (next) gameState.setWorld(next);
        else eventBus.emit('player-says', 'bagFull');
        render();
      });
    showDetail(item, () => detailImage(item, true), itemName(item), factsOf(item, count), t(flavourKey(item)), button);
  };

  /** ของแต่ง ของเล่น และของที่ยังไม่มีระบบ ไม่กินช่องกระเป๋า */
  const collectionOf = (): CollectionItem[] => {
    const { cosmetics, toys, stash } = gameState.world;
    const order = ['canSkins', 'wallpapers', 'charms', 'clips'] as const;
    return [
      ...order.flatMap((slot) => cosmetics.owned[slot].map((id): CollectionItem => ({ id, kind: 'cosmetic', count: 1 }))),
      ...toys.map((id): CollectionItem => ({ id, kind: 'toy', count: 1 })),
      ...Object.entries(stash).map(([id, count]): CollectionItem => ({ id, kind: 'stash', count })),
    ];
  };

  const renderCollectionDetail = (entry: CollectionItem | undefined): void => {
    if (!entry) {
      showDetail(null, () => element('i', ''), '', [], t('bag.collection_empty'), null);
      return;
    }
    const flavour = entry.kind === 'cosmetic' ? 'bag.flavour_cosmetic' : entry.kind === 'toy' ? 'bag.flavour_toy' : 'bag.flavour_stash';
    const slot = cosmeticTable[entry.id]?.slot;
    let button: HTMLButtonElement | null = null;
    if (entry.kind === 'cosmetic' && slot === 'canSkins') {
      const key = EQUIPPABLE[slot];
      const { cosmetics } = gameState.world;
      const wearing = cosmetics.equipped[key] === entry.id;
      button = actionButton(
        'bag-equip',
        wearing ? 'bag.equipped' : 'bag.equip',
        () => {
          gameState.setWorld({ ...gameState.world, cosmetics: { ...cosmetics, equipped: { ...cosmetics.equipped, [key]: entry.id } } });
          render();
        },
        wearing,
      );
    }
    const facts = entry.kind === 'stash' ? [`${t('bag.fact_have')} ${entry.count}`] : [];
    showDetail(entry.id, () => itemImage(entry.id, true), itemName(entry.id), facts, t(flavour), button);
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
    if (!gameState.started) return;
    const { bag } = gameState.world;
    shownBag = bag;
    if (tab !== 'collection' && picked && !bag.some((stack) => stack.item === picked)) picked = null;
    tabs.replaceChildren(
      ...TABS.map(({ id, label }) => {
        const button = element('button', `pb-tab${id === tab ? ' is-active' : ''}`, t(label));
        button.type = 'button';
        button.dataset.bagTab = id;
        button.addEventListener('click', () => {
          tab = id;
          render();
        });
        return button;
      }),
    );
    usedNumber.textContent = `${bag.length}/${balance.farm.bag.slots}`;
    used.replaceChildren(usedNumber, ` ${t('bag.slots_word')}`);
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
  return { left, right, shown: render };
}
