import { eventBus, type RestCause } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type World } from '../core/state';
import balance from '../data/balance.json';

const REST_MESSAGE: Record<RestCause, TextKey> = {
  sleep: 'rest.sleep',
  passed_out: 'rest.passed_out',
  faint: 'rest.faint',
};

const GAUGES = [
  { key: 'fullness', label: 'gauge.fullness', className: 'gauge--fullness' },
  { key: 'happiness', label: 'gauge.happiness', className: 'gauge--happiness' },
  { key: 'cleanliness', label: 'gauge.cleanliness', className: 'gauge--cleanliness' },
] as const;

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatClock(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.floor((hour - whole) * 60);
  return `${pad(whole % 24)}:${pad(minutes)}`;
}

function createStatusPanel(uiRoot: HTMLElement): void {
  const panel = document.createElement('div');
  panel.id = 'status-panel';
  panel.className = 'panel';

  const clock = document.createElement('p');
  clock.id = 'status-clock';
  panel.append(clock);

  const fills = GAUGES.map((gauge) => {
    const row = document.createElement('div');
    row.className = `gauge ${gauge.className}`;
    row.dataset.gauge = gauge.key;
    // กล่องสีแทนไอคอนจนกว่าภาพจริงจะมา
    const icon = document.createElement('span');
    icon.className = 'gauge__icon';
    const name = document.createElement('span');
    name.className = 'gauge__label';
    name.textContent = t(gauge.label);
    const bar = document.createElement('span');
    bar.className = 'gauge__bar';
    const fill = document.createElement('span');
    fill.className = 'gauge__fill';
    bar.append(fill);
    row.append(icon, name, bar);
    panel.append(row);
    return { key: gauge.key, fill };
  });
  uiRoot.append(panel);

  const show = (world: World): void => {
    clock.textContent = `${t('hud.day')} ${world.day} · ${formatClock(world.hour)}`;
    for (const { key, fill } of fills) {
      const share = (world.gauges[key] / balance.gauges.max) * 100;
      fill.style.width = `${share}%`;
    }
  };
  eventBus.on('world-changed', show);
}

function createActionControls(uiRoot: HTMLElement): void {
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const button = document.createElement('button');
  button.id = 'action-button';
  button.type = 'button';
  button.className = 'panel';
  button.hidden = true;
  button.addEventListener('click', () => eventBus.emit('action-pressed', undefined));
  uiRoot.append(button);

  eventBus.on('action-changed', (action) => {
    button.hidden = action === null;
    if (action) button.textContent = isTouch ? t(action) : `E · ${t(action)}`;
  });
}

function createRestCurtain(uiRoot: HTMLElement): void {
  const curtain = document.createElement('div');
  curtain.id = 'rest-curtain';
  curtain.hidden = true;
  const message = document.createElement('p');
  curtain.append(message);
  uiRoot.append(curtain);

  eventBus.on('rest-finished', ({ cause, day }) => {
    message.textContent = `${t(REST_MESSAGE[cause])} ${t('hud.day')} ${day}`;
    curtain.hidden = false;
    gameState.setWindowOpen('rest', true);
    window.setTimeout(() => {
      curtain.hidden = true;
      gameState.setWindowOpen('rest', false);
    }, balance.time.restCurtainMs);
  });
}

export function createHud(uiRoot: HTMLElement): void {
  createStatusPanel(uiRoot);
  createActionControls(uiRoot);
  createRestCurtain(uiRoot);
}
