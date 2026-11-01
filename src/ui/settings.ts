import { t } from '../core/i18n';
import { gameState } from '../core/state';

const STORAGE_KEY = 'lighting-enabled';
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

export function createSettings(uiRoot: HTMLElement): void {
  gameState.setLightingEnabled(readStoredLighting());

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
  close.addEventListener('click', () => {
    panel.hidden = true;
  });

  panel.append(title, row, close);
  button.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') panel.hidden = true;
  });
  uiRoot.append(button, panel);
}
