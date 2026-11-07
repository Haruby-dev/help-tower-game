import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type Currency, type WalletEntry } from '../core/state';
import { entriesFor, formatMoney, netFor, type WalletRange } from '../systems/economy';
import { formatClock } from './hud';
import { coinIcon } from './money';
import type { PhonePage } from './phone';
import { sizedArt } from './pixelArt';

const RANGES: { id: WalletRange; label: TextKey }[] = [
  { id: 'today', label: 'wallet.today' },
  { id: 'week', label: 'wallet.week' },
  { id: 'all', label: 'wallet.all' },
];
const DAYS_SHOWN = 7;
/** ความสูงกราฟเป็นหน่วยของการ์ด (ภาพตัวอย่าง wallet_e) แท่งลบยาวเกินนี้ตัดเป็นลายทาง */
const BAR_UP_MAX = 96;
const BAR_DOWN_MAX = 44;

/** ไอคอนในช่องรายการตามหมวด · ดาวน้ำตาลใช้ภาพดาวเสมอ */
const CATEGORY_ICON: Record<string, { art: string; tile: string; unit: string }> = {
  'wallet.category_sale': { art: 'ui_cat_peek', tile: '#fff1d6', unit: '--px2' },
  'wallet.category_gift': { art: 'ui_cat_peek', tile: '#fff1d6', unit: '--px2' },
  'wallet.category_shop': { art: 'ui_app_shop', tile: '#ffe3ee', unit: '--px2' },
  'wallet.category_land': { art: 'shop_item_farm_expand', tile: '#e2f5ea', unit: '--px2' },
  'wallet.category_chest': { art: 'chest_silver', tile: '#dcecff', unit: '--px2' },
  'wallet.category_monster': { art: 'ui_sugar_star', tile: '#efe6ff', unit: '--px2' },
};
const COIN_TILE = { art: 'ui_coin_paw', tile: '#fff1d6', unit: '--px4' };
const STAR_TILE = { art: 'ui_sugar_star', tile: '#efe6ff', unit: '--px2' };

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const signed = (amount: number): string => `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${formatMoney(Math.abs(amount))}`;

/** เหรียญเล็ก (2 จุดต่อพิกเซล) หรือดาวน้ำตาล 2 เท่าข้างตัวเลข */
export function currencyIcon(currency: Currency): HTMLElement {
  if (currency === 'stars') return sizedArt('ui_sugar_star', 'wallet-star', '--px2');
  return coinIcon('coin-icon--small');
}

function balanceCard(currency: Currency, label: TextKey): { card: HTMLElement; value: HTMLElement } {
  const card = element('div', `pwl-bc pwl-bc--${currency}`);
  const tile = element('div', 'pwl-bi');
  tile.style.background = currency === 'coins' ? '#fff1d6' : '#efe6ff';
  tile.append(currency === 'coins' ? sizedArt('ui_coin_paw', '', '--px4') : sizedArt('ui_sugar_star', '', '--px2'));
  const text = element('div', '');
  const value = element('b', '');
  value.dataset.balance = currency;
  text.append(element('small', '', t(label)), value);
  card.append(tile, text);
  return { card, value };
}

function entryRow(entry: WalletEntry): HTMLElement {
  const row = element('div', `pwl-lr wallet-entry ${entry.amount >= 0 ? 'wallet-entry--in' : 'wallet-entry--out'}`);
  const icon = entry.currency === 'stars' ? STAR_TILE : (CATEGORY_ICON[entry.category] ?? COIN_TILE);
  const tile = element('div', 'pwl-li');
  tile.style.background = icon.tile;
  tile.append(sizedArt(icon.art, '', icon.unit));
  const text = element('div', 'pwl-lt');
  text.append(
    element('b', '', t(entry.label as TextKey)),
    element('small', '', `${t(entry.category as TextKey)} · ${t('wallet.day')} ${entry.day} ${formatClock(entry.hour)}`),
  );
  const amount = element('div', `pwl-la ${entry.amount >= 0 ? 'in' : 'out'}`, signed(entry.amount));
  amount.append(currencyIcon(entry.currency));
  row.append(tile, text, amount);
  return row;
}

