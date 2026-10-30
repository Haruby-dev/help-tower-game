import { t } from '../core/i18n';
import { gameState } from '../core/state';
import { eventBus } from '../core/events';
import { needsRotation } from '../core/viewport';
import registry from '../../assets-src/registry.json';

const FULLSCREEN_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';

function createTestLine(uiRoot: HTMLElement): void {
  const line = document.createElement('p');
  line.id = 'test-line';
  line.className = 'panel';
  line.textContent = t('test.overlay_line');
  uiRoot.append(line);
}

function createFullscreenButton(uiRoot: HTMLElement, appRoot: HTMLElement): void {
  // iPhone ไม่รองรับการเต็มจอจากหน้าเว็บ จึงไม่แสดงปุ่มที่กดแล้วไม่เกิดอะไร
  if (!document.fullscreenEnabled) return;

  const button = document.createElement('button');
  button.id = 'fullscreen-button';
  button.type = 'button';
  button.className = 'panel';
  button.innerHTML = FULLSCREEN_ICON;

  const updateLabel = (): void => {
    button.setAttribute('aria-label', t(document.fullscreenElement ? 'ui.fullscreen_exit' : 'ui.fullscreen_enter'));
  };
  updateLabel();
  document.addEventListener('fullscreenchange', updateLabel);

  button.addEventListener('click', () => {
    void toggleFullscreen(appRoot);
  });
  uiRoot.append(button);
}

async function toggleFullscreen(appRoot: HTMLElement): Promise<void> {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  await appRoot.requestFullscreen();
  // เบราว์เซอร์ที่ไม่รองรับการล็อกแนวจอจะแจ้งข้อผิดพลาด จอหมุนชวนหมุนยังทำงานแทนได้
  const orientation = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> };
  await orientation.lock?.('landscape').catch(() => undefined);
}

function createRotatePrompt(uiRoot: HTMLElement): void {
  const gio = registry.gio_idle;
  const prompt = document.createElement('div');
  prompt.id = 'rotate-prompt';
  prompt.hidden = true;

  const sprite = document.createElement('div');
  sprite.className = 'rotate-prompt__gio';
  sprite.style.backgroundImage = `url("${import.meta.env.BASE_URL}assets/${gio.file}")`;
  sprite.style.setProperty('--sheet-width', `${gio.frameWidth * gio.frameCount}px`);
  sprite.style.setProperty('--frame-height', `${gio.frameHeight}px`);
  sprite.style.setProperty('--frame-width', `${gio.frameWidth}px`);

  const message = document.createElement('p');
  message.className = 'panel';
  message.textContent = t('orientation.rotate_prompt');

  prompt.append(sprite, message);
  uiRoot.append(prompt);

  eventBus.on('rotation-required-changed', (required) => {
    prompt.hidden = !required;
  });
}

export function createOverlay(uiRoot: HTMLElement, appRoot: HTMLElement): void {
  createTestLine(uiRoot);
  createRotatePrompt(uiRoot);
  createFullscreenButton(uiRoot, appRoot);
}

export function updateRotationRequired(appRoot: HTMLElement): void {
  const isTouchScreen = window.matchMedia('(pointer: coarse)').matches;
  gameState.setRotationRequired(needsRotation(appRoot.clientWidth, appRoot.clientHeight, isTouchScreen));
}
