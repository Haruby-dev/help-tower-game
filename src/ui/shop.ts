import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState } from '../core/state';
import balance from '../data/balance.json';
import shopJson from '../data/shop.json';
import type { ShopData } from '../data/schema';
import { registry } from '../core/assets';
import { recipes } from '../systems/cooking';
import { crops, cropOfItem } from '../systems/farm';
import { formatMoney } from '../systems/economy';
import { baits } from '../systems/fishing';
import { reputationStars, setTable } from '../systems/sets';
import { toppingTable } from '../systems/toppings';
import { alreadyOwned, buyOffer, maxQuantity, offersFor, stockLeft, tasteOfTreat, type Offer, type ShopGroup } from '../systems/shop';
import { hasMet } from '../systems/monsters';
import th from '../i18n/th.json';
import { itemImage, itemName } from './inventory';
import { coinIcon, setMoney } from './money';
import type { PhonePage } from './phone';
import { sizedArt } from './pixelArt';

/** หมวดในร้าน (จีโอมาร์ท แบบ E ผู้ใช้เลือก 6 พ.ย. 2026) หนึ่งหน้าต่อหนึ่งหมวด */
type Category = 'treats' | 'seeds' | 'fertilizer' | 'ingredients' | 'toppings' | 'recipes' | 'equipment' | 'farm';
const CATEGORIES: { id: Category; label: TextKey; icon: string; tile: string; groups: ShopGroup[] }[] = [
  { id: 'treats', label: 'shop.cat_treats', icon: 'treat_tuna', tile: '#ffe3ee', groups: ['treats'] },
  { id: 'seeds', label: 'shop.cat_seeds', icon: 'ui_action_icon_plant', tile: '#e2f5ea', groups: ['seeds', 'random_seeds'] },
  { id: 'fertilizer', label: 'shop.cat_fertilizer', icon: 'shop_item_fertilizer_2', tile: '#fff1d6', groups: ['fertilizer'] },
  // หมวดใหม่ขั้นที่ 7 ใช้ภาพเดิม (เกลือ ท็อปปิ้ง) เป็นไอคอนหมวด
  { id: 'ingredients', label: 'shop.cat_ingredients', icon: 'ing_icon_salt', tile: '#e6f3fb', groups: ['ingredients'] },
  { id: 'toppings', label: 'shop.cat_toppings', icon: 'ing_icon_rainbow_sprinkles', tile: '#fde6f6', groups: ['toppings'] },
  { id: 'recipes', label: 'shop.cat_recipes', icon: 'shop_item_recipe_scroll_sweet', tile: '#e9e1fb', groups: ['recipes'] },
  { id: 'equipment', label: 'shop.cat_equipment', icon: 'ui_action_icon_cook', tile: '#dcecff', groups: [] },
  { id: 'farm', label: 'shop.cat_farm', icon: 'shop_item_farm_expand', tile: '#ffe6d8', groups: ['farm'] },
];
/** พื้นช่องภาพของแต่ละแถว (ภาพตัวอย่างใช้สีอ่อนตามของ) */
const ROW_TILES: Record<Category, string> = {
  treats: '#ffe6e6',
  seeds: '#e9f6ec',
  fertilizer: '#fff3dc',
  ingredients: '#ebf6fc',
  toppings: '#fdebf7',
  recipes: '#efe6ff',
  equipment: '#e7f0ff',
  farm: '#ffeede',
};
const ROWS_PER_PAGE = 4;
/** หน้าที่มีของแค่สองชิ้นมีโน้ตเกร็ดจีโอ */
const TIP_UNDER = 3;
const TASTE_TAG = { like: 'shop.taste_like', love: 'shop.taste_love', special: 'shop.taste_special' } as const;
const REVIEW_STARS: Record<Category, number> = { treats: 5, seeds: 4, fertilizer: 5, ingredients: 5, toppings: 5, recipes: 4, equipment: 5, farm: 5 };
/** มอนสเตอร์ที่เขียนรีวิวแต่ละหมวด (ตรงกับชื่อใน `shop.review_by_*`) · null = จีโอรีวิวเอง */
const REVIEWER: Record<Category, string | null> = {
  treats: null,
  seeds: 'mookmik',
  fertilizer: 'yaibaimai',
  ingredients: 'wingwing',
  toppings: 'tangkrading',
  recipes: 'toomtia',
  equipment: null,
  farm: 'puinun',
};
const PERCENT = 100;

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** ม้วนสูตร: อาหารคาวใช้ม้วนคาว ของหวานกับเครื่องดื่มใช้ม้วนหวาน */
const scrollFor = (recipe: string): string =>
  recipes[recipe]?.category === 'savory' ? 'shop_item_recipe_scroll_savory' : 'shop_item_recipe_scroll_sweet';