/** แอปกระเป๋าเงิน (wallet_e): การ์ดซ้ายยอดเงิน ดาวน้ำตาล ยอดสุทธิ และกราฟ 7 วัน · การ์ดขวารายการรับจ่าย */
export function createWalletPage(): PhonePage {
  const left = element('div', 'pz pwl');
  const logo = element('div', 'pwl-top');
  const name = element('span', 'pw-logo', t('wallet.logo_a'));
  name.append(element('b', '', t('wallet.logo_b')));
  logo.append(name);
  const coins = balanceCard('coins', 'wallet.coins');
  const stars = balanceCard('stars', 'wallet.stars');
  const cards = element('div', 'pwl-bal');
  cards.append(coins.card, stars.card);
  const tabs = element('div', 'pwl-rng');
  const net = element('div', 'pwl-net');
  const netValue = element('b', '');
  netValue.id = 'wallet-net';
  const chart = element('div', 'pwl-chart');
  left.append(logo, cards, tabs, net, chart);

  const right = element('div', 'pz pwl-log-card');
  const heading = element('div', 'pwl-lh');
  const list = element('div', 'pwl-log');
  list.id = 'wallet-log';
  const more = element('div', 'pwl-more', t('wallet.more'));
  right.append(heading, list, more);

  let range: WalletRange = 'today';
  const rangeName = (): string => t(RANGES.find((entry) => entry.id === range)!.label);

  const renderChart = (): void => {
    const { wallet, day } = gameState.world;
    const days = Array.from({ length: DAYS_SHOWN }, (_, index) => day - DAYS_SHOWN + 1 + index).filter((value) => value >= 1);
    const values = days.map((value) => wallet.daily.find((total) => total.day === value)?.coins ?? 0);
    const unit = BAR_UP_MAX / Math.max(1, ...values.map((value) => Math.abs(value)).filter((_, index) => values[index]! > 0), 1);
    const deepest = Math.min(0, ...values);
    chart.replaceChildren(
      element('i', 'pwl-base'),
      ...days.map((value, index) => {
        const amount = values[index]!;
        const today = value === day;
        const column = element('div', 'pwl-col');
        const up = element('div', 'pwl-up');
        const down = element('div', 'pwl-dn');
        if (amount > 0) {
          if (today) up.append(element('em', 'vt', signed(amount)));
          const bar = element('i', `bar${today ? ' today' : ''}`);
          bar.style.height = `${Math.max(2, Math.round(amount * unit))}px`;
          up.append(bar);
        } else if (amount < 0) {
          const height = Math.round(-amount * unit);
          const capped = height > BAR_DOWN_MAX;
          const bar = element('i', `bar neg${capped ? ' cap' : ''}${today ? ' today' : ''}`);
          bar.style.height = `${Math.max(2, Math.min(BAR_DOWN_MAX, height))}px`;
          down.append(bar);
          if (capped || today || amount === deepest) down.append(element('em', 'vb', signed(amount)));
        }
        column.append(up, down, element('span', '', today ? t('wallet.today') : `${t('wallet.day')} ${value}`));
        return column;
      }),
    );
  };

  const render = (): void => {
    if (!gameState.started) return;
    const { wallet, day } = gameState.world;
    coins.value.textContent = formatMoney(wallet.coins);
    stars.value.textContent = formatMoney(wallet.stars);
    const total = netFor(wallet, day, range, 'coins');
    netValue.textContent = signed(total);
    netValue.classList.toggle('is-minus', total < 0);
    net.replaceChildren(`${t('wallet.net')}${rangeName()} `, netValue, currencyIcon('coins'));
    heading.textContent = `${t('wallet.log_title')} · ${rangeName()}`;
    const entries = entriesFor(wallet, day, range);
    if (entries.length === 0) list.replaceChildren(element('p', 'pwl-empty', t('wallet.empty')));
    else list.replaceChildren(...entries.map(entryRow));
    more.hidden = list.scrollHeight <= list.clientHeight + 1;
    renderChart();
  };

  const tabButtons = RANGES.map(({ id, label }) => {
    const button = element('button', 'pwl-tab wallet-tab', t(label));
    button.type = 'button';
    button.dataset.range = id;
    button.addEventListener('click', () => {
      range = id;
      for (const other of tabButtons) other.classList.toggle('is-active', other === button);
      render();
    });
    return button;
  });
  tabButtons[0]!.classList.add('is-active');
  tabs.append(...tabButtons);
  list.addEventListener('scroll', () => {
    more.hidden = list.scrollTop + list.clientHeight >= list.scrollHeight - 2;
  });

  render();
  eventBus.on('world-changed', () => {
    if (left.isConnected) render();
  });
  return { left, right, shown: render };
}
