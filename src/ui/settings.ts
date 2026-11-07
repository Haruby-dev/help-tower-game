import { audioSettings, sound, type SoundGroup } from '../core/audio';
import balance from '../data/balance.json';
import { applyTransaction } from '../systems/economy';
import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState } from '../core/state';
import { isHomeScreenApp } from '../core/viewport';
import display from '../data/display.json';
import { artUrl, sizedArt, stickerIcon } from './pixelArt';
import { createCard } from './book';
import { createSaveRow } from './saves';
import { itemName } from './inventory';
import { uiSound } from './sound';
import ingredientsJson from '../data/ingredients.json';
import shopJson from '../data/shop.json';
import chestsJson from '../data/chests.json';
import { dishItem, recipes } from '../systems/cooking';
import { addToBag, crops, produceItem, seedItem } from '../systems/farm';
import { baits, fishItem, fishTable } from '../systems/fishing';
import { carriesStars, withStars } from '../systems/stars';

const STORAGE_KEY = 'lighting-enabled';
const ZOOM_STORAGE_KEY = 'zoom-step';
const AUTO_FISH_KEY = 'auto-fish';
const AUTO_REBAIT_KEY = 'auto-rebait';
const ZOOM_LABELS = ['settings.zoom_normal', 'settings.zoom_near', 'settings.zoom_nearer'] as const;

/** ค่าที่จำไว้เฉพาะเครื่องนี้ ถ้าเบราว์เซอร์ไม่ให้เก็บก็ยังเล่นได้ */
function readStoredLighting(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function storeLighting(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // ไม่เก็บค่าก็ไม่กระทบการเล่น
  }
}

function readStoredAutoFish(): boolean {
  try {
    return window.localStorage.getItem(AUTO_FISH_KEY) === 'on';
  } catch {
    return false;
  }
}

function storeAutoFish(on: boolean): void {
  try {
    window.localStorage.setItem(AUTO_FISH_KEY, on ? 'on' : 'off');
  } catch {
    // ไม่เก็บค่าก็ไม่กระทบการเล่น
  }
}

function readStoredFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'on';
  } catch {
    return false;
  }
}

function storeFlag(key: string, on: boolean): void {
  try {
    window.localStorage.setItem(key, on ? 'on' : 'off');
  } catch {
    // ไม่เก็บค่าก็ไม่กระทบการเล่น
  }
}

/** ใช้เหยื่อเดิมต่ออัตโนมัติ แสดงเฉพาะตอนเปิดตกปลาอัตโนมัติ */
function createAutoRebaitRow(): { row: HTMLElement; sync(): void } {
  const row = document.createElement('div');
  row.className = 'settings-row';
  row.id = 'auto-rebait-row';
  const label = Object.assign(document.createElement('span'), { textContent: t('settings.auto_rebait') });
  const toggle = document.createElement('button');
  toggle.id = 'auto-rebait-toggle';
  toggle.type = 'button';
  toggle.className = 'settings-button';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-label', t('settings.auto_rebait'));
  const sync = (): void => {
    row.hidden = !gameState.autoFish;
    toggle.setAttribute('aria-checked', String(gameState.autoRebait));
    toggle.textContent = t(gameState.autoRebait ? 'settings.on' : 'settings.off');
  };
  toggle.addEventListener('click', () => {
    gameState.setAutoRebait(!gameState.autoRebait);
    storeFlag(AUTO_REBAIT_KEY, gameState.autoRebait);
    sync();
  });
  row.append(label, toggle);
  sync();
  return { row, sync };
}

/** ตกปลาอัตโนมัติ ขึ้น "!" แล้วดึงให้เอง สำหรับคนที่ไม่อยากลุ้นจังหวะ รอนานกว่าและพลาดได้ */
function createAutoFishRow(onChange: () => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings-row';
  const label = Object.assign(document.createElement('span'), { textContent: t('settings.auto_fish') });
  const toggle = document.createElement('button');
  toggle.id = 'auto-fish-toggle';
  toggle.type = 'button';
  toggle.className = 'settings-button';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-label', t('settings.auto_fish'));
  const show = (): void => {
    toggle.setAttribute('aria-checked', String(gameState.autoFish));
    toggle.textContent = t(gameState.autoFish ? 'settings.on' : 'settings.off');
  };
  show();
  toggle.addEventListener('click', () => {
    gameState.setAutoFish(!gameState.autoFish);
    storeAutoFish(gameState.autoFish);
    show();
    onChange();
  });
  row.append(label, toggle);
  return row;
}