/**
 * ภาพของในร้าน สูตรเป็นม้วนกระดาษตามหมวด ของที่มีภาพบนชั้นร้านแยกใช้ภาพนั้น ของที่ยังไม่มีภาพใช้กล่องสี
 * ภาพบนชั้นต้องหน้าตาเหมือนของที่ได้จริง (ผู้ใช้ตัดสิน 5 พ.ย. 2026)
 */
const offerImage = (offer: Offer, scale: number, unit: string): HTMLElement => {
  if (offer.kind === 'recipe') return sizedArt(scrollFor(offer.target), '', unit, scale);
  // โต๊ะใหญ่ยังไม่มีไอคอนบนชั้น 32 พิกเซล แถวในรายการใช้กล่องสี หน้าสินค้าวาดโต๊ะจริงขนาดเท่าภาพ
  if (offer.kind === 'table') {
    if (unit === '--px' && registry[offer.target]?.type === 'local') return sizedArt(offer.target, '', '--px', 1);
    // ชื่อสินค้าอยู่ข้างกล่องแล้ว กล่องสีจึงไม่ต้องเขียนชื่อซ้ำ (ข้อ B5)
    return element('i', 'item-missing ps-missing');
  }
  const shelf = (shopJson as ShopData).shelfArt[offer.target] ?? `shop_item_${offer.target}`;
  if (registry[shelf]?.type === 'local') return sizedArt(shelf, '', unit, scale);
  const image = itemImage(offer.target, false, scale);
  if (image instanceof HTMLImageElement) {
    image.style.width = image.style.width.replace('var(--px)', `var(${unit})`);
    image.style.height = image.style.height.replace('var(--px)', `var(${unit})`);
  }
  return image;
};

const offerName = (offer: Offer): string =>
  offer.kind === 'recipe' ? `${t('shop.recipe_prefix')}${t(`dish.${offer.target}.name` as TextKey)}` : itemName(offer.target);

const categoryOf = (offer: Offer): Category => CATEGORIES.find((entry) => entry.groups.includes(offer.group))?.id ?? 'treats';
const isRandom = (offer: Offer): boolean => offer.tab === 'random';

const petName = (pet: string): string => t(`pet.${pet}.name` as TextKey);

/** วัตถุดิบ: ใช้ทำอาหาร จำนวนต่อวัน ราคาสองเท่าก่อนมีสัตว์เลี้ยง · เหยื่อเรียกหีบบอกโอกาสได้หีบ */
function ingredientDescription(offer: Offer): string {
  const parts: string[] = [];
  const lure = Object.values(baits).find((bait) => bait.item === offer.target);
  if (lure?.chestChance !== undefined) parts.push(`${t('shop.desc_bait_chest')} ${Math.round(lure.chestChance * PERCENT)}%`);
  else if (offer.stock === null) parts.push(t('shop.desc_ingredient'));
  if (offer.stock !== null) parts.push(`${t(isRandom(offer) ? 'shop.desc_stock_today' : 'shop.desc_per_day')} ${offer.stock} ${t('shop.desc_piece')}`);
  // บรรทัดเดียวพอดีหน้าสินค้า เหตุผลว่ารอสัตว์ตัวไหนอยู่ในโน้ตจีโอ
  if (offer.pricierUntil) parts.push(t('shop.desc_pricier'));
  return parts.join(' · ');
}

