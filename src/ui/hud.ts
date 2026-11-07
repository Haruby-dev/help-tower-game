import { registry } from '../core/assets';
import { eventBus, type RestCause } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type GaugeValues, type World } from '../core/state';
import balance from '../data/balance.json';
import lines from '../data/lines.json';
import { beadFills, isAlert, isDirty, isPulsing, moodOf, type Mood } from '../systems/mood';
import { artUrl, bubbleImage, drawSpeechBubble, type NineSlice } from './pixelArt';
import { formatMoney } from '../systems/economy';
import { setMoney } from './money';
import { bagArtId, itemName } from './inventory';

const REST_MESSAGE: Record<RestCause, TextKey> = {
  sleep: 'rest.sleep',
  passed_out: 'rest.passed_out',
  faint: 'rest.faint',
};

const GAUGES = ['fullness', 'happiness', 'cleanliness'] as const;
const MOODS: Mood[] = ['happy', 'normal', 'tired', 'faint'];
/** สีพื้นในกรอบตามอารมณ์ ร่าเริงใช้สีชมพูของกรอบเอง */
const MOOD_BACKGROUND: Record<Mood, string | null> = {
  happy: null,
  normal: '#fff6f0',
  tired: '#f1eeee',
  faint: '#e2eaf6',
};
/** ขนาดเป็นพิกเซลเกม ลูกปัดวางบนจุดเต็มพิกเซลทุกเม็ด */
const BEAD_ORBIT = 29;
const BEAD_AREA = 72;
const ARC_START_DEG = -128;
const BEAD_STEP_DEG = 13;
const GAUGE_GAP_DEG = 7;
const BUBBLE_PADDING = 10;
const BUBBLE_BODY_HEIGHT = 13;
const POP_MS = 1000;
const ACTION_FRAME = 48;

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatClock(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.floor((hour - whole) * 60);
  return `${pad(whole % 24)}:${pad(minutes)}`;
}

