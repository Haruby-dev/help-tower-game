import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState } from '../core/state';
import { artUrl, sizedArt } from './pixelArt';
import { revealWhenReady } from './preload';

/** สมุดตระกูลเดียวกัน (สมุดสูตร v4 ย้อมสีต่อแอป) สีปก ขอบกระดาษ และเงาสันต่างกัน */
export type BookTheme = 'recipe' | 'album' | 'pets' | 'gate' | 'mail';

export interface BookPieces {
  cloth: string;
  frame: string;
  ribbon: string;
}

export interface Book {
  root: HTMLElement;
  /** เนื้อหาหน้าซ้ายและขวา (หน้า 297×268 พิกเซลภาพ) */
  left: HTMLElement;
  right: HTMLElement;
  pages: [HTMLElement, HTMLElement];
  show: () => void;
  hide: () => void;
  isOpen: () => boolean;
  /** เปลี่ยนชุดภาพหน้า (สมุดสูตรเปลี่ยนสีตามแท็บ) */
  setPieces: (pieces: BookPieces) => void;
}

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** วางตำแหน่งเป็นพิกเซลของหน้า (หน้าละ 297×268) */
export function at<T extends HTMLElement>(node: T, x: number, y: number): T {
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  return node;
}

/** ภาพขนาดจริงบนหน้า วางที่พิกเซล (x, y) · flip กลับด้านแนวนอนหรือแนวตั้ง */
export function pageArt(id: string, x: number, y: number, className = '', flip = '', scale = 1): HTMLImageElement {
  const image = at(sizedArt(id, `bk-px ${className}`, '--px', scale), x, y);
  if (flip) image.style.transform = flip;
  return image;
}

/**
 * สมุดสองหน้าบนเกมที่มืดลง (recipe_book_spread2 และตระกูลเดียวกัน): ปก กองกระดาษ เงาสัน ริบบิ้นลายสก็อตสี่มุมนอก ปุ่ม ✕ นอกปก
 * ทุกขนาดเป็นพิกเซลภาพตัวอย่าง แล้วย่อขยายทั้งก้อนด้วย --bz หน้าในวาดที่ 1 หน่วยต่อพิกเซลภาพ (zoom 3)
 */
export function createBook(uiRoot: HTMLElement, id: string, theme: BookTheme, windowName: string, pieces: BookPieces): Book {
  const backdrop = element('div', 'bk-backdrop');
  backdrop.id = id;
  backdrop.hidden = true;
  const book = element('div', 'bk');
  book.dataset.theme = theme;
  const spread = element('div', 'bk-spread');
  const makePage = (side: 'l' | 'r'): { page: HTMLElement; content: HTMLElement; ribbons: HTMLImageElement[] } => {
    const page = element('div', `bk-pg bk-pg--${side}`);
    const frame = element('i', 'bk-frame');
    const ribbons = side === 'l' ? [pageArt(pieces.ribbon, 5, 5, 'bk-rib', 'scaleX(-1)'), pageArt(pieces.ribbon, 5, 219, 'bk-rib', 'scale(-1, -1)')] : [pageArt(pieces.ribbon, 248, 5, 'bk-rib'), pageArt(pieces.ribbon, 248, 219, 'bk-rib', 'scaleY(-1)')];
    const content = element('div', 'bk-content');
    page.append(frame, ...ribbons, content);
    return { page, content, ribbons };
  };
  const left = makePage('l');
  const right = makePage('r');
  spread.append(left.page, right.page);
  const close = element('button', 'bk-close', '✕');
  close.type = 'button';
  close.id = `${id}-close`;
  close.setAttribute('aria-label', t('ui.close'));
  book.append(element('i', 'bk-cover'), at(element('i', 'bk-stack'), 26, 26), at(element('i', 'bk-stack'), 917, 26), spread, element('i', 'bk-gutter'), close);
  backdrop.append(book);
  uiRoot.append(backdrop);

  const setPieces = (next: BookPieces): void => {
    for (const { page, ribbons } of [left, right]) {
      page.style.setProperty('--cloth', `url("${artUrl(next.cloth)}")`);
      page.style.setProperty('--frame', `url("${artUrl(next.frame)}")`);
      for (const ribbon of ribbons) ribbon.src = artUrl(next.ribbon);
    }
  };
  setPieces(pieces);

  const hide = (): void => {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    gameState.setWindowOpen(windowName, false);
    eventBus.emit('app-closed', windowName);
  };
  const show = (): void => {
    backdrop.hidden = false;
    revealWhenReady(backdrop);
    gameState.setWindowOpen(windowName, true);
  };
  close.addEventListener('click', hide);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (backdrop.hidden || event.key !== 'Escape') return;
    // Esc ปิดแค่สมุดหรือการ์ดนี้ โทรศัพท์ที่เปิดค้างไว้จะกลับมาที่หน้าหลัก ไม่ปิดตามไปด้วย
    event.stopImmediatePropagation();
    hide();
  });
  return { root: backdrop, left: left.content, right: right.content, pages: [left.page, right.page], show, hide, isOpen: () => !backdrop.hidden, setPieces };
}

