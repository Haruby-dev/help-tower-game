import { eventBus, type GameEvents } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type Weather, type World } from '../core/state';
import balance from '../data/balance.json';
import { cosmeticTable } from '../systems/chests';
import { dayOfMonth, encouragementFor, monthOf, stuckTime, weekStrip, weekdayIndex } from '../systems/phoneCalendar';
import { formatClock } from './hud';
import { createInventoryPage } from './inventory';
import { artUrl, sizedArt } from './pixelArt';
import { createShopPage } from './shop';
import { createWalletPage } from './wallet';
import { revealWhenReady } from './preload';

/** แอปในหน้าต่างโทรศัพท์ขนาดกลาง ใส่เนื้อหาในการ์ดกระดาษซ้ายและขวา */
export interface PhonePage {
  left: HTMLElement;
  right: HTMLElement;
  /** เรียกทุกครั้งที่เปิดแอปนี้ */
  shown?: () => void;
}

type BookApp = GameEvents['app-open'];

interface PhoneApp {
  id: string;
  name: TextKey;
  icon: string;
  /** สีพื้นวงกลมสติกเกอร์ใต้ไอคอน */
  plate: string;
  /** แอปที่อยู่ในหน้าต่างโทรศัพท์ (การ์ดสองใบ) */
  page?: () => PhonePage;
  /** แอปที่เปิดเป็นสมุดหรือการ์ดของตัวเองบนเกมที่มืดลง */
  opens?: 'book-open' | BookApp;
}

/** 10 แอปตามภาพ home_10apps (ผู้ใช้เอาแอปชุดออก 7 พ.ย. 2026 ชุดจะไปอยู่ตู้เสื้อผ้าในบ้านทีหลัง) */
const APPS: PhoneApp[] = [
  { id: 'inventory', name: 'app.inventory', icon: 'ui_app_bag', plate: '#ffe3ee', page: createInventoryPage },
  { id: 'wallet', name: 'app.wallet', icon: 'ui_app_wallet', plate: '#e2f5ea', page: createWalletPage },
  { id: 'shop', name: 'app.shop', icon: 'ui_app_shop', plate: '#fff1d6', page: createShopPage },
  { id: 'recipes', name: 'app.recipes', icon: 'ui_app_recipe', plate: '#e9e1fb', opens: 'book-open' },
  { id: 'album', name: 'app.album', icon: 'ui_app_album', plate: '#ffe3ee', opens: 'album' },
  { id: 'pets', name: 'app.pets', icon: 'ui_app_pets', plate: '#dcecff', opens: 'pets' },
  { id: 'gate', name: 'app.gate', icon: 'ui_app_gate', plate: '#e9e1fb', opens: 'gate' },
  { id: 'mail', name: 'app.mail', icon: 'ui_app_mail', plate: '#fff1d6', opens: 'mail' },
  { id: 'support', name: 'app.support', icon: 'ui_app_support', plate: '#ffe3ee', opens: 'support' },
  { id: 'settings', name: 'app.settings', icon: 'ui_app_settings', plate: '#e9e1fb', opens: 'settings' },
];

const PHONE_WINDOW = 'phone';
const FLIP_MS = 160;
const SWIPE_UP_PX = 30;
/** ไอคอนอากาศเปลี่ยนตามอากาศของวัน */
const WEATHER_ICONS: Record<Weather, string> = { sunny: 'ui_weather_sun', rain: 'ui_weather_rain', cloudy: 'ui_weather_cloud' };
const MINI_CATS = ['ui_cat_orange', 'ui_cat_gio'];

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** ภาพขนาดจริงคูณหน่วยพิกเซลของที่ที่วาง (--px ในการ์ดคือพิกเซลภาพหนึ่งจุด) */
export const phoneArt = (id: string, className: string, unit = '--px'): HTMLImageElement => sizedArt(id, className, unit);

const weatherArt = (className: string): HTMLImageElement => {
  const image = phoneArt(WEATHER_ICONS.sunny, className);
  image.dataset.weatherIcon = '';
  return image;
};

