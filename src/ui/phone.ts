import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type World } from '../core/state';
import balance from '../data/balance.json';
import { dayOfMonth, encouragementFor, monthOf, stuckTime, weekStrip, weekdayIndex, weekdayName, weekdayShort } from '../systems/phoneCalendar';
import { formatClock } from './hud';
import { artUrl, stickerIcon } from './pixelArt';
import { createSettingsPage } from './settings';
import { createWalletPage } from './wallet';

interface PhoneApp {
  id: string;
  name: TextKey;
  icon: string;
  place: 'grid' | 'dock';
  /** แอปใหญ่กางจอให้เอง */
  big?: boolean;
  page?: () => HTMLElement;
}

const APPS: PhoneApp[] = [
  { id: 'inventory', name: 'app.inventory', icon: 'ui_app_bag', place: 'grid' },
  { id: 'shop', name: 'app.shop', icon: 'ui_app_shop', place: 'grid' },
  { id: 'recipes', name: 'app.recipes', icon: 'ui_app_recipe', place: 'grid', big: true },
  { id: 'album', name: 'app.album', icon: 'ui_app_album', place: 'grid' },
  { id: 'pets', name: 'app.pets', icon: 'ui_app_pets', place: 'grid' },
  { id: 'gate', name: 'app.gate', icon: 'ui_app_gate', place: 'grid' },
  { id: 'outfit', name: 'app.outfit', icon: 'ui_app_outfit', place: 'grid' },
  { id: 'support', name: 'app.support', icon: 'ui_app_support', place: 'grid' },
  { id: 'wallet', name: 'app.wallet', icon: 'ui_app_wallet', place: 'dock', big: true, page: createWalletPage },
  { id: 'mail', name: 'app.mail', icon: 'ui_app_mail', place: 'dock' },
  { id: 'settings', name: 'app.settings', icon: 'ui_app_settings', place: 'dock', big: true, page: createSettingsPage },
];

const PHONE_WINDOW = 'phone';
const FLIP_MS = 160;
const SWIPE_UP_PX = 30;
const WEATHER_ICON = 'ui_weather_sun';
const LOCK_CATS = ['ui_cat_orange', 'ui_cat_calico', 'ui_cat_gio', 'ui_cat_grey'];
const MINI_CATS = ['ui_cat_orange', 'ui_cat_gio'];

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const art = (id: string, className: string): HTMLImageElement => {
  const image = element('img', `pixel-img ${className}`);
  image.src = artUrl(id);
  image.alt = '';
  return image;
};

function placeholderPage(app: PhoneApp): HTMLElement {
  const page = element('div', 'phone-page');
  page.append(element('h2', undefined, t(app.name)));
  page.append(element('p', 'phone-page__empty', t(app.id === 'support' ? 'app.support_note' : 'app.not_open')));
  return page;
}

function createMini(): { root: HTMLButtonElement; time: HTMLElement; date: HTMLElement } {
  const root = element('button');
  root.id = 'phone-button';
  root.type = 'button';
  root.setAttribute('aria-label', t('phone.open'));
  const screen = element('span', 'mini__screen');
  const date = element('small', 'mini__date');
  date.id = 'phone-cover-day';
  const time = element('b', 'mini__time');
  time.id = 'phone-cover-time';
  const cats = element('span', 'mini__cats');
  cats.append(...MINI_CATS.map((id) => art(id, 'mini__cat')));
  screen.append(art(WEATHER_ICON, 'mini__weather'), date, element('i', 'punch-hole'), time, cats);
  root.append(screen);
  return { root, time, date };
}

function createLock(): { root: HTMLElement; time: HTMLElement; date: HTMLElement; weather: HTMLElement; line: HTMLElement; open: HTMLButtonElement } {
  const root = element('div');
  root.id = 'lock-screen';
  root.append(element('i', 'punch-hole'));
  const date = element('p', 'lock__date');
  const time = element('p', 'lock__time');
  const weather = element('p', 'lock__weather');
  const line = element('p', 'lock__line');
  LOCK_CATS.forEach((id, index) => root.append(art(id, `lock__cat lock__cat--${index}`)));
  const card = element('div', 'lock__card');
  card.append(art('ui_cat_gio', 'lock__card-cat'), line);
  const open = element('button');
  open.id = 'lock-open';
  open.type = 'button';
  open.setAttribute('aria-label', t('phone.unlock'));
  open.append(art('ui_joystick_knob_paw', 'lock__paw'));
  const top = element('div', 'lock__top');
  top.append(date, art(WEATHER_ICON, 'lock__sun'));
  root.append(top, time, weather, card, open);
  return { root, time, date, weather, line, open };
}