/** บรรทัดใต้ชื่อในหน้าสินค้า ตัวเลขมาจากไฟล์ข้อมูลเสมอ */
function descriptionOf(offer: Offer): string {
  const sold = t(isRandom(offer) ? 'shop.sold_random' : 'shop.sold_daily');
  if (offer.group === 'ingredients') return ingredientDescription(offer);
  if (offer.group === 'toppings') {
    const type = Object.values(toppingTable).find((topping) => topping.item === offer.target)?.type ?? 'savory';
    return `${t(`shop.topping_for_${type}` as TextKey)} · ${t('shop.desc_stock_today')} ${offer.stock ?? 0} ${t('shop.desc_piece')}`;
  }
  if (offer.kind === 'table') return `${t('table.hint')} ${setTable.bigTable.slots.length} ${t('table.hint_end')}`;
  if (offer.group === 'treats') {
    const taste = tasteOfTreat(offer.target)!;
    const gain = taste === 'special' ? balance.gioCare.specialWeeklyGain : balance.gioCare.treatGains[0]!;
    return `${t('shop.desc_treat')} ${balance.gioCare.treatsPerDay} ${t('shop.desc_treat_unit')} · ${t('shop.happiness')} +${gain}`;
  }
  if (offer.kind === 'recipe') return `${t('shop.recipe_note')} · ${sold}`;
  if (offer.group === 'fertilizer') return `${t('shop.fertilizer_note_short')} · ${sold}`;
  const crop = crops[cropOfItem(offer.target)];
  return crop ? `${t('shop.seed_note')} · ${t('shop.desc_grow')} ${crop.growDays} ${t('shop.desc_days')} · ${sold}` : sold;
}

/**
 * โน้ตจีโอ · สูตรเป็นคำใบ้อ้อม ๆ ต่อสูตร (`shop.gnote_recipe.<id>`) ห้ามบอกวัตถุดิบหรือจำนวน
 * สูตรที่ยังไม่มีคำใบ้ใช้ประโยคกลาง (แก้จากการเล่นจริง 9 พ.ย. 2026 ข้อ A1: ผู้เล่นต้องค้นพบเอง)
 */
function gioNoteOf(offer: Offer): string {
  if (offer.kind === 'recipe') {
    const hint = th[`shop.gnote_recipe.${offer.target}` as TextKey] as string | undefined;
    return hint ?? t('shop.gnote_recipe_generic');
  }
  if (offer.group === 'treats') return t(`shop.gnote_${offer.target}` as TextKey);
  if (offer.group === 'fertilizer') return t(isRandom(offer) ? 'shop.gnote_fertilizer_random' : 'shop.gnote_fertilizer');
  if (offer.group === 'ingredients') {
    if (offer.pricierUntil) return `${t('shop.gnote_pricier_a')}${petName(offer.pricierUntil)}${t('shop.gnote_pricier_b')}`;
    if (offer.target.startsWith('bait_')) return t('shop.gnote_bait_chest');
    return t(isRandom(offer) ? 'shop.gnote_ingredient_random' : 'shop.gnote_seasoning');
  }
  if (offer.group === 'toppings') return t('shop.gnote_toppings');
  if (offer.kind === 'table') return t('shop.gnote_big_table');
  return t('shop.gnote_seeds');
}

/** "ชื่อเสียงร้าน ★2 · อีก 40 ถึง ★3" ดาวเต็มแล้วบอกว่าเต็มแล้ว */
function fameText(points: number): string {
  const { stars, toNext } = reputationStars(points);
  const head = `${t('shop.reputation')} ★${stars}`;
  return toNext === null ? `${head} · ${t('shop.reputation_max')}` : `${head} · ${t('shop.reputation_more')} ${formatMoney(toNext)} ${t('shop.reputation_to')} ★${stars + 1}`;
}

