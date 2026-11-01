import { t } from '../core/i18n';
import { gameState } from '../core/state';
import display from '../data/display.json';
import { createSaveRow } from './saves';

const STORAGE_KEY = 'lighting-enabled';
const ZOOM_STORAGE_KEY = 'zoom-step';
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

function createFullscreenRow(appRoot: HTMLElement): HTMLElement | null {
  // iPhone ไม่รองรับการเต็มจอจากหน้าเว็บ จึงไม่แสดงปุ่มที่กดแล้วไม่เกิดอะไร
  if (!document.fullscreenEnabled) return null;
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

let appRootForPage: HTMLElement | null = null;

/** อ่านค่าที่จำไว้ตั้งแต่เปิดเกม ไม่ต้องรอเปิดโทรศัพท์ */
export function initSettings(appRoot: HTMLElement): void {
  appRootForPage = appRoot;
  gameState.setLightingEnabled(readStoredLighting());
  gameState.setZoomStep(readStoredZoomStep());
}

export function createSettingsPage(): HTMLElement {
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

  page.append(title, row, createZoomRow(), createSaveRow());
  const fullscreen = appRootForPage ? createFullscreenRow(appRootForPage) : null;
  if (fullscreen) page.append(fullscreen);
  return page;
}