function createDateWidget(): { root: HTMLElement; update: (world: World) => void } {
  const root = element('div', 'widget-date');
  const faces = element('div', 'widget-date__faces', '◡ ◡');
  const name = element('b');
  const detail = element('small');
  const heading = element('div', 'widget-date__heading');
  heading.append(faces, name, detail);
  const strip = element('div', 'widget-date__strip');
  const cells = Array.from({ length: 7 }, () => {
    const cell = element('span');
    strip.append(cell);
    return cell;
  });
  root.append(heading, strip);
  return {
    root,
    update: ({ day }) => {
      name.textContent = t(weekdayName(day));
      detail.textContent = `${t('hud.day')} ${day} · ${t('calendar.month')} ${monthOf(day)}`;
      weekStrip(day).forEach((value, index) => {
        const cell = cells[index] as HTMLElement;
        cell.textContent = '';
        cell.append(element('small', undefined, t(`weekday.short_${index}` as TextKey)), element('b', undefined, value >= 1 ? String(value) : '–'));
        cell.classList.toggle('is-today', value === day);
      });
    },
  };
}

function createTasksWidget(): HTMLElement {
  const root = element('div', 'widget-tasks');
  root.append(element('b', undefined, t('tasks.title')), element('small', undefined, t('tasks.empty')));
  return root;
}

function createCalendarWidget(): { root: HTMLElement; update: (world: World) => void } {
  const root = element('div', 'widget-calendar');
  root.id = 'tower-calendar';
  const title = element('b', 'widget-calendar__title');
  const grid = element('div', 'widget-calendar__grid');
  const cells = Array.from({ length: balance.calendar.daysPerMonth }, (_, index) => {
    const cell = element('span', undefined, String(index + 1));
    grid.append(cell);
    return cell;
  });
  const today = element('div', 'widget-calendar__today');
  today.append(element('b', undefined, t('calendar.today')), element('small', undefined, t('calendar.no_event')));
  const body = element('div', 'widget-calendar__body');
  body.append(grid, today);
  root.append(title, body);
  return {
    root,
    update: ({ day }) => {
      title.textContent = `${t('calendar.month')} ${monthOf(day)}`;
      cells.forEach((cell, index) => cell.classList.toggle('is-today', index + 1 === dayOfMonth(day)));
    },
  };
}

function createStuckWidget(): { root: HTMLElement; update: (world: World) => void } {
  const root = element('div', 'widget-stuck');
  root.id = 'stuck-counter';
  const heading = element('div', 'widget-stuck__heading');
  const floor = element('small');
  heading.append(element('b', undefined, t('stuck.title')), floor);
  const values = element('div', 'widget-stuck__values');
  const parts = (['stuck.months', 'stuck.days', 'stuck.hours'] as const).map((label) => {
    const part = element('div');
    const number = element('b');
    part.append(number, element('small', undefined, t(label)));
    values.append(part);
    return number;
  });
  root.append(heading, values);
  return {
    root,
    update: ({ day, hour }) => {
      const { months, days, hours } = stuckTime(day, hour);
      [months, days, hours].forEach((value, index) => {
        (parts[index] as HTMLElement).textContent = String(value);
      });
      floor.textContent = `${t('stuck.floor')} ${balance.calendar.currentFloorPlaceholder} / ${balance.calendar.totalFloors}`;
    },
  };
}

function createBack(): { root: HTMLElement; flip: HTMLButtonElement } {
  const root = element('div', 'phone-back');
  root.id = 'phone-back-side';
  const cameras = element('div', 'phone-back__cameras');
  cameras.append(element('i'), element('i'));
  const face = element('p', 'phone-back__face', 'ˈwˈ');
  const name = element('small', 'phone-back__name', t('phone.case_default'));
  const flip = element('button', 'phone-tool', t('phone.flip_back'));
  flip.type = 'button';
  root.append(cameras, face, name, flip);
  return { root, flip };
}

