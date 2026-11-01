import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type Currency, type WalletEntry } from '../core/state';
import { entriesFor, netFor, type WalletRange } from '../systems/economy';

const RANGES: { id: WalletRange; label: TextKey }[] = [
  { id: 'today', label: 'wallet.today' },
  { id: 'week', label: 'wallet.week' },
  { id: 'all', label: 'wallet.all' },
];
const signed = (amount: number): string => `${amount > 0 ? '+' : ''}${amount.toLocaleString('en-US')}`;

function balanceCard(currency: Currency, label: TextKey): { card: HTMLElement; value: HTMLElement } {
  const card = document.createElement('div');
  card.className = `wallet-card wallet-card--${currency}`;
  const name = document.createElement('span');
  name.textContent = t(label);
  const value = document.createElement('b');
  value.dataset.balance = currency;
  card.append(name, value);
  return { card, value };
}

function entryRow(entry: WalletEntry): HTMLElement {
  const row = document.createElement('div');
  row.className = `wallet-entry ${entry.amount >= 0 ? 'wallet-entry--in' : 'wallet-entry--out'}`;
  const text = document.createElement('span');
  const label = document.createElement('b');
  label.textContent = t(entry.label as TextKey);
  const category = document.createElement('small');
  category.textContent = t(entry.category as TextKey);
  text.append(label, category);
  const amount = document.createElement('b');
  amount.className = 'wallet-entry__amount';
  amount.textContent = `${signed(entry.amount)} ${t(entry.currency === 'coins' ? 'wallet.coins' : 'wallet.stars')}`;
  row.append(text, amount);
  return row;
}

export function createWalletPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'phone-page';
  const title = document.createElement('h2');
  title.textContent = t('app.wallet');

  const coins = balanceCard('coins', 'wallet.coins');
  const stars = balanceCard('stars', 'wallet.stars');
  const cards = document.createElement('div');
  cards.className = 'wallet-cards';
  cards.append(coins.card, stars.card);

  const tabs = document.createElement('div');
  tabs.className = 'wallet-tabs';
  const net = document.createElement('b');
  net.id = 'wallet-net';
  const list = document.createElement('div');
  list.id = 'wallet-log';

  let range: WalletRange = 'today';
  const render = (): void => {
    if (!gameState.started) return;
    const { wallet, day } = gameState.world;
    coins.value.textContent = wallet.coins.toLocaleString('en-US');
    stars.value.textContent = wallet.stars.toLocaleString('en-US');
    net.textContent = signed(netFor(wallet, day, range, 'coins'));
    const entries = entriesFor(wallet, day, range);
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'phone-page__empty';
      empty.textContent = t('wallet.empty');
      list.replaceChildren(empty);
    } else {
      list.replaceChildren(...entries.map(entryRow));
    }
  };

  const tabButtons = RANGES.map(({ id, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wallet-tab';
    button.dataset.range = id;
    button.textContent = t(label);
    button.addEventListener('click', () => {
      range = id;
      for (const other of tabButtons) other.classList.toggle('wallet-tab--active', other === button);
      render();
    });
    return button;
  });
  tabButtons[0]!.classList.add('wallet-tab--active');
  tabs.append(...tabButtons, net);

  page.append(title, cards, tabs, list);
  render();
  eventBus.on('world-changed', render);
  return page;
}