/** ไม่มีสัญญาณ (ติดอยู่ในหอคอย โทรออกไม่ได้) กับแบตเตอรี่ วาดด้วย CSS */
function statusIcons(): HTMLElement {
  const holder = element('span', 'sb-icons');
  const signal = element('span', 'sb-signal');
  for (let bar = 0; bar < 4; bar += 1) signal.append(element('i'));
  signal.append(element('b', undefined, '×'));
  const battery = element('span', 'sb-battery');
  battery.append(element('span', 'sb-battery__body'), element('span', 'sb-battery__tip'));
  battery.firstElementChild!.append(element('i'));
  holder.append(signal, battery);
  return holder;
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
  const miniArt = (id: string, className: string): HTMLImageElement => {
    const image = element('img', `pixel-img ${className}`);
    image.src = artUrl(id);
    image.alt = '';
    return image;
  };
  cats.append(...MINI_CATS.map((id) => miniArt(id, 'mini__cat')));
  const weather = miniArt(WEATHER_ICONS.sunny, 'mini__weather');
  weather.dataset.weatherIcon = '';
  screen.append(weather, date, miniArt('ui_v3_punch_hole', 'punch-hole'), time, cats);
  root.append(screen);
  return { root, time, date };
}

/** จอล็อกโทรศัพท์เล็ก (lock_S3A) วอลเปเปอร์ฟ้าอยู่ใต้กระจกใส */
function createLock(): { root: HTMLElement; update: (world: World) => void; open: HTMLButtonElement } {
  const root = element('div', 'pl');
  root.id = 'lock-screen';
  const date = element('div', 'pl-date tape');
  const time = element('div', 'pl-time');
  const weather = element('div', 'pl-pill');
  const status = element('div', 'pl-status');
  status.append(statusIcons());
  const card = element('div', 'pl-card');
  const line = element('p');
  const open = element('button', 'pl-go', '›');
  open.id = 'lock-open';
  open.type = 'button';
  open.setAttribute('aria-label', t('phone.unlock'));
  card.append(phoneArt('ui_v3_paw_button', 'pl-paw', '--m4'), line, open);
  root.append(status, date, weatherArt('pl-sun die'), time, weather, phoneArt('ui_cat_grey', 'pl-cat die', '--m4'), element('i', 'pl-shine'), card);
  return {
    root,
    open,
    update: (world) => {
      date.textContent = `${t(`weekday.compact_${weekdayIndex(world.day)}` as TextKey)} ${world.day}`;
      time.textContent = formatClock(world.hour);
      weather.textContent = t(`weather.${world.weather}` as TextKey);
      line.textContent = encouragementFor(world.day);
    },
  };
}

/** หน้าหลักการ์ดขวา: ตราวันที่ แถบสัปดาห์ งานวันนี้ และตัวนับติดอยู่ในหอคอย */
function createToday(): { root: HTMLElement; update: (world: World) => void } {
  const root = element('div', 'pz ph-today');
  root.append(element('i', 'tape ph-tape'));
  const stamp = element('div', 'ph-stamp');
  const dayName = element('div', 'ph-dn');
  const month = element('div', 'ph-mn');
  const weatherText = element('div', 'ph-wt');
  const week = element('div', 'ph-week');
  const cells = Array.from({ length: 7 }, (_, index) => {
    const cell = element('div');
    const number = element('b');
    cell.append(element('i', undefined, t(`weekday.short_${index}` as TextKey)), number);
    week.append(cell);
    return { cell, number };
  });
  const tasks = element('div', 'ph-task', t('tasks.empty'));
  tasks.id = 'today-tasks';
  const stuck = element('div', 'ph-stk');
  stuck.id = 'stuck-counter';
  const floor = element('div', 'ph-flr');
  root.append(
    stamp,
    dayName,
    month,
    weatherArt('ph-sun die'),
    weatherText,
    week,
    element('i', 'ph-rule'),
    element('div', 'ph-h ph-h--tasks', t('tasks.title')),
    tasks,
    element('div', 'ph-h ph-h--stuck', t('stuck.title')),
    stuck,
    floor,
    phoneArt('ui_cat_gio', 'ph-gio', '--px4'),
  );
  root.id = 'tower-calendar';
  const number = (value: number): HTMLElement => element('b', undefined, String(value));
  return {
    root,
    update: (world) => {
      stamp.textContent = String(dayOfMonth(world.day));
      dayName.textContent = t(`weekday.compact_${weekdayIndex(world.day)}` as TextKey);
      month.textContent = `${t('calendar.month')} ${monthOf(world.day)}`;
      weatherText.textContent = t(`weather.${world.weather}` as TextKey);
      weekStrip(world.day).forEach((value, index) => {
        const { cell, number: label } = cells[index]!;
        label.textContent = value >= 1 ? String(dayOfMonth(value)) : '–';
        cell.className = value === world.day ? 'on' : value < world.day ? 'past' : '';
      });
      const { months, days, hours } = stuckTime(world.day, world.hour);
      stuck.replaceChildren(number(months), ` ${t('stuck.months')} `, number(days), ` ${t('stuck.days')} `, number(hours), ` ${t('stuck.hours')}`);
      floor.textContent = `${t('stuck.floor')} ${balance.calendar.currentFloorPlaceholder}`;
    },
  };
}

