import { assetUrl } from '../core/assets';
import { eventBus, type RestCause } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type GaugeValues, type World } from '../core/state';
import balance from '../data/balance.json';
import lines from '../data/lines.json';
import { beadFills, isAlert, isDirty, isPulsing, moodOf, type Mood } from '../systems/mood';

const REST_MESSAGE: Record<RestCause, TextKey> = {
  sleep: 'rest.sleep',
  passed_out: 'rest.passed_out',
  faint: 'rest.faint',
};

const GAUGES = ['fullness', 'happiness', 'cleanliness'] as const;
const MOODS: Mood[] = ['happy', 'normal', 'tired', 'faint'];
/** มุมของลูกปัด นับจากด้านบนตามเข็ม เว้นช่องเล็ก ๆ ระหว่างเกจ */
const ARC_START_DEG = -128;
const BEAD_STEP_DEG = 13;
const GAUGE_GAP_DEG = 7;

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatClock(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.floor((hour - whole) * 60);
  return `${pad(whole % 24)}:${pad(minutes)}`;
}

function createPortrait(uiRoot: HTMLElement): void {
  const portrait = document.createElement('div');
  portrait.id = 'portrait';

  const disc = document.createElement('div');
  disc.className = 'portrait__disc';
  const face = document.createElement('img');
  face.className = 'portrait__face';
  face.alt = '';
  disc.append(face);
  const effects = document.createElement('div');
  effects.className = 'portrait__effects';
  effects.setAttribute('aria-hidden', 'true');
  for (const name of ['sparkle', 'sparkle', 'sweat', 'dizzy', 'dizzy', 'stink', 'stink', 'fly']) {
    const piece = document.createElement('span');
    piece.className = `fx fx--${name}`;
    effects.append(piece);
  }
  portrait.append(disc, effects);

  const beads = GAUGES.map((gauge, gaugeIndex) =>
    Array.from({ length: balance.hud.beadsPerGauge }, (_, beadIndex) => {
      const bead = document.createElement('span');
      bead.className = `bead bead--${gauge}`;
      bead.dataset.gauge = gauge;
      const angle =
        ARC_START_DEG +
        (gaugeIndex * balance.hud.beadsPerGauge + beadIndex) * BEAD_STEP_DEG +
        gaugeIndex * GAUGE_GAP_DEG;
      bead.style.setProperty('--angle', `${angle}deg`);
      portrait.append(bead);
      return bead;
    }),
  );
  uiRoot.append(portrait);

  // เตรียมภาพทุกหน้าไว้ก่อน ตอนเปลี่ยนหน้าจะได้ไม่กะพริบ
  for (const mood of MOODS) new Image().src = assetUrl(`portraits/portrait_girl_${mood}.png`);

  const setBeads = (values: GaugeValues): void => {
    GAUGES.forEach((gauge, gaugeIndex) => {
      const value = values[gauge];
      const fills = beadFills(value);
      const lastLit = fills.reduce<number>((last, fill, index) => (fill > 0 ? index : last), 0);
      beads[gaugeIndex]!.forEach((bead, index) => {
        bead.dataset.fill = String(fills[index]);
        bead.classList.toggle('bead--alert', isAlert(value));
        bead.classList.toggle('bead--pulse', isPulsing(value) && index === lastLit);
      });
    });
  };

  const show = (world: World): void => {
    const mood = moodOf(world.gauges);
    if (portrait.dataset.mood !== mood) {
      portrait.dataset.mood = mood;
      face.src = assetUrl(`portraits/portrait_girl_${mood}.png`);
    }
    portrait.classList.toggle('portrait--dirty', isDirty(world.gauges.cleanliness));
    setBeads(world.gauges);
  };
  eventBus.on('world-changed', show);

  const applyScale = (zoom: number): void => {
    // จุดพิกเซลของรูปหน้าเท่ากับโลกเกม จึงยังคมและเป็นจำนวนเต็มบนจอจริง
    portrait.style.setProperty('--hud-pixel', `${zoom / window.devicePixelRatio}px`);
  };
  eventBus.on('viewport-changed', (viewport) => applyScale(viewport.zoom));
}

function createCoinPill(uiRoot: HTMLElement): void {
  const pill = document.createElement('p');
  pill.id = 'coin-pill';
  pill.className = 'panel';
  uiRoot.append(pill);
  eventBus.on('world-changed', (world) => {
    pill.textContent = `${world.wallet.coins.toLocaleString('en-US')} ${t('wallet.coins')}`;
  });
}

/** บทพูดตอนเกจต่ำพูดครั้งเดียว จนกว่าเกจจะกลับขึ้นมาแล้วลงใหม่ */
function createLowGaugeBubble(uiRoot: HTMLElement): void {
  const bubble = document.createElement('p');
  bubble.id = 'player-bubble';
  bubble.hidden = true;
  uiRoot.append(bubble);

  const spoken = new Set<string>();
  let hideAt = 0;
  const follow = (): void => {
    if (performance.now() > hideAt) {
      bubble.hidden = true;
      return;
    }
    const { x, y } = gameState.playerScreen;
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    requestAnimationFrame(follow);
  };

  eventBus.on('world-changed', (world) => {
    for (const gauge of GAUGES) {
      if (!isAlert(world.gauges[gauge])) {
        spoken.delete(gauge);
      } else if (!spoken.has(gauge)) {
        spoken.add(gauge);
        bubble.textContent = lines.player.lowGauge[gauge];
        bubble.hidden = false;
        hideAt = performance.now() + balance.hud.bubbleMs;
        requestAnimationFrame(follow);
      }
    }
  });
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
  createPortrait(uiRoot);
  createCoinPill(uiRoot);
  createLowGaugeBubble(uiRoot);
  createActionControls(uiRoot);
  createRestCurtain(uiRoot);
}
