import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState } from '../core/state';
import balance from '../data/balance.json';
import { registry } from '../core/assets';
import { recipes } from '../systems/cooking';
import { buyOffer, maxQuantity, offersFor, tasteOfTreat, type Offer, type ShopGroup } from '../systems/shop';
import { itemImage, itemName } from './inventory';
import { setMoney } from './money';
import { artUrl } from './pixelArt';

type Tab = 'daily' | 'random' | 'equipment' | 'farm';
const TABS: { id: Tab; label: TextKey }[] = [
  { id: 'daily', label: 'shop.tab_daily' },
  { id: 'random', label: 'shop.tab_random' },
  { id: 'equipment', label: 'shop.tab_equipment' },
  { id: 'farm', label: 'shop.tab_farm' },
];
const GROUP_LABEL: Record<ShopGroup, TextKey> = {
  treats: 'shop.group_treats',
  seeds: 'shop.group_seeds',
  random_seeds: 'shop.group_random_seeds',
  recipes: 'shop.group_recipes',
};
const TASTE_LABEL = { like: 'shop.taste_like', love: 'shop.taste_love', special: 'shop.taste_special' } as const;

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** ม้วนสูตร: อาหารคาวใช้ม้วนคาว ของหวานกับเครื่องดื่มใช้ม้วนหวาน */
const scrollFor = (recipe: string): string =>
  recipes[recipe]?.category === 'savory' ? 'shop_item_recipe_scroll_savory' : 'shop_item_recipe_scroll_sweet';

function artImage(id: string, scale: number): HTMLElement {
  const entry = registry[id];
  if (entry?.type !== 'local') throw new Error(`${id} is not local art`);
  const image = element('img', 'pixel-img');
  image.src = artUrl(id);
  image.alt = '';
  image.style.width = `calc(var(--px) * ${entry.width * scale})`;
  image.style.height = `calc(var(--px) * ${entry.height * scale})`;
  return image;
}

/** ภาพของบนชั้น สูตรเป็นม้วนกระดาษตามหมวด ของที่ยังไม่มีภาพใช้กล่องสี */
const offerImage = (offer: Offer, scale = 1): HTMLElement =>
  offer.kind === 'recipe' ? artImage(scrollFor(offer.target), scale) : itemImage(offer.target, false, scale);

const offerName = (offer: Offer): string => (offer.kind === 'recipe' ? t(`dish.${offer.target}.name` as TextKey) : itemName(offer.target));

/** ข้อความใต้ชื่อในการ์ดขวา แมวเลียบอกว่าจีโอชอบแค่ไหนและความสุขที่ได้จากซองแรกของวัน */
function offerNotes(offer: Offer): string[] {
  if (offer.group === 'treats') {
    const taste = tasteOfTreat(offer.target)!;
    const gain = taste === 'special' ? balance.gioCare.specialWeeklyGain : balance.gioCare.treatGains[0]!;
    return [t(TASTE_LABEL[taste]), `${t('shop.happiness')} +${gain}`];
  }
  return [t(offer.kind === 'recipe' ? 'shop.recipe_note' : 'shop.seed_note')];
}