function createBack(): { root: HTMLElement; flip: HTMLButtonElement; showCase: (id: string) => void } {
  const root = element('div', 'pw-back');
  root.id = 'phone-back-side';
  const name = element('small', 'pw-back__name', t('phone.case_default'));
  const flip = element('button', 'pw-btn pw-back__flip', t('phone.flip_back'));
  flip.type = 'button';
  const caseArt = phoneArt(cosmeticTable.case_pink_cat!.art, 'pw-back__case');
  root.append(caseArt, name, flip);
  /** เคสที่เลือกในแอปกระเป๋า แท็บสะสม */
  const showCase = (id: string): void => {
    const chosen = cosmeticTable[id];
    if (!chosen) return;
    caseArt.src = artUrl(chosen.art);
    name.textContent = t(`cosmetic.${id}.name` as TextKey);
  };
  return { root, flip, showCase };
}

const ctrlButton = (id: string, text: string, label: TextKey): HTMLButtonElement => {
  const button = element('button', 'pw-ctrl__btn', text);
  button.id = id;
  button.type = 'button';
  button.setAttribute('aria-label', t(label));
  return button;
};

/**
 * โทรศัพท์ (ผู้ใช้อนุมัติ 6–7 พ.ย. 2026): แตะโทรศัพท์ย่อมุมจอ → จอล็อกโทรศัพท์เล็กกลางจอ → ค่อย ๆ ขยายเป็นหน้าต่างกระจกขนาดกลาง
 * หน้าหลักและแอปกระเป๋า กระเป๋าเงิน ร้านค้า อยู่ในหน้าต่างนี้ · สมุดและการ์ดเปิดบนเกมที่มืดลงแทน
 */