/** แท็บกระดาษบนหน้าซ้าย (9-slice ขอบ 5) */
export function bookTab(label: string, active: boolean, tab: string, active9: string): HTMLButtonElement {
  const button = element('button', `bk-tab${active ? ' is-active' : ''}`, label);
  button.type = 'button';
  button.style.borderImageSource = `url("${artUrl(active ? active9 : tab)}")`;
  return button;
}

/** โน้ตกระดาษแปะเทป (book_note_9slice) */
export function bookNote(className: string, text: string, tape: string, x: number, y: number): HTMLElement {
  const note = at(element('div', `bk-note ${className}`), x, y);
  note.style.borderImageSource = `url("${artUrl('ui_book_book_note_9slice')}")`;
  note.append(pageArt(tape, -8, -6, 'bk-note__tape'), document.createTextNode(text));
  return note;
}

/** ปุ่มลูกศรเปลี่ยนหน้า (ภาพ 12×13) */
export function bookArrow(id: string, art: string, label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const button = element('button', 'bk-arrow');
  button.type = 'button';
  button.id = id;
  button.disabled = disabled;
  button.setAttribute('aria-label', label);
  button.append(sizedArt(art, 'bk-arrow__art'));
  button.addEventListener('click', onClick);
  return button;
}

export interface Card {
  root: HTMLElement;
  body: HTMLElement;
  fill: (children: HTMLElement[]) => void;
  show: () => void;
  hide: () => void;
}

/**
 * การ์ดใบเดียวบนเกมที่มืดลง (support_card · settings_card) ผ้าลายชมพูแบบอัลบั้ม ริบบิ้นสองมุมบน ปุ่ม ✕ นอกการ์ด
 * ขนาดการ์ดกำหนดใน CSS ตามชื่อคลาส เป็นพิกเซลภาพ
 */
export function createCard(uiRoot: HTMLElement, id: string, className: string, windowName: string): Card {
  const backdrop = element('div', 'bk-backdrop cd-backdrop');
  backdrop.hidden = true;
  const wrap = element('div', 'cd-wrap');
  const card = element('div', `cd ${className}`);
  card.id = id;
  card.setAttribute('role', 'dialog');
  card.style.setProperty('--cloth', `url("${artUrl('book_album_cloth')}")`);
  card.style.setProperty('--frame', `url("${artUrl('book_album_frame_9slice')}")`);
  const content = element('div', 'cd-content');
  const right = pageArt('book_album_ribbon', 0, 5, 'bk-rib cd-rib--r');
  card.append(element('i', 'bk-frame'), pageArt('book_album_ribbon', 5, 5, 'bk-rib', 'scaleX(-1)'), right, content);
  const close = element('button', 'bk-close cd-close', '✕');
  close.type = 'button';
  close.id = id === 'settings-window' ? 'settings-close' : `${id}-close`;
  close.setAttribute('aria-label', t('ui.close'));
  wrap.append(card, close);
  backdrop.append(wrap);
  uiRoot.append(backdrop);
  const hide = (): void => {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    gameState.setWindowOpen(windowName, false);
    eventBus.emit('app-closed', windowName);
  };
  const show = (): void => {
    backdrop.hidden = false;
    revealWhenReady(backdrop);
    gameState.setWindowOpen(windowName, true);
  };
  close.addEventListener('click', hide);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (backdrop.hidden || event.key !== 'Escape') return;
    // Esc ปิดแค่สมุดหรือการ์ดนี้ โทรศัพท์ที่เปิดค้างไว้จะกลับมาที่หน้าหลัก ไม่ปิดตามไปด้วย
    event.stopImmediatePropagation();
    hide();
  });
  return { root: backdrop, body: card, fill: (children) => content.replaceChildren(...children), show, hide };
}