/** จอสัมผัสเริ่มใกล้กว่าจอคอม เพราะจอเล็กและตัวละครจะดูเล็กเกินไป */
function readStoredZoomStep(): number {
  const fallback = window.matchMedia('(pointer: coarse)').matches ? display.touchDefaultZoomStep : 0;
  try {
    const stored = Number(window.localStorage.getItem(ZOOM_STORAGE_KEY) ?? fallback);
    return display.zoomSteps.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function storeZoomStep(step: number): void {
  try {
    window.localStorage.setItem(ZOOM_STORAGE_KEY, String(step));
  } catch {
    // ไม่เก็บค่าก็ไม่กระทบการเล่น
  }
}

function createZoomRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings-row';
  const label = document.createElement('span');
  label.textContent = t('settings.zoom');
  const choices = document.createElement('div');
  choices.className = 'settings-choices';
  choices.setAttribute('role', 'radiogroup');
  choices.setAttribute('aria-label', t('settings.zoom'));

  const buttons = display.zoomSteps.map((step, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'settings-button';
    button.dataset.zoomStep = String(step);
    button.setAttribute('role', 'radio');
    button.textContent = t(ZOOM_LABELS[index] ?? 'settings.zoom_normal');
    return button;
  });
  const showChoice = (): void => {
    for (const button of buttons) {
      button.setAttribute('aria-checked', String(Number(button.dataset.zoomStep) === gameState.zoomStep));
    }
  };
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const step = Number(button.dataset.zoomStep);
      gameState.setZoomStep(step);
      storeZoomStep(step);
      showChoice();
    });
  }
  showChoice();
  choices.append(...buttons);
  row.append(label, choices);
  return row;
}

/** iPhone ไม่ให้หน้าเว็บซ่อนแถบ Safari เองได้ ทางเดียวคือเปิดเกมจากไอคอนบนหน้าจอโฮม */
function createHomeScreenHowTo(): HTMLElement {
  const box = document.createElement('div');
  box.id = 'fullscreen-howto';
  const label = document.createElement('b');
  label.textContent = t('settings.fullscreen');
  const steps = document.createElement('ol');
  steps.className = 'settings-howto';
  for (const key of ['settings.fullscreen_step1', 'settings.fullscreen_step2', 'settings.fullscreen_step3'] as const) {
    const step = document.createElement('li');
    step.textContent = t(key);
    steps.append(step);
  }
  box.append(label, steps);
  return box;
}

function createFullscreenRow(appRoot: HTMLElement): HTMLElement | null {
  if (isHomeScreenApp()) return null;
  if (!document.fullscreenEnabled) return createHomeScreenHowTo();
  const row = document.createElement('div');
  row.className = 'settings-row';
  const label = document.createElement('span');
  label.textContent = t('settings.fullscreen');
  const button = document.createElement('button');
  button.id = 'fullscreen-button';
  button.type = 'button';
  button.className = 'settings-button';
  const updateLabel = (): void => {
    button.textContent = t(document.fullscreenElement ? 'ui.fullscreen_exit' : 'ui.fullscreen_enter');
  };
  updateLabel();
  document.addEventListener('fullscreenchange', updateLabel);
  button.addEventListener('click', () => {
    void toggleFullscreen(appRoot);
  });
  row.append(label, button);
  return row;
}

async function toggleFullscreen(appRoot: HTMLElement): Promise<void> {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  eventBus.emit('fullscreen-requested', undefined);
  await appRoot.requestFullscreen();
  // เบราว์เซอร์ที่ไม่รองรับการล็อกแนวจอจะแจ้งข้อผิดพลาด จอชวนหมุนยังทำงานแทนได้
  const orientation = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> };
  await orientation.lock?.('landscape').catch(() => undefined);
}