function createPortrait(uiRoot: HTMLElement): void {
  const portrait = document.createElement('div');
  portrait.id = 'portrait';

  // กรอบเหรียญ 46×46 ขนาดและตำแหน่งเดียวกับกรอบเดิม หน้าถูกตัดด้วยหน้ากากวงใน ไม่ทับลูกปัดเกจ
  const frame = document.createElement('img');
  frame.className = 'portrait__frame';
  frame.alt = '';
  frame.src = artUrl('ui_portrait_frame');
  const inner = document.createElement('div');
  inner.className = 'portrait__inner';
  const mask = `url("${artUrl('ui_portrait_mask')}")`;
  inner.style.setProperty('mask-image', mask);
  inner.style.setProperty('-webkit-mask-image', mask);
  const tint = document.createElement('div');
  tint.className = 'portrait__tint';
  const face = document.createElement('img');
  face.className = 'portrait__face';
  face.alt = '';
  inner.append(tint, face);
  portrait.append(frame, inner);
  const effects = document.createElement('div');
  effects.className = 'portrait__effects';
  effects.setAttribute('aria-hidden', 'true');
  for (const name of ['sparkle', 'sparkle', 'sweat', 'dizzy', 'dizzy', 'stink', 'stink', 'fly']) {
    const piece = document.createElement('span');
    piece.className = `fx fx--${name}`;
    effects.append(piece);
  }
  portrait.append(effects);

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
      const background = MOOD_BACKGROUND[mood];
      tint.hidden = background === null;
      if (background) tint.style.background = background;
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
    if (icon) number.textContent = `${sign}${formatMoney(Math.abs(amount))}${icon}`;
    else setMoney(number, Math.abs(amount), sign);
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

  eventBus.on('player-says', (line) => speak(lines.player[line]));

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

/** ไอคอนวางกลางกรอบ 48×48 ปัดเศษขึ้นแบบภาพตัวอย่างที่ฝั่งวางแผนทำ */
function centredIcon(icon: HTMLImageElement, id: string): void {
  const entry = registry[id];
  // ไอคอนที่ยังไม่มีภาพ (เช่น คุย) ใช้กล่องสีแทนตามกฎทะเบียน
  icon.hidden = entry?.type !== 'local';
  icon.parentElement?.toggleAttribute('data-missing-icon', icon.hidden);
  if (entry?.type !== 'local') return;
  icon.src = artUrl(id);
  icon.style.setProperty('--w', String(entry.width));
  icon.style.setProperty('--h', String(entry.height));
  icon.style.setProperty('--x', String(Math.ceil((ACTION_FRAME - entry.width) / 2)));
  icon.style.setProperty('--y', String(Math.ceil((ACTION_FRAME - entry.height) / 2)));
}

/** ปุ่มกระทำปุ่มเดียวข้างปุ่มวิ่ง ไอคอนเปลี่ยนตามจุดที่ยืนและของที่ถือ ไม่มีป้ายใต้ปุ่ม (ผู้ใช้ตัดสิน 4 พ.ย. 2026) ไม่มีอะไรทำก็ซ่อน */
function createActionControls(uiRoot: HTMLElement): void {
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const button = document.createElement('button');
  button.id = 'action-button';
  button.type = 'button';
  button.hidden = true;
  button.dataset.withRun = String(isTouch);
  const frame = document.createElement('img');
  frame.className = 'action-button__frame';
  frame.alt = '';
  frame.src = artUrl('ui_action_frame');
  const pressed = document.createElement('img');
  pressed.className = 'action-button__frame action-button__frame--pressed';
  pressed.alt = '';
  pressed.src = artUrl('ui_action_frame_pressed');
  const icon = document.createElement('img');
  icon.className = 'action-button__icon';
  icon.alt = '';
  // ป้าย "กิน" ใต้ปุ่มเฉพาะตอนเลือกอาหารในแถบอาหาร (ภาพตัวอย่าง eat_swap_B) ท่าอื่นยังไม่มีป้ายตามเดิม
  const eatLabel = document.createElement('span');
  eatLabel.className = 'action-button__label';
  eatLabel.textContent = t('action.eat');
  button.append(frame, pressed, icon);
  if (!isTouch) {
    const key = document.createElement('span');
    key.className = 'action-button__key';
    key.textContent = 'E';
    button.append(key);
  }
  button.addEventListener('click', () => eventBus.emit('action-pressed', undefined));
  uiRoot.append(button);

  /** ปุ่มกินแสดงภาพอาหารที่เลือก (ภาพในกระเป๋าขนาดจริง) */
  const showFood = (): void => {
    const food = gameState.selectedFood;
    const art = food ? bagArtId(food) : null;
    centredIcon(icon, art ?? 'ui_action_icon_cook');
    button.setAttribute('aria-label', food ? `${t('action.eat')} ${itemName(food)}` : t('action.eat'));
  };
  eventBus.on('action-changed', (action) => {
    button.hidden = action === null;
    if (!action) return;
    button.dataset.icon = action.icon;
    button.dataset.action = action.label;
    if (action.icon === 'eat') button.append(eatLabel);
    else eatLabel.remove();
    if (action.icon === 'eat') {
      showFood();
      return;
    }
    centredIcon(icon, `ui_action_icon_${action.icon}`);
    button.setAttribute('aria-label', t(action.label));
  });
  eventBus.on('food-changed', () => {
    if (button.dataset.icon === 'eat') showFood();
  });
}

/** กดค้างแล้ววิ่ง ปล่อยแล้วเดิน ใช้ pointerdown เพราะ iPhone ไม่ส่ง click ตอนอีกนิ้วลากจอยอยู่ */
function createRunToggle(uiRoot: HTMLElement): void {
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  const button = document.createElement('button');
  button.id = 'run-button';
  button.type = 'button';
  button.setAttribute('aria-label', t('ui.run'));
  button.setAttribute('aria-pressed', 'false');
  const image = document.createElement('img');
  image.alt = '';
  image.src = artUrl('ui_run_button_off');
  button.append(image);
  const setHeld = (held: boolean): void => {
    gameState.setRunHeld(held);
    button.setAttribute('aria-pressed', String(held));
    image.src = artUrl(held ? 'ui_run_button_on' : 'ui_run_button_off');
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setHeld(true);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, () => setHeld(false));
  }
  // กดค้างบน iPhone จะเด้งเมนูของระบบถ้าไม่กันไว้
  button.addEventListener('contextmenu', (event) => event.preventDefault());
  eventBus.on('rotation-required-changed', (required) => {
    if (required) setHeld(false);
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
