import { assetUrl, characterEntry } from '../core/assets';
import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState } from '../core/state';
import { needsRotation } from '../core/viewport';
import { createHud } from './hud';
import { createJoystick } from './joystick';
import { createPhone } from './phone';
import { createSaves } from './saves';
import { initSettings } from './settings';

function createRotatePrompt(uiRoot: HTMLElement): void {
  const gio = characterEntry('gio_idle');
  const prompt = document.createElement('div');
  prompt.id = 'rotate-prompt';
  prompt.hidden = true;

  const sprite = document.createElement('div');
  sprite.className = 'rotate-prompt__gio';
  sprite.style.backgroundImage = `url("${assetUrl(gio.file)}")`;
  sprite.style.setProperty('--sheet-width', `${gio.frameWidth * gio.frameCount}px`);
  sprite.style.setProperty('--frame-height', `${gio.frameHeight}px`);
  sprite.style.setProperty('--frame-width', `${gio.frameWidth}px`);

  const message = document.createElement('p');
  message.className = 'panel';
  message.textContent = t('orientation.rotate_prompt');

  const hint = document.createElement('p');
  hint.className = 'panel rotate-prompt__hint';
  hint.textContent = t('orientation.rotate_hint');

  prompt.append(sprite, message, hint);
  uiRoot.append(prompt);

  eventBus.on('rotation-required-changed', (required) => {
    prompt.hidden = !required;
  });
}

export function createOverlay(uiRoot: HTMLElement, appRoot: HTMLElement): void {
  createHud(uiRoot);
  createJoystick(uiRoot);
  createRotatePrompt(uiRoot);
  initSettings(appRoot);
  createPhone(uiRoot);
  createSaves(uiRoot);
}

export function updateRotationRequired(appRoot: HTMLElement): void {
  const isTouchScreen = window.matchMedia('(pointer: coarse)').matches;
  gameState.setRotationRequired(needsRotation(appRoot.clientWidth, appRoot.clientHeight, isTouchScreen));
}