export function createPhone(uiRoot: HTMLElement): void {
  const mini = createMini();
  const lock = createLock();

  const backdrop = element('div');
  backdrop.id = 'phone-backdrop';
  backdrop.hidden = true;

  const phone = element('div');
  phone.id = 'phone';
  phone.dataset.fold = 'folded';
  phone.dataset.side = 'front';
  phone.setAttribute('role', 'dialog');
  phone.setAttribute('aria-label', t('phone.open'));
  phone.hidden = true;
  phone.append(element('i', 'phone-ear phone-ear--left'), element('i', 'phone-ear phone-ear--right'));

  const front = element('div', 'phone-front');
  const bar = element('div', 'phone-bar');
  const clock = element('span');
  clock.id = 'phone-time';
  const status = element('span');
  status.id = 'phone-status';
  const unfold = element('button', 'phone-tool', t('phone.unfold'));
  unfold.id = 'phone-unfold';
  unfold.type = 'button';
  const flip = element('button', 'phone-tool', t('phone.flip'));
  flip.id = 'phone-flip';
  flip.type = 'button';
  const close = element('button', 'phone-tool', '×');
  close.id = 'phone-close';
  close.type = 'button';
  close.setAttribute('aria-label', t('ui.close'));
  bar.append(clock, status, unfold, flip, close);

  const main = element('div', 'phone-main');
  const date = createDateWidget();
  const grid = element('div', 'phone-apps');
  const gioWidget = element('div', 'widget-gio');
  const gio = element('div', 'widget-gio__sprite');
  gio.style.backgroundImage = `url("${artUrl('gio_stand')}")`;
  gioWidget.append(gio, element('small', undefined, t('phone.gio')));
  const tasks = createTasksWidget();
  main.append(date.root, grid, tasks);

  const extra = element('div', 'phone-extra');
  const calendar = createCalendarWidget();
  const stuck = createStuckWidget();
  extra.append(calendar.root, stuck.root);

  const content = element('div', 'phone-content');
  content.hidden = true;
  const backButton = element('button', 'phone-tool', t('phone.back'));
  backButton.id = 'phone-back';
  backButton.type = 'button';
  const pageHolder = element('div', 'phone-content__page');
  content.append(backButton, pageHolder);

  const dock = element('div', 'phone-dock');
  const screen = element('div', 'phone-screen');
  screen.append(main, extra, content, dock);
  front.append(bar, screen, element('div', 'phone-dots', '● ○ ○'));

  const back = createBack();
  phone.append(front, back.root);
  backdrop.append(lock.root, phone);
  uiRoot.append(mini.root, backdrop);

  const pages = new Map<string, HTMLElement>();
  const appButton = (app: PhoneApp, withLabel: boolean): HTMLButtonElement => {
    const button = element('button', `phone-app phone-app--${app.id}`);
    button.type = 'button';
    button.dataset.app = app.id;
    button.setAttribute('aria-label', t(app.name));
    button.append(stickerIcon(app.icon));
    if (withLabel) button.append(element('span', 'phone-app__name', t(app.name)));
    button.addEventListener('click', () => openApp(app));
    return button;
  };
  APPS.filter((app) => app.place === 'grid').forEach((app, index) => {
    grid.append(appButton(app, true));
    // วิดเจ็ตจีโออยู่ตรงกลางตารางตามภาพตัวอย่าง
    if (index === 5) grid.append(gioWidget);
  });
  APPS.filter((app) => app.place === 'dock').forEach((app) => dock.append(appButton(app, false)));

  const setFold = (fold: 'folded' | 'unfolded'): void => {
    phone.dataset.fold = fold;
    unfold.textContent = t(fold === 'folded' ? 'phone.unfold' : 'phone.fold');
  };

  function openApp(app: PhoneApp): void {
    let page = pages.get(app.id);
    if (!page) {
      page = app.page ? app.page() : placeholderPage(app);
      pages.set(app.id, page);
    }
    pageHolder.replaceChildren(page);
    content.hidden = false;
    phone.dataset.app = app.id;
    if (app.big) setFold('unfolded');
  }

  const closeApp = (): void => {
    content.hidden = true;
    delete phone.dataset.app;
  };
  backButton.addEventListener('click', closeApp);

  const showHome = (): void => {
    lock.root.hidden = true;
    phone.hidden = false;
  };
  const openPhone = (): void => {
    if (!backdrop.hidden) return;
    backdrop.hidden = false;
    lock.root.hidden = false;
    phone.hidden = true;
    closeApp();
    setFold('folded');
    phone.dataset.side = 'front';
    gameState.setWindowOpen(PHONE_WINDOW, true);
  };
  const closePhone = (): void => {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    gameState.setWindowOpen(PHONE_WINDOW, false);
  };

  mini.root.addEventListener('click', openPhone);
  close.addEventListener('click', closePhone);
  unfold.addEventListener('click', () => setFold(phone.dataset.fold === 'folded' ? 'unfolded' : 'folded'));
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closePhone();
  });
  lock.root.addEventListener('click', showHome);
  let swipeStartY: number | null = null;
  lock.root.addEventListener('pointerdown', (event) => {
    swipeStartY = event.clientY;
  });
  lock.root.addEventListener('pointerup', (event) => {
    if (swipeStartY !== null && swipeStartY - event.clientY > SWIPE_UP_PX) showHome();
    swipeStartY = null;
  });

  const flipSide = (): void => {
    phone.classList.add('is-flipping');
    window.setTimeout(() => {
      phone.dataset.side = phone.dataset.side === 'front' ? 'back' : 'front';
      phone.classList.remove('is-flipping');
    }, FLIP_MS);
  };
  flip.addEventListener('click', flipSide);
  back.flip.addEventListener('click', flipSide);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePhone();
    if (event.key === 'Tab') {
      event.preventDefault();
      if (backdrop.hidden) openPhone();
      else closePhone();
    }
  });

  eventBus.on('world-changed', (world) => {
    const time = formatClock(world.hour);
    const short = `${t(`weekday.compact_${weekdayIndex(world.day)}` as TextKey)} ${world.day}`;
    mini.time.textContent = time;
    mini.date.textContent = short;
    lock.time.textContent = time;
    lock.date.textContent = short;
    lock.weather.textContent = t('weather.sunny');
    lock.line.textContent = encouragementFor(world.day);
    clock.textContent = time;
    status.textContent = `${t(weekdayShort(world.day))} ${world.day} · ${t('weather.sunny')}`;
    date.update(world);
    calendar.update(world);
    stuck.update(world);
  });
}