export function createPhone(uiRoot: HTMLElement): void {
  const mini = createMini();
  const lock = createLock();

  const backdrop = element('div');
  backdrop.id = 'phone-backdrop';
  backdrop.hidden = true;

  const phone = element('div', 'pw');
  phone.id = 'phone';
  phone.dataset.state = 'lock';
  phone.dataset.side = 'front';
  phone.setAttribute('role', 'dialog');
  phone.setAttribute('aria-label', t('phone.open'));
  phone.style.setProperty('--wallpaper', `url("${artUrl('ui_v3_wallpaper_sky')}")`);

  const sbar = element('div', 'pw-sbar');
  const clock = element('span', 'pw-sbar__time');
  clock.id = 'phone-time';
  sbar.append(clock, statusIcons());

  const left = element('div', 'pw-card pw-card--l');
  const right = element('div', 'pw-card pw-card--r');
  const ctrl = element('div', 'pw-ctrl');
  const home = ctrlButton('phone-back', '‹', 'phone.back');
  const fold = ctrlButton('phone-fold', '⇆', 'phone.fold');
  const flip = ctrlButton('phone-flip', '↻', 'phone.flip');
  const close = ctrlButton('phone-close', '✕', 'ui.close');
  ctrl.append(home, fold, flip, close);
  const front = element('div', 'pw-front');
  front.append(sbar, left, right, ctrl);

  const back = createBack();
  phone.append(element('i', 'pw-case'), element('i', 'pw-rim'), element('i', 'pw-glint'), lock.root, front, back.root, phoneArt('ui_cat_peek', 'pw-peek', '--m4'));
  backdrop.append(phone);
  uiRoot.append(mini.root, backdrop);

  // หน้าหลัก
  const grid = element('div', 'pz ph-apps');
  const today = createToday();
  const appButton = (app: PhoneApp): HTMLButtonElement => {
    const button = element('button', `phone-app phone-app--${app.id}`);
    button.type = 'button';
    button.dataset.app = app.id;
    button.setAttribute('aria-label', t(app.name));
    const plate = element('span', 'phone-app__plate');
    plate.style.background = app.plate;
    plate.append(phoneArt(app.icon, 'phone-app__icon'));
    button.append(plate, element('span', 'phone-app__name', t(app.name)));
    button.addEventListener('click', () => openApp(app));
    return button;
  };
  const appGrid = element('div', 'ph-grid');
  appGrid.append(...APPS.map(appButton));
  grid.append(appGrid);

  const pages = new Map<string, PhonePage>();
  let state: 'lock' | 'open' = 'lock';
  /** เปิดสมุดหรือการ์ดจากโทรศัพท์: ซ่อนโทรศัพท์ไว้ (นาฬิกายังหยุด) ปิดสมุดแล้วกลับมาที่หน้าหลัก */
  let suspended = false;

  const setState = (next: 'lock' | 'open'): void => {
    state = next;
    phone.dataset.state = next;
    uiRoot.classList.toggle('phone-wide', next === 'open' && !backdrop.hidden);
  };

  const showHome = (): void => {
    delete phone.dataset.app;
    phone.dataset.side = 'front';
    left.replaceChildren(grid);
    right.replaceChildren(today.root);
    home.hidden = true;
    fold.hidden = false;
    setState('open');
    revealWhenReady(phone);
  };

  function openApp(app: PhoneApp): void {
    if (app.opens) {
      // สมุดและการ์ดเปิดบนเกมแทนหน้าต่างโทรศัพท์ ปิดแล้วกลับมาที่หน้าหลักเหมือนเดิม
      suspended = true;
      backdrop.hidden = true;
      uiRoot.classList.remove('phone-wide');
      if (app.opens === 'book-open') eventBus.emit('book-open', undefined);
      else eventBus.emit('app-open', app.opens);
      return;
    }
    let page = pages.get(app.id);
    if (!page) {
      page = app.page!();
      pages.set(app.id, page);
    }
    left.replaceChildren(page.left);
    right.replaceChildren(page.right);
    page.shown?.();
    phone.dataset.app = app.id;
    home.hidden = false;
    fold.hidden = true;
    revealWhenReady(phone);
  }

  const openPhone = (): void => {
    if (!backdrop.hidden) return;
    backdrop.hidden = false;
    phone.dataset.side = 'front';
    delete phone.dataset.app;
    setState('lock');
    revealWhenReady(backdrop);
    gameState.setWindowOpen(PHONE_WINDOW, true);
  };
  function closePhone(): void {
    if (backdrop.hidden || suspended) return;
    backdrop.hidden = true;
    uiRoot.classList.remove('phone-wide');
    gameState.setWindowOpen(PHONE_WINDOW, false);
  }

  mini.root.addEventListener('click', openPhone);
  close.addEventListener('click', closePhone);
  home.addEventListener('click', showHome);
  fold.addEventListener('click', () => setState('lock'));
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closePhone();
  });
  lock.root.addEventListener('click', (event) => {
    if (state === 'lock' && event.target !== lock.open) showHome();
  });
  lock.open.addEventListener('click', showHome);
  let swipeStartY: number | null = null;
  lock.root.addEventListener('pointerdown', (event) => {
    swipeStartY = event.clientY;
  });
  lock.root.addEventListener('pointerup', (event) => {
    if (swipeStartY !== null && swipeStartY - event.clientY > SWIPE_UP_PX && state === 'lock') showHome();
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
      if (suspended) return;
      if (backdrop.hidden) openPhone();
      else closePhone();
    }
  });

  eventBus.on('app-closed', () => {
    if (!suspended) return;
    suspended = false;
    backdrop.hidden = false;
    showHome();
  });

  eventBus.on('world-changed', (world) => {
    const time = formatClock(world.hour);
    mini.time.textContent = time;
    mini.date.textContent = `${t(`weekday.compact_${weekdayIndex(world.day)}` as TextKey)} ${world.day}`;
    clock.textContent = time;
    for (const icon of document.querySelectorAll<HTMLImageElement>('[data-weather-icon]')) icon.src = artUrl(WEATHER_ICONS[world.weather]);
    back.showCase(world.cosmetics.equipped.case);
    lock.update(world);
    today.update(world);
  });
}