const VOLUME_ROWS: {
  group: SoundGroup;
  label: 'settings.volume_music' | 'settings.volume_sfx' | 'settings.volume_voice' | 'settings.volume_ambience';
}[] = [
  { group: 'bgm', label: 'settings.volume_music' },
  { group: 'sfx', label: 'settings.volume_sfx' },
  { group: 'voice', label: 'settings.volume_voice' },
  { group: 'amb', label: 'settings.volume_ambience' },
];
const PERCENT = 100;
const VOLUME_STEP = 5;

/** แถบเลื่อนระดับเสียง เพลง เอฟเฟกต์ เสียงพูด เสียงบรรยากาศ จำค่าไว้ในเครื่อง */
function createVolumeRow(group: SoundGroup, labelKey: (typeof VOLUME_ROWS)[number]['label']): HTMLElement {
  const row = document.createElement('label');
  row.className = 'settings-row settings-volume';
  const label = Object.assign(document.createElement('span'), { textContent: t(labelKey) });
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(PERCENT);
  slider.step = String(VOLUME_STEP);
  slider.id = `volume-${group}`;
  slider.className = 'settings-slider';
  slider.value = String(Math.round(sound.volume(group) * PERCENT));
  slider.setAttribute('aria-label', t(labelKey));
  const value = Object.assign(document.createElement('b'), { className: 'settings-volume__value', textContent: slider.value });
  const showFill = (): void => slider.style.setProperty('--fill', `${slider.value}%`);
  showFill();
  slider.addEventListener('input', () => {
    sound.setVolume(group, Number(slider.value) / PERCENT);
    value.textContent = slider.value;
    showFill();
  });
  // ปล่อยนิ้วแล้วเล่นเสียงตัวอย่างของกลุ่มนั้น จะได้รู้ว่าดังแค่ไหน · เสียงบรรยากาศวนอยู่แล้วในเกม จึงไม่มีเสียงตัวอย่าง
  slider.addEventListener('change', () => {
    if (group === 'sfx') sound.play('ui_tap');
    if (group === 'voice') sound.say(audioSettings.voiceTakes[0]!);
  });
  row.append(label, slider, value);
  return row;
}

/** ของที่เสกได้ เรียงตามหมวด: ผัก เมล็ด ปุ๋ย อาหาร วัตถุดิบ ปลา เหยื่อ แมวเลีย หีบ */
function spawnableItems(): string[] {
  return [
    ...Object.keys(crops).map(produceItem),
    ...Object.keys(crops).map(seedItem),
    ...Object.keys(balance.fertilizer.tiers),
    ...Object.keys(recipes).map((recipe) => dishItem(recipe, 1)),
    ...Object.keys(ingredientsJson).map((id) => `ing_${id}`),
    ...Object.keys(fishTable).map(fishItem),
    ...Object.values(baits).map((bait) => bait.item),
    ...shopJson.treats.map((treat) => treat.item),
    ...Object.values(chestsJson.tiers).map((tier) => tier.item),
  ];
}

const SPAWN_COUNTS = [1, 5, 10, 99];

/** ปุ่มลับช่วงทดสอบ เสกของเข้ากระเป๋า เลือกของ ดาว (ผักและอาหาร) และจำนวน ต้องเอาออกก่อนปล่อยจริง */
function createTestSpawnRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings-row settings-test settings-spawn';
  const label = document.createElement('span');
  label.append(
    Object.assign(document.createElement('b'), { textContent: t('settings.test_spawn') }),
    Object.assign(document.createElement('small'), { textContent: t('settings.test_stars_note') }),
  );
  const choose = (id: string, values: { value: string; text: string }[]): HTMLSelectElement => {
    const select = document.createElement('select');
    select.id = id;
    select.className = 'settings-select';
    for (const { value, text } of values) select.append(Object.assign(document.createElement('option'), { value, textContent: text }));
    return select;
  };
  const item = choose(
    'test-spawn-item',
    spawnableItems().map((value) => ({ value, text: itemName(value) })),
  );
  const stars = choose('test-spawn-stars', [1, 2, 3].map((value) => ({ value: String(value), text: `${value} ★` })));
  const count = choose('test-spawn-count', SPAWN_COUNTS.map((value) => ({ value: String(value), text: `×${value}` })));
  const button = document.createElement('button');
  button.id = 'test-spawn';
  button.type = 'button';
  button.className = 'settings-button';
  button.textContent = t('settings.test_spawn_go');
  button.addEventListener('click', () => {
    if (!gameState.started) return;
    const level = Number(stars.value);
    // ผักใส่ดาวต่อท้ายรหัส อาหารเก็บดาวในรหัสของตัวเอง ของอื่นไม่มีดาว
    const base = item.value;
    const target = base.startsWith('dish_') ? dishItem(base.slice('dish_'.length, base.lastIndexOf('_')), level) : carriesStars(base) ? withStars(base, level) : base;
    const bag = addToBag(gameState.world.bag, target, Number(count.value));
    if (!bag) {
      eventBus.emit('player-says', 'bagFull');
      return;
    }
    gameState.setWorld({ ...gameState.world, bag });
    uiSound('ui_coin');
    eventBus.emit('notice-text', `${t('settings.test_spawn_got')} ${itemName(target)} ${level > 1 && target !== base ? `${level} ★ ` : ''}×${count.value}`);
  });
  const controls = document.createElement('div');
  controls.className = 'settings-choices settings-spawn__controls';
  controls.append(item, stars, count, button);
  row.append(label, controls);
  return row;
}

