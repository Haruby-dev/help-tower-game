import { t } from '../core/i18n';
import { gameState } from '../core/state';
import display from '../data/display.json';
import { createSaveRow } from './saves';

const STORAGE_KEY = 'lighting-enabled';
const ZOOM_STORAGE_KEY = 'zoom-step';
const ZOOM_LABELS = ['settings.zoom_normal', 'settings.zoom_near', 'settings.zoom_nearer'] as const;
const SETTINGS_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>';

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

export function createSettings(uiRoot: HTMLElement): void {
  gameState.setLightingEnabled(readStoredLighting());
  gameState.setZoomStep(readStoredZoomStep());

  const button = document.createElement('button');
  button.id = 'settings-button';
  button.type = 'button';
  button.className = 'panel';
  button.innerHTML = SETTINGS_ICON;
  button.setAttribute('aria-label', t('ui.settings'));

  const panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.className = 'panel';
  panel.hidden = true;

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

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'settings-button';
  close.textContent = t('ui.close');
  // เปิดหน้าตั้งค่าเมื่อไหร่ นาฬิกาเกมหยุดทันที
  const setOpen = (open: boolean): void => {
    panel.hidden = !open;
    gameState.setWindowOpen('settings', open);
  };
  close.addEventListener('click', () => setOpen(false));

  panel.append(title, row, createZoomRow(), createSaveRow(), close);
  button.addEventListener('click', () => setOpen(panel.hidden !== false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
  uiRoot.append(button, panel);
}