/** ร้านค้าระบบเต็มจอโทรศัพท์ จีโอถูมือหลังเคาน์เตอร์ ป้ายแท็บไม้ 4 อัน ชั้นวางของ และการ์ดของที่เลือก */
export function createShopPage(): HTMLElement {
  const page = element('div', 'shop-page');
  const awning = element('div', 'shop-awning');
  const sign = element('h2', 'shop-sign', t('shop.title'));
  const purse = element('b', 'shop-purse');
  purse.id = 'shop-coins';
  awning.append(sign, purse);

  const side = element('div', 'shop-side');
  const bubble = element('p', 'shop-bubble', t('shop.greet'));
  const gio = element('img', 'pixel-img shop-gio');
  gio.src = artUrl('ui_shop_gio');
  gio.alt = '';
  const counter = element('i', 'shop-counter');
  const tabs = element('div', 'shop-tabs');
  side.append(bubble, gio, counter, tabs);

  const shelves = element('div', 'shop-shelves');
  const card = element('div', 'shop-card');
  card.id = 'shop-card';
  const body = element('div', 'shop-body');
  body.append(side, shelves, card);
  page.append(awning, body);

  let tab: Tab = 'daily';
  let picked: string | null = null;
  let quantity = 1;

  const renderCard = (offers: Offer[]): void => {
    const offer = offers.find((entry) => entry.id === picked);
    if (!offer) {
      card.replaceChildren(element('small', 'shop-card__hint', t('shop.pick')));
      return;
    }
    const world = gameState.world;
    const most = maxQuantity(world, offer);
    quantity = Math.min(Math.max(1, quantity), Math.max(1, most));
    const picture = element('div', 'shop-card__picture');
    picture.append(offerImage(offer, 2));
    const notes = offerNotes(offer).map((note) => element('small', 'shop-card__note', note));
    const stepper = element('div', 'shop-card__stepper');
    const step = (text: string, label: TextKey, id: string, delta: number, disabled: boolean): HTMLButtonElement => {
      const button = element('button', 'phone-tool shop-step', text);
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
    const count = element('b', 'shop-card__count', String(quantity));
    count.id = 'shop-qty';
    const single = offer.kind === 'recipe';
    stepper.append(step('−', 'shop.less', 'shop-less', -1, single || quantity <= 1), count, step('+', 'shop.more', 'shop-more', 1, single || quantity >= most));
    const buy = element('button', 'phone-tool shop-buy');
    buy.type = 'button';
    buy.id = 'shop-buy';
    const known = offer.kind === 'recipe' && world.recipes.known.includes(offer.target);
    buy.disabled = most < 1;
    if (known) buy.textContent = t('shop.known');
    else if (most < 1) buy.textContent = t('shop.no_money');
    else setMoney(buy, offer.price * quantity, `${t('shop.buy')} `);
    buy.addEventListener('click', () => {
      const next = buyOffer(gameState.world, offer, quantity);
      if (!next) {
        eventBus.emit('player-says', 'bagFull');
        return;
      }
      gameState.setWorld(next);
      quantity = 1;
    });
    card.replaceChildren(picture, element('b', 'shop-card__name', offerName(offer)), ...notes, stepper, buy);
  };

  const shelfItem = (offer: Offer): HTMLElement => {
    const button = element('button', `shop-item${offer.id === picked ? ' is-selected' : ''}`);
    button.type = 'button';
    button.dataset.offer = offer.id;
    button.setAttribute('aria-label', offerName(offer));
    const holder = element('span', 'shop-item__art');
    holder.append(offerImage(offer));
    if (offer.target === 'treat_special') holder.append(element('small', 'shop-item__badge', t('shop.special_badge')));
    const price = element('b', 'shop-item__price');
    setMoney(price, offer.price);
    button.append(holder, price);
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
    tabs.replaceChildren(
      ...TABS.map(({ id, label }) => {
        const button = element('button', `shop-tab${id === tab ? ' is-active' : ''}`, t(label));
        button.type = 'button';
        button.dataset.shopTab = id;
        button.addEventListener('click', () => {
          tab = id;
          picked = null;
          render();
        });
        return button;
      }),
    );
    const offers = offersFor(world).filter((offer) => !(offer.kind === 'recipe' && world.recipes.known.includes(offer.target)));
    if (tab === 'equipment' || tab === 'farm') {
      shelves.replaceChildren(element('p', 'shop-closed', t('shop.closed_tab')));
      card.replaceChildren();
      return;
    }
    const shown = offers.filter((offer) => offer.tab === tab);
    if (!picked || !shown.some((offer) => offer.id === picked)) picked = shown[0]?.id ?? null;
    const groups = [...new Set(shown.map((offer) => offer.group))];
    shelves.replaceChildren(
      ...groups.map((group) => {
        const shelf = element('section', 'shop-shelf');
        const row = element('div', 'shop-shelf__row');
        row.append(...shown.filter((offer) => offer.group === group).map(shelfItem));
        shelf.append(element('h3', 'shop-shelf__label', t(GROUP_LABEL[group])), row, element('i', 'shop-shelf__board'));
        return shelf;
      }),
    );
    renderCard(shown);
  }

  render();
  // ร้านวาดใหม่เฉพาะตอนเปิดอยู่ ไม่วาดทุกเฟรมตอนเดินเล่น
  eventBus.on('world-changed', () => {
    if (page.isConnected) render();
  });
  page.addEventListener('phone-page-shown', render);
  return page;
}