/**
 * เกร็ดจีโอบนหน้าที่มีของน้อย: สูตรบอกว่าสุ่มวันละกี่เมนู
 * เกร็ดปุ๋ยที่บอกโอกาสได้ดาวเป็นเปอร์เซ็นต์เอาออกแล้ว (ข้อ A4: ห้ามบอกโอกาสเป็นตัวเลข)
 */
function tipOf(category: Category): { title: string; lines: string[] } | null {
  if (category === 'recipes') {
    return {
      title: `${t('shop.tip_recipes')} ${(shopJson as ShopData).randomRecipes} ${t('shop.tip_recipes_unit')}`,
      lines: [t('shop.tip_recipes_1'), t('shop.tip_recipes_2')],
    };
  }
  return null;
}

/** ร้านค้าระบบ "จีโอมาร์ท" แบบ E: การ์ดซ้ายรายการหน้าละ 4 แถว เรียงถูกไปแพง · การ์ดขวาหน้าสินค้า */
export function createShopPage(): PhonePage {
  const left = element('div', 'pz ps shop-page');
  const top = element('div', 'ps-top');
  const logo = element('span', 'pw-logo', t('shop.logo_a'));
  logo.append(element('b', '', t('shop.logo_b')));
  const purse = element('b', 'ps-purse');
  purse.id = 'shop-coins';
  // หัวหน้าสูตรบอกชื่อเสียงร้านและคะแนนที่ยังขาดถึงดาวถัดไปเสมอ (ผู้ใช้อนุมัติ 9 พ.ย. 2026)
  const fame = element('span', 'ps-fame');
  fame.id = 'shop-reputation';
  top.append(logo, fame, purse);
  const chips = element('div', 'ps-chips');
  const list = element('div', 'ps-list');
  const pager = element('div', 'ps-pager');
  left.append(top, chips, list, pager);

  const right = element('div', 'pz ps-card');
  right.id = 'shop-card';

  let category: Category = 'treats';
  let page = 0;
  let picked: string | null = null;
  let quantity = 1;

  const renderCard = (offer: Offer | undefined, closed: boolean): void => {
    if (!offer) {
      right.replaceChildren(element('p', 'ps-hint', t(closed ? 'shop.closed_tab' : 'shop.pick')));
      return;
    }
    const world = gameState.world;
    const most = maxQuantity(world, offer);
    quantity = Math.min(Math.max(1, quantity), Math.max(1, most));
    const hero = element('div', 'ps-hero');
    hero.style.background = ROW_TILES[categoryOf(offer)];
    hero.append(offerImage(offer, 2, '--px'));
    const tag = element(
      'span',
      'ps-hot',
      offer.group === 'treats' ? t(TASTE_TAG[tasteOfTreat(offer.target)!]) : t('shop.hot'),
    );
    const name = element('div', 'ps-name', offerName(offer));
    const price = element('div', 'ps-price');
    setMoney(price, offer.price);
    const review = element('div', 'ps-rev');
    // คนรีวิวที่เป็นมอนสเตอร์ยังไม่เคยเจอ ไม่บอกชื่อ (ข้อ A10) รีวิวของจีโอบอกชื่อเสมอ
    const reviewer = REVIEWER[categoryOf(offer)];
    const byline = reviewer && !hasMet(world, reviewer) ? t('shop.review_by_stranger') : t(`shop.review_by_${categoryOf(offer)}` as TextKey);
    const head = element('div', 'h', `${byline} `);
    head.append(element('b', '', '★'.repeat(REVIEW_STARS[categoryOf(offer)]) + '☆'.repeat(5 - REVIEW_STARS[categoryOf(offer)])));
    review.append(head, element('p', '', `“${t(`shop.review_${categoryOf(offer)}` as TextKey)}”`));
    const note = element('div', 'ps-gnote', `${t('shop.gnote')} “${gioNoteOf(offer)}”`);

    const buttons = element('div', 'ps-btns');
    const stepper = element('div', 'ps-stepper');
    const step = (text: string, label: TextKey, id: string, delta: number, disabled: boolean): HTMLButtonElement => {
      const button = element('button', 'ps-step', text);
      button.type = 'button';
      button.id = id;
      button.disabled = disabled;
      button.setAttribute('aria-label', t(label));
      button.addEventListener('click', () => {
        quantity = Math.min(Math.max(1, quantity + delta), Math.max(1, most));
        render();
      });
      return button;
    };
    const count = element('b', 'ps-qty', String(quantity));
    count.id = 'shop-qty';
    const single = offer.kind !== 'item';
    stepper.append(step('−', 'shop.less', 'shop-less', -1, single || quantity <= 1), count, step('+', 'shop.more', 'shop-more', 1, single || quantity >= most));
    const buy = element('button', 'ps-buy');
    buy.type = 'button';
    buy.id = 'shop-buy';
    const owned = alreadyOwned(world, offer);
    buy.disabled = most < 1;
    if (owned) buy.textContent = t(offer.kind === 'recipe' ? 'shop.known' : 'shop.owned');
    else if (stockLeft(world, offer) < 1) buy.textContent = t('shop.sold_out');
    else if (most < 1) buy.textContent = t('shop.no_money');
    else setMoney(buy, offer.price * quantity, `${t('shop.buy_now')} `);
    buy.addEventListener('click', () => {
      const next = buyOffer(gameState.world, offer, quantity);
      if (!next) {
        eventBus.emit('player-says', 'bagFull');
        return;
      }
      gameState.setWorld(next);
      quantity = 1;
    });
    buttons.append(stepper, buy);
    right.replaceChildren(hero, tag, name, price, element('div', 'ps-desc', descriptionOf(offer)), review, note, buttons);
  };

  const row = (offer: Offer): HTMLElement => {
    const world = gameState.world;
    const left = stockLeft(world, offer);
    const gone = left < 1 || alreadyOwned(world, offer);
    const button = element('button', `ps-row${offer.id === picked ? ' is-selected' : ''}${gone ? ' is-soldout' : ''}`);
    button.type = 'button';
    button.dataset.offer = offer.id;
    button.setAttribute('aria-label', offerName(offer));
    const tile = element('span', 'ps-rimg');
    tile.style.background = ROW_TILES[categoryOf(offer)];
    tile.append(offerImage(offer, 1, '--px2'));
    const name = element('span', 'ps-rn', offerName(offer));
    if (isRandom(offer)) name.append(element('span', 'ps-today', t('shop.today_tag')));
    // ของจำนวนจำกัดบอกว่าวันนี้เหลือกี่ชิ้น โต๊ะที่มีแล้วบอกว่ามีแล้ว
    if (offer.stock !== null) name.append(element('span', `ps-left${left < 1 ? ' is-out' : ''}`, left < 1 ? t('shop.sold_out_short') : `${t('shop.left')} ${left}`));
    if (offer.kind === 'table' && gone) name.append(element('span', 'ps-left is-out', t('shop.owned')));
    const price = element('span', 'ps-rprice', formatMoney(offer.price));
    price.append(coinIcon('coin-icon--small'));
    button.append(tile, name, price);
    button.addEventListener('click', () => {
      if (picked !== offer.id) quantity = 1;
      picked = offer.id;
      render();
    });
    return button;
  };

  function render(): void {
    if (!gameState.started) return;
    const world = gameState.world;
    setMoney(purse, world.wallet.coins);
    fame.hidden = category !== 'recipes';
    fame.textContent = fameText(world.sets.reputation);
    // หมวดที่วันนี้ไม่มีของขายเลยไม่แสดงปุ่ม (ข้อ B6) ถ้าหมวดที่เลือกอยู่ว่าง ไปหมวดแรกที่มีของ
    const forSale = offersFor(world).filter((offer) => !(offer.kind === 'recipe' && world.recipes.known.includes(offer.target)));
    const stocked = CATEGORIES.filter((entry) => forSale.some((offer) => entry.groups.includes(offer.group)));
    if (stocked.length > 0 && !stocked.some((entry) => entry.id === category)) {
      category = stocked[0]!.id;
      page = 0;
      picked = null;
    }
    chips.replaceChildren(
      ...stocked.map((entry) => {
        const chip = element('button', `ps-chip${entry.id === category ? ' is-active' : ''}`);
        chip.type = 'button';
        chip.dataset.shopTab = entry.id;
        const icon = element('span', 'ps-cic');
        icon.style.background = entry.tile;
        icon.append(sizedArt(entry.icon, '', '--px2'));
        chip.append(icon, element('span', '', t(entry.label)));
        chip.addEventListener('click', () => {
          if (category !== entry.id) {
            category = entry.id;
            page = 0;
            picked = null;
          }
          render();
        });
        return chip;
      }),
    );
    const groups = CATEGORIES.find((entry) => entry.id === category)!.groups;
    // ของขายทุกวันอยู่บน ของ "วันนี้" อยู่ล่าง ในแต่ละกลุ่มเรียงถูกไปแพง (ผู้ใช้เลือก 9 พ.ย. 2026) ราคาเท่ากันเรียงตามลำดับเดิม
    const shown = offersFor(world)
      .filter((offer) => groups.includes(offer.group) && !(offer.kind === 'recipe' && world.recipes.known.includes(offer.target)))
      .map((offer, index) => ({ offer, index }))
      .sort((a, b) => Number(isRandom(a.offer)) - Number(isRandom(b.offer)) || a.offer.price - b.offer.price || a.index - b.index)
      .map(({ offer }) => offer);
    const pages = Math.max(1, Math.ceil(shown.length / ROWS_PER_PAGE));
    page = Math.min(page, pages - 1);
    if (!picked || !shown.some((offer) => offer.id === picked)) picked = shown[page * ROWS_PER_PAGE]?.id ?? null;
    const onPage = shown.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
    list.replaceChildren(...onPage.map(row));
    if (shown.length === 0) list.append(element('p', 'ps-closed', t('shop.closed_tab')));
    const tip = shown.length > 0 && shown.length < TIP_UNDER ? tipOf(category) : null;
    if (tip) {
      const card = element('div', 'ps-tip');
      card.append(element('i', 'ps-tip__tape'), element('b', '', `${t('shop.tip')}: ${tip.title}`));
      for (const line of tip.lines) card.append(element('p', '', line));
      list.append(card);
    }
    const arrow = (text: string, id: string, label: TextKey, delta: number): HTMLButtonElement => {
      const button = element('button', 'ps-arrow', text);
      button.type = 'button';
      button.id = id;
      button.setAttribute('aria-label', t(label));
      button.disabled = page + delta < 0 || page + delta >= pages;
      button.addEventListener('click', () => {
        page = Math.min(pages - 1, Math.max(0, page + delta));
        picked = shown[page * ROWS_PER_PAGE]?.id ?? null;
        quantity = 1;
        render();
      });
      return button;
    };
    const dots = element('span', 'ps-dots');
    for (let index = 0; index < pages; index += 1) dots.append(element('span', index === page ? 'on' : ''));
    pager.replaceChildren(arrow('‹', 'shop-prev', 'book.prev', -1), dots, element('span', '', `${t('shop.page')} ${page + 1}/${pages}`), arrow('›', 'shop-next', 'book.next', 1));
    renderCard(
      shown.find((offer) => offer.id === picked),
      shown.length === 0,
    );
  }

  render();
  // ร้านวาดใหม่เฉพาะตอนเปิดอยู่ ไม่วาดทุกเฟรมตอนเดินเล่น
  eventBus.on('world-changed', () => {
    if (left.isConnected) render();
  });
  return { left, right, shown: render };
}
