import { registry } from '../core/assets';
import { eventBus, type RestCause } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type GaugeValues, type World } from '../core/state';
import balance from '../data/balance.json';
import lines from '../data/lines.json';
import { beadFills, isAlert, isDirty, isPulsing, moodOf, type Mood } from '../systems/mood';
import { artUrl, bubbleImage, drawSpeechBubble, pixelDisc, type NineSlice } from './pixelArt';

const REST_MESSAGE: Record<RestCause, TextKey> = {
  sleep: 'rest.sleep',
  passed_out: 'rest.passed_out',
  faint: 'rest.faint',
};

const GAUGES = ['fullness', 'happiness', 'cleanliness'] as const;
const MOODS: Mood[] = ['happy', 'normal', 'tired', 'faint'];
const OUTLINE = '#5c304c';
const MOOD_BACKGROUND: Record<Mood, string> = {
  happy: '#ffdce8',
  normal: '#fff6f0',
  tired: '#f1eeee',
  faint: '#e2eaf6',
};
/** ขนาดเป็นพิกเซลเกม ลูกปัดวางบนจุดเต็มพิกเซลทุกเม็ด */
const DISC_SIZE = 48;
const BEAD_ORBIT = 29;
const BEAD_AREA = 72;
const ARC_START_DEG = -128;
const BEAD_STEP_DEG = 13;
const GAUGE_GAP_DEG = 7;
const BUBBLE_PADDING = 10;
const BUBBLE_BODY_HEIGHT = 13;
const POP_MS = 1000;

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatClock(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.floor((hour - whole) * 60);
  return `${pad(whole % 24)}:${pad(minutes)}`;
}

function createPortrait(uiRoot: HTMLElement): void {
  const portrait = document.createElement('div');
  portrait.id = 'portrait';

  const discs = Object.fromEntries(
    MOODS.map((mood) => {
      const disc = pixelDisc(DISC_SIZE, MOOD_BACKGROUND[mood], OUTLINE);
      disc.className = 'portrait__disc';
      disc.dataset.mood = mood;
      portrait.append(disc);
      return [mood, disc];
    }),
  ) as Record<Mood, HTMLCanvasElement>;

  const face = document.createElement('img');
  face.className = 'portrait__face';
  face.alt = '';
  const effects = document.createElement('div');
  effects.className = 'portrait__effects';
  effects.setAttribute('aria-hidden', 'true');
  for (const name of ['sparkle', 'sparkle', 'sweat', 'dizzy', 'dizzy', 'stink', 'stink', 'fly']) {
    const piece = document.createElement('span');
    piece.className = `fx fx--${name}`;
    effects.append(piece);
  }
  portrait.append(face, effects);

  const center = BEAD_AREA / 2;
  const beads = GAUGES.map((gauge, gaugeIndex) =>
    Array.from({ length: balance.hud.beadsPerGauge }, (_, beadIndex) => {
      const bead = document.createElement('span');
      bead.className = `bead bead--${gauge}`;
      bead.dataset.gauge = gauge;
      const angle =
        ((ARC_START_DEG +
          (gaugeIndex * balance.hud.beadsPerGauge + beadIndex) * BEAD_STEP_DEG +
          gaugeIndex * GAUGE_GAP_DEG) *
          Math.PI) /
        180;
      bead.style.setProperty('--x', String(Math.round(center + Math.sin(angle) * BEAD_ORBIT)));
      bead.style.setProperty('--y', String(Math.round(center - Math.cos(angle) * BEAD_ORBIT)));
      portrait.append(bead);
      return bead;
    }),
  );
  uiRoot.append(portrait);

  // เตรียมภาพทุกหน้าไว้ก่อน ตอนเปลี่ยนหน้าจะได้ไม่กะพริบ
  for (const mood of MOODS) new Image().src = artUrl(`portrait_girl_${mood}`);

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

  eventBus.on('world-changed', (world: World) => {
    const mood = moodOf(world.gauges);
    if (portrait.dataset.mood !== mood) {
      portrait.dataset.mood = mood;
      face.src = artUrl(`portrait_girl_${mood}`);
      for (const candidate of MOODS) discs[candidate].hidden = candidate !== mood;
    }
    portrait.classList.toggle('portrait--dirty', isDirty(world.gauges.cleanliness));
    setBeads(world.gauges);
  });
}

