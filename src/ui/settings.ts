import { audioSettings, sound, type SoundGroup } from '../core/audio';
import balance from '../data/balance.json';
import { applyTransaction } from '../systems/economy';
import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState } from '../core/state';
import { isHomeScreenApp } from '../core/viewport';
import display from '../data/display.json';
import { stickerIcon } from './pixelArt';
import { createSaveRow } from './saves';

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
  slider.addEventListener('input', () => {
    sound.setVolume(group, Number(slider.value) / PERCENT);
    value.textContent = slider.value;
  });
  // ปล่อยนิ้วแล้วเล่นเสียงตัวอย่างของกลุ่มนั้น จะได้รู้ว่าดังแค่ไหน · เสียงบรรยากาศวนอยู่แล้วในเกม จึงไม่มีเสียงตัวอย่าง
  slider.addEventListener('change', () => {
    if (group === 'sfx') sound.play('ui_tap');
    if (group === 'voice') sound.say(audioSettings.voiceTakes[0]!);
  });
  row.append(label, slider, value);
  return row;
}

/** ปุ่มลับช่วงทดสอบ ให้ดาวน้ำตาลไว้ลองของพรีเมียม ต้องเอาออกก่อนปล่อยจริง (CLAUDE.md หัวข้อลานเล่นมอนสเตอร์) */
function createTestStarsRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings-row settings-test';
  const label = document.createElement('span');
  const name = Object.assign(document.createElement('b'), { textContent: t('settings.test_stars') });
  const note = Object.assign(document.createElement('small'), { textContent: t('settings.test_stars_note') });
  label.append(name, note);
  const button = document.createElement('button');
  button.id = 'test-stars';
  button.type = 'button';
  button.className = 'settings-button';
  button.textContent = `+${balance.test.stars} ★`;
  button.addEventListener('click', () => {
    if (!gameState.started) return;
    gameState.setWorld(applyTransaction(gameState.world, 'stars', balance.test.stars, 'wallet.test_stars', 'wallet.category_test'));
  });
  row.append(label, button);
  return row;
}

/** ปุ่มลับช่วงทดสอบ เรียกมอนสเตอร์ที่มาได้ตัวแรกมาเยี่ยมตอนนี้เลย ไม่ต้องรอจีโอเร่ขาย ต้องเอาออกก่อนปล่อยจริง */
function createTestMonsterRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings-row settings-test';
  const label = document.createElement('span');
  const name = Object.assign(document.createElement('b'), { textContent: t('settings.test_monster') });
  const note = Object.assign(document.createElement('small'), { textContent: t('settings.test_stars_note') });
  label.append(name, note);
  const button = document.createElement('button');
  button.id = 'test-monster';
  button.type = 'button';
  button.className = 'settings-button';
  button.textContent = t('settings.test_monster');
  button.addEventListener('click', () => eventBus.emit('monster-summon', undefined));
  row.append(label, button);
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

function createSettingsPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'phone-page';
  const title = document.createElement('h2');
  title.textContent = t('ui.settings');

  const row = document.createElement('div');
  row.className = 'settings-row';
  const label = document.createElement('span');
  label.textContent = t('settings.lighting');
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

  const rebait = createAutoRebaitRow();
  const volumes = VOLUME_ROWS.map(({ group, label: key }) => createVolumeRow(group, key));
  page.append(title, ...volumes, row, createAutoFishRow(rebait.sync), rebait.row, createZoomRow(), createSaveRow());
  const fullscreen = appRootForPage ? createFullscreenRow(appRootForPage) : null;
  if (fullscreen) page.append(fullscreen);
  page.append(createTestStarsRow(), createTestMonsterRow());
  return page;
}

const SETTINGS_WINDOW = 'settings';

/** ปุ่มตั้งค่าอยู่มุมขวาบนข้างโทรศัพท์ แยกจากแอปในโทรศัพท์ */
export function createSettings(uiRoot: HTMLElement): void {
  const button = document.createElement('button');
  button.id = 'settings-button';
  button.type = 'button';
  button.setAttribute('aria-label', t('ui.settings'));
  button.append(stickerIcon('ui_app_settings'));

  const backdrop = document.createElement('div');
  backdrop.id = 'settings-backdrop';
  backdrop.hidden = true;
  const panel = document.createElement('div');
  panel.id = 'settings-window';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', t('ui.settings'));
  const close = document.createElement('button');
  close.id = 'settings-close';
  close.type = 'button';
  close.className = 'phone-tool';
  close.textContent = '×';
  close.setAttribute('aria-label', t('ui.close'));
  backdrop.append(panel);
  uiRoot.append(button, backdrop);

  const hide = (): void => {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    gameState.setWindowOpen(SETTINGS_WINDOW, false);
  };
  button.addEventListener('click', () => {
    // สร้างใหม่ทุกครั้งที่เปิด ค่าที่แสดงจึงตรงกับปัจจุบันเสมอ
    panel.replaceChildren(close, createSettingsPage());
    backdrop.hidden = false;
    gameState.setWindowOpen(SETTINGS_WINDOW, true);
  });
  close.addEventListener('click', hide);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
}
