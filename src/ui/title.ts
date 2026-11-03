import { t } from '../core/i18n';
import { createRng } from '../core/rng';
import layout from '../../public/assets/ui/title/v4/title_layout.json';
import { artUrl } from './pixelArt';

const TWINKLE_MS = 400;
const TWINKLE_WAIT_MIN_MS = 1500;
const TWINKLE_WAIT_MAX_MS = 4000;
/** โลโก้แบบนิ่งเตี้ยกว่าแบบขยับ 3 พิกเซล จึงวางต่ำลงให้ฐานตรงกัน */
const STATIC_LOGO_DROP = 3;
const rng = createRng(Date.now());

export interface TitleChoice {
  onStart: () => void;
  onLoad: () => void;
}

/** ทุกตำแหน่งนับเป็นพิกเซลของฉาก 640×360 แล้วคูณ --tpx */
function place(node: HTMLElement, x: number, y: number): HTMLElement {
  node.style.left = `calc(var(--tpx) * ${x})`;
  node.style.top = `calc(var(--tpx) * ${y})`;
  return node;
}

function picture(className: string, id: string, width: number, height: number): HTMLElement {
  const node = document.createElement('i');
  node.className = `title-sprite ${className}`;
  node.style.backgroundImage = `url("${artUrl(id)}")`;
  node.style.width = `calc(var(--tpx) * ${width})`;
  node.style.height = `calc(var(--tpx) * ${height})`;
  return node;
}

function button(id: string, art: string, label: string, spec: typeof layout.btn_start, onPress: () => void): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.id = id;
  node.className = 'title-button';
  node.setAttribute('aria-label', label);
  node.style.setProperty('--frame-w', String(spec.frame_w));
  node.style.width = `calc(var(--tpx) * ${spec.hit[2]})`;
  node.style.height = `calc(var(--tpx) * ${spec.hit[3]})`;
  const face = picture('title-button__face', art, spec.frame_w, spec.frame_h);
  face.style.backgroundSize = `calc(var(--tpx) * ${spec.frame_w * spec.states.length}) 100%`;
  node.append(face);
  node.addEventListener('click', onPress);
  return place(node, spec.x, spec.y) as HTMLButtonElement;
}

/** ประกายเล่นครั้งเดียวแล้วพักแบบสุ่ม แต่ละดวงไม่พร้อมกัน */
function twinkle(node: HTMLElement): void {
  const wait = rng.between(TWINKLE_WAIT_MIN_MS, TWINKLE_WAIT_MAX_MS);
  window.setTimeout(() => {
    if (!node.isConnected) return;
    node.classList.remove('is-playing');
    void node.offsetWidth;
    node.classList.add('is-playing');
    window.setTimeout(() => twinkle(node), TWINKLE_MS);
  }, wait);
}

/** หน้าเริ่มเกม v4 พื้นขาว ป้ายไม้ลอยเบา ๆ กับปุ่ม 2 ปุ่มที่อยู่นิ่ง */
export function showTitle(uiRoot: HTMLElement, choice: TitleChoice): () => void {
  const screen = document.createElement('div');
  screen.id = 'title-screen';
  const stage = document.createElement('div');
  stage.className = 'title-stage';
  const sign = document.createElement('div');
  sign.className = 'title-sign';
  screen.append(stage);
  stage.append(sign);

  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { board, logo, tagline, twinkles } = layout;
  const boardImage = place(picture('title-board', 'title_v4_board', 520, 197), board.x, board.y);
  const logoImage = calm
    ? place(picture('title-logo', 'title_logo', logo.frame_w, logo.frame_h - STATIC_LOGO_DROP), logo.x, logo.y + STATIC_LOGO_DROP)
    : place(picture('title-logo is-moving', 'title_logo_8f', logo.frame_w, logo.frame_h), logo.x, logo.y);
  if (!calm) {
    logoImage.style.setProperty('--sheet', `calc(var(--tpx) * ${logo.frame_w * logo.frames})`);
    logoImage.style.animationDuration = `${logo.frames / logo.fps}s`;
  }
  logoImage.setAttribute('role', 'img');
  logoImage.setAttribute('aria-label', t('game.title'));
  const taglineImage = place(picture('title-tagline', 'title_v4_tagline', 333, 33), tagline.x, tagline.y);
  taglineImage.setAttribute('role', 'img');
  taglineImage.setAttribute('aria-label', t('game.subtitle'));
  sign.append(boardImage, logoImage, taglineImage);
  if (!calm) {
    const half = Math.floor(twinkles.frame_w / 2);
    for (const [cx, cy] of twinkles.centers_in_board) {
      const star = place(picture('title-twinkle', 'title_v4_twinkle', twinkles.frame_w, twinkles.frame_w), board.x + cx! - half, board.y + cy! - half);
      star.style.backgroundSize = `calc(var(--tpx) * ${twinkles.frame_w * twinkles.frames}) 100%`;
      sign.append(star);
      twinkle(star);
    }
  }

  stage.append(
    button('title-start', 'title_v4_btn_start', t('title.start'), layout.btn_start, choice.onStart),
    button('title-load', 'title_v4_btn_load', t('title.load'), layout.btn_load, choice.onLoad),
  );
  uiRoot.append(screen);

  // ป้าย โลโก้ คำโปรย และประกาย ขยับพร้อมกันทีละพิกเซลเต็ม ปุ่มอยู่นิ่ง
  let frame = 0;
  const { amp_px: amp, period_s: period } = layout.board_group;
  const bob = (now: number): void => {
    const offset = Math.round(amp * Math.sin((2 * Math.PI * now) / 1000 / period));
    sign.style.transform = `translateY(calc(var(--tpx) * ${offset}))`;
    frame = requestAnimationFrame(bob);
  };
  if (!calm) frame = requestAnimationFrame(bob);

  return () => {
    cancelAnimationFrame(frame);
    screen.remove();
  };
}