/** ไม่มีเงินบนแถบบน เงินเปลี่ยนเมื่อไหร่ค่อยลอยตัวเลขขึ้นมาบอก */
function createMoneyPop(uiRoot: HTMLElement): void {
  const layer = document.createElement('div');
  layer.id = 'money-pop';
  uiRoot.append(layer);
  let known: { coins: number; stars: number } | null = null;

  const pop = (amount: number, icon: string): void => {
    const number = document.createElement('p');
    const sign = amount > 0 ? '+' : '−';
    number.textContent = `${sign}${Math.abs(amount).toLocaleString('en-US')}${icon}`;
    number.className = amount > 0 ? 'money-pop--in' : 'money-pop--out';
    layer.append(number);
    window.setTimeout(() => number.remove(), POP_MS);
  };

  eventBus.on('game-started', () => {
    known = null;
  });
  eventBus.on('world-changed', ({ wallet }) => {
    if (known) {
      if (wallet.coins !== known.coins) pop(wallet.coins - known.coins, '');
      if (wallet.stars !== known.stars) pop(wallet.stars - known.stars, ' ★');
    }
    known = { coins: wallet.coins, stars: wallet.stars };
  });
}

/** บทพูดตอนเกจต่ำพูดครั้งเดียว จนกว่าเกจจะกลับขึ้นมาแล้วลงใหม่ */
function createLowGaugeBubble(uiRoot: HTMLElement): void {
  const bubble = document.createElement('div');
  bubble.id = 'player-bubble';
  bubble.hidden = true;
  const canvas = document.createElement('canvas');
  const text = document.createElement('p');
  bubble.append(canvas, text);
  uiRoot.append(bubble);

  const entry = registry.ui_speech_bubble;
  const slice: NineSlice = entry?.type === 'local' && entry.nine_slice ? entry.nine_slice : { left: 5, right: 5, top: 5, bottom: 5 };
  const image = bubbleImage('ui_speech_bubble');

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

  const speak = (line: string): void => {
    text.textContent = line;
    bubble.hidden = false;
    hideAt = performance.now() + balance.hud.bubbleMs;
    requestAnimationFrame(follow);
    void image.then((loaded) => {
      const pixel = Number.parseFloat(getComputedStyle(bubble).getPropertyValue('--px')) || 1;
      const width = Math.ceil(text.offsetWidth / pixel) + BUBBLE_PADDING;
      drawSpeechBubble(canvas, loaded, slice, width, BUBBLE_BODY_HEIGHT);
    });
  };

  eventBus.on('world-changed', (world) => {
    for (const gauge of GAUGES) {
      if (!isAlert(world.gauges[gauge])) {
        spoken.delete(gauge);
      } else if (!spoken.has(gauge)) {
        spoken.add(gauge);
        speak(lines.player.lowGauge[gauge]);
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

/** จอสัมผัสไม่มีปุ่ม Shift จึงมีปุ่มวิ่งแบบกดติด กดดับ */
function createRunToggle(uiRoot: HTMLElement): void {
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  const button = document.createElement('button');
  button.id = 'run-button';
  button.type = 'button';
  button.className = 'panel';
  button.textContent = t('ui.run');
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    gameState.setRunToggle(!gameState.runToggle);
    button.setAttribute('aria-pressed', String(gameState.runToggle));
  });
  uiRoot.append(button);
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
  createMoneyPop(uiRoot);
  createLowGaugeBubble(uiRoot);
  createActionControls(uiRoot);
  createRunToggle(uiRoot);
  createRestCurtain(uiRoot);
}