let appRootForPage: HTMLElement | null = null;

/** อ่านค่าที่จำไว้ตั้งแต่เปิดเกม ไม่ต้องรอเปิดหน้าตั้งค่า */
export function initSettings(appRoot: HTMLElement): void {
  appRootForPage = appRoot;
  gameState.setLightingEnabled(readStoredLighting());
  gameState.setZoomStep(readStoredZoomStep());
  gameState.setAutoFish(readStoredAutoFish());
  gameState.setAutoRebait(readStoredFlag(AUTO_REBAIT_KEY));
}

/** สวิตช์เปิดปิดแสงในหน้าจอ */
function createLightingRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings-row';
  const label = document.createElement('span');
  label.textContent = t('settings.light_short');
  const toggle = document.createElement('button');
  toggle.id = 'lighting-toggle';
  toggle.type = 'button';
  toggle.className = 'settings-button';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-label', t('settings.lighting'));
  const showToggle = (): void => {
    toggle.setAttribute('aria-checked', String(gameState.lightingEnabled));
    toggle.textContent = t(gameState.lightingEnabled ? 'settings.on' : 'settings.off');
  };
  showToggle();
  toggle.addEventListener('click', () => {
    gameState.setLightingEnabled(!gameState.lightingEnabled);
    storeLighting(gameState.lightingEnabled);
    showToggle();
  });
  row.append(label, toggle);
  return row;
}

/** iPhone: ปุ่ม "วิธีเต็มจอ" เปิดขั้นตอนเพิ่มไปยังหน้าจอโฮมในการ์ด */
function createHowToRow(card: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings-row';
  const label = Object.assign(document.createElement('span'), { textContent: t('settings.fullscreen') });
  const button = document.createElement('button');
  button.id = 'fullscreen-howto-button';
  button.type = 'button';
  button.className = 'settings-button st-purple';
  button.textContent = t('settings.fullscreen_howto');
  const howTo = createHomeScreenHowTo();
  howTo.classList.add('st-howto');
  howTo.hidden = true;
  button.addEventListener('click', () => {
    howTo.hidden = !howTo.hidden;
  });
  card.append(howTo);
  row.append(label, button);
  return row;
}

