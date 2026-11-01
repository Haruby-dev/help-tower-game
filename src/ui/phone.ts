import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState } from '../core/state';
import { formatClock } from './hud';
import { createSettingsPage } from './settings';
import { createWalletPage } from './wallet';

const APPS: { id: string; name: TextKey; page?: () => HTMLElement }[] = [
  { id: 'inventory', name: 'app.inventory' },
  { id: 'wallet', name: 'app.wallet', page: createWalletPage },
  { id: 'shop', name: 'app.shop' },
  { id: 'recipes', name: 'app.recipes' },
  { id: 'album', name: 'app.album' },
  { id: 'pets', name: 'app.pets' },
  { id: 'gate', name: 'app.gate' },
  { id: 'mail', name: 'app.mail' },
  { id: 'outfit', name: 'app.outfit' },
  { id: 'settings', name: 'app.settings', page: createSettingsPage },
  { id: 'support', name: 'app.support' },
];
const FIRST_APP = 'wallet';
const PHONE_WINDOW = 'phone';

function placeholderPage(app: (typeof APPS)[number]): HTMLElement {
  const page = document.createElement('div');
  page.className = 'phone-page';
  const title = document.createElement('h2');
  title.textContent = t(app.name);
  const message = document.createElement('p');
  message.className = 'phone-page__empty';
  message.textContent = t(app.id === 'support' ? 'app.support_note' : 'app.not_open');
  page.append(title, message);
  return page;
}

export function createPhone(uiRoot: HTMLElement): void {
  const closed = document.createElement('button');
  closed.id = 'phone-button';
  closed.type = 'button';
  closed.setAttribute('aria-label', t('phone.open'));
  const cameras = document.createElement('span');
  cameras.className = 'phone-button__cameras';
  cameras.innerHTML = '<i></i><i></i>';
  const cover = document.createElement('span');
  cover.className = 'phone-button__cover';
  const coverTime = document.createElement('b');
  coverTime.id = 'phone-cover-time';
  const coverDay = document.createElement('small');
  coverDay.id = 'phone-cover-day';
  cover.append(coverTime, coverDay);
  closed.append(cameras, cover);

  const backdrop = document.createElement('div');
  backdrop.id = 'phone-backdrop';
  backdrop.hidden = true;
  const phone = document.createElement('div');
  phone.id = 'phone';
  phone.setAttribute('role', 'dialog');
  phone.setAttribute('aria-label', t('phone.open'));

  const left = document.createElement('div');
  left.className = 'phone-side phone-side--left';
  const leftBar = document.createElement('div');
  leftBar.className = 'phone-bar';
  const time = document.createElement('span');
  time.id = 'phone-time';
  const closeButton = document.createElement('button');
  closeButton.id = 'phone-close';
  closeButton.type = 'button';
  closeButton.textContent = t('ui.close');
  leftBar.append(time, closeButton);
  const grid = document.createElement('div');
  grid.className = 'phone-apps';
  left.append(leftBar, grid);

  const right = document.createElement('div');
  right.className = 'phone-side phone-side--right';
  const rightBar = document.createElement('div');
  rightBar.className = 'phone-bar phone-bar--end';
  const status = document.createElement('span');
  status.id = 'phone-status';
  rightBar.append(status);
  const content = document.createElement('div');
  content.className = 'phone-content';
  right.append(rightBar, content);

  phone.append(left, right);
  backdrop.append(phone);
  uiRoot.append(closed, backdrop);

  const pages = new Map<string, HTMLElement>();
  const buttons = APPS.map((app) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `phone-app phone-app--${app.id}`;
    button.dataset.app = app.id;
    const icon = document.createElement('span');
    icon.className = 'phone-app__icon';
    const name = document.createElement('span');
    name.className = 'phone-app__name';
    name.textContent = t(app.name);
    button.append(icon, name);
    button.addEventListener('click', () => select(app.id));
    grid.append(button);
    return button;
  });

  function select(id: string): void {
    const app = APPS.find((candidate) => candidate.id === id);
    if (!app) return;
    let page = pages.get(id);
    if (!page) {
      page = app.page ? app.page() : placeholderPage(app);
      pages.set(id, page);
    }
    content.replaceChildren(page);
    for (const button of buttons) button.classList.toggle('phone-app--active', button.dataset.app === id);
  }

  const setOpen = (open: boolean): void => {
    if (open === !backdrop.hidden) return;
    backdrop.hidden = !open;
    gameState.setWindowOpen(PHONE_WINDOW, open);
    closed.classList.toggle('phone-button--open', open);
    if (open) select(FIRST_APP);
  };
  closed.addEventListener('click', () => setOpen(true));
  closeButton.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
    if (event.key === 'Tab') {
      event.preventDefault();
      setOpen(backdrop.hidden !== false);
    }
  });

  eventBus.on('world-changed', (world) => {
    const clock = formatClock(world.hour);
    coverTime.textContent = clock;
    coverDay.textContent = `${t('hud.day')} ${world.day}`;
    time.textContent = clock;
    status.textContent = `${t('hud.day')} ${world.day} · ${t('weather.sunny')}`;
  });
}