const box = (className: string, title: string, x: number, y: number, width: number, height: number): HTMLElement => {
  const node = document.createElement('div');
  node.className = `st-box ${className}`;
  node.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px`;
  node.append(Object.assign(document.createElement('div'), { className: 'st-bh', textContent: title }));
  return node;
};

/** ปุ่มลับช่วงทดสอบแบบสั้นในกรอบเส้นประ ต้องเอาออกก่อนปล่อยจริง */
function testButton(id: string, text: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = id;
  button.type = 'button';
  button.className = 'st-tb';
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

/**
 * การ์ดตั้งค่าใบเดียวบนเกมที่มืดลง (settings_card): เสียง · หน้าจอ · การเล่น · ไฟล์เซฟ
 * และกรอบเส้นประ "สำหรับทดสอบ · เอาออกก่อนปล่อยจริง" รอบปุ่มทดสอบ
 */
function createSettingsCard(card: HTMLElement): HTMLElement[] {
  const sound = box('st-snd', t('settings.sound'), 16, 36, 166, 182);
  sound.append(...VOLUME_ROWS.map(({ group, label: key }) => createVolumeRow(group, key)));
  const screen = box('st-scr', t('settings.screen'), 190, 36, 166, 90);
  screen.append(createZoomRow(), createLightingRow());
  const fullscreen = appRootForPage ? createFullscreenRow(appRootForPage) : null;
  if (fullscreen?.id === 'fullscreen-howto') screen.append(createHowToRow(card));
  else if (fullscreen) screen.append(fullscreen);
  const play = box('st-ply', t('settings.play'), 190, 132, 166, 86);
  const rebait = createAutoRebaitRow();
  play.append(createAutoFishRow(rebait.sync), rebait.row, createSaveRow());

  const test = document.createElement('div');
  test.className = 'st-test';
  test.append(Object.assign(document.createElement('div'), { className: 'st-th', textContent: t('settings.test_box') }));
  const spawn = createTestSpawnRow();
  spawn.hidden = true;
  test.append(
    testButton('test-stars', `${t('settings.test_stars')} +${balance.test.stars}`, () => {
      if (!gameState.started) return;
      gameState.setWorld(applyTransaction(gameState.world, 'stars', balance.test.stars, 'wallet.test_stars', 'wallet.category_test'));
    }),
    testButton('test-monster', t('settings.test_monster'), () => eventBus.emit('monster-summon', undefined)),
    testButton('test-spawn-open', t('settings.test_spawn'), () => {
      spawn.hidden = !spawn.hidden;
      card.classList.toggle('is-spawning', !spawn.hidden);
    }),
    spawn,
  );
  return [sound, screen, play, test];
}

const SETTINGS_WINDOW = 'settings';

/** ปุ่มตั้งค่าอยู่มุมขวาบนข้างโทรศัพท์ และเป็นแอปในโทรศัพท์ด้วย ทั้งสองทางเปิดการ์ดใบเดียวกัน */
export function createSettings(uiRoot: HTMLElement): void {
  const button = document.createElement('button');
  button.id = 'settings-button';
  button.type = 'button';
  button.setAttribute('aria-label', t('ui.settings'));
  button.append(stickerIcon('ui_app_settings'));

  const card = createCard(uiRoot, 'settings-window', 'st-card', SETTINGS_WINDOW);
  card.body.style.setProperty('--paw', `url("${artUrl('ui_joystick_knob_paw')}")`);
  uiRoot.append(button);

  const open = (): void => {
    // สร้างใหม่ทุกครั้งที่เปิด ค่าที่แสดงจึงตรงกับปัจจุบันเสมอ
    card.body.classList.remove('is-spawning');
    card.fill([Object.assign(document.createElement('div'), { className: 'st-tt', textContent: t('ui.settings') }), ...createSettingsCard(card.body)]);
    card.show();
  };
  button.addEventListener('click', open);
  eventBus.on('app-open', (app) => {
    if (app === 'settings') open();
  });
}

/** การ์ดสนับสนุนเดฟ (support_card): ข้อความของผู้ใช้ตามภาพตัวอย่าง ไม่มีปุ่มจ่ายเงิน */
export function createSupportCard(uiRoot: HTMLElement): void {
  const card = createCard(uiRoot, 'support-window', 'su-card', 'support');
  eventBus.on('app-open', (app) => {
    if (app !== 'support') return;
    const face = sizedArt('ui_gio_gio_face_happy', 'su-gio');
    const line = (className: string, key: Parameters<typeof t>[0]): HTMLElement => {
      const node = document.createElement('div');
      node.className = className;
      for (const [index, part] of t(key).split('\n').entries()) {
        if (index > 0) node.append(document.createElement('br'));
        node.append(part);
      }
      return node;
    };
    card.fill([face, line('su-tt', 'support.title'), line('su-t1', 'support.body'), line('su-t2', 'support.thanks'), Object.assign(document.createElement('span'), { className: 'su-soon', textContent: t('support.soon') })]);
    card.show();
  });
}
