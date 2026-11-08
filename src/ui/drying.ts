import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState } from '../core/state';
import { firstStock, haveFor } from '../systems/cooking';
import { maxDrying, startDrying, stationTable } from '../systems/stations';
import { bagArtId, itemName } from './inventory';
import { sizedArt } from './pixelArt';
import { revealWhenReady } from './preload';

/**
 * หน้าเลือกของตากที่ถาดตาก (งานอาหารโซน 1 ขั้นที่ 5 · ภาพตัวอย่าง art-src/cook_ui_1108/dry_1108/dry_popup.png)
 * ซ้ายเลือกของ 4 อย่าง ขวาดูถาดพร้อมของ − n + แล้วกดตาก · ขนาดเป็นพิกเซลภาพตัวอย่าง ย่อขยายด้วย --pz เหมือนหน้าต่างทำอาหาร
 */
const WINDOW = 'drying';
/** ภาพจิ๋วบนถาดในหน้าต่าง (พิกเซลภาพจากมุมซ้ายบนของถาด 48 พิกเซล) 1–3 ชิ้นตามจำนวน */
const TRAY_MINIS = [
  { x: 10, y: 10 },
  { x: 24, y: 10 },
  { x: 17, y: 15 },
];
const MINI_STEPS = [1, 4, 7];

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function iconOf(item: string, className: string, unit = '--px'): HTMLElement {
  const art = bagArtId(item);
  if (art && registry[art]?.type === 'local') return sizedArt(art, className, unit);
  return element('i', `${className} dy-none`, itemName(item));
}

export function createDryingWindow(uiRoot: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'drying-window';
  backdrop.hidden = true;
  const panel = element('div', 'ck dy');
  const head = sizedArt('drying_tray', 'dy-head', '--px2');
  const title = element('h2', 'dy-title', t('drying.title'));
  const sub = element('span', 'dy-sub', t('drying.sub'));
  const close = element('button', 'ck-button ck-close dy-close', '×');
  close.id = 'drying-close';
  close.type = 'button';
  close.setAttribute('aria-label', t('ui.close'));
  const list = element('div', 'dy-list');
  const preview = element('div', 'dy-preview');
  panel.append(head, title, sub, close, list, preview);
  backdrop.append(panel);
  uiRoot.append(backdrop);

  let tray = 0;
  let selected = Object.keys(stationTable.drying.recipes)[0]!;
  let count = 1;

  const hide = (): void => {
    backdrop.hidden = true;
    gameState.setWindowOpen(WINDOW, false);
  };

  const row = (id: string): HTMLElement => {
    const info = stationTable.drying.recipes[id]!;
    const box = element('button', `dy-row${id === selected ? ' is-selected' : ''}`);
    box.type = 'button';
    box.dataset.dry = id;
    const icons = element('span', 'dy-row__icons');
    for (const item of Object.keys(info.in)) icons.append(iconOf(firstStock(gameState.world.bag, item), 'dy-row__art'));
    icons.append(element('b', 'dy-row__arrow', '→'), iconOf(info.out, 'dy-row__art'));
    const names = Object.keys(info.in).map((item) => itemName(item));
    const label = element('b', 'dy-row__label', `${names.join(' + ')} → ${itemName(info.out)}`);
    const have = element('small', 'dy-row__have', `${t('drying.have')}${Object.keys(info.in).map((item) => `${itemName(item)} ${haveFor(gameState.world.bag, item)}`).join(' · ')}`);
    box.append(icons, label, have);
    box.addEventListener('click', () => {
      selected = id;
      count = 1;
      render();
    });
    return box;
  };

  const renderPreview = (): void => {
    const info = stationTable.drying.recipes[selected]!;
    const most = maxDrying(gameState.world, selected);
    count = Math.min(Math.max(1, count), Math.max(1, most));
    const stage = element('div', 'dy-tray');
    stage.append(sizedArt('drying_tray', 'dy-tray__art', '--dpx'));
    const first = firstStock(gameState.world.bag, Object.keys(info.in)[0]!);
    const mini = `ing_mini_${first.toLowerCase()}`;
    if (most > 0 && registry[mini]?.type === 'local') {
      MINI_STEPS.filter((from) => count >= from).forEach((_, at) => {
        const piece = sizedArt(mini, 'dy-tray__mini', '--dpx');
        piece.style.left = `calc(var(--dpx) * ${TRAY_MINIS[at]!.x})`;
        piece.style.top = `calc(var(--dpx) * ${TRAY_MINIS[at]!.y})`;
        stage.append(piece);
      });
    }
    const caption = element('b', 'dy-caption', `${t('drying.pick')}${itemName(Object.keys(info.in)[0]!)} ×${count}`);
    const step = (text: string, id: string, delta: number, disabled: boolean): HTMLButtonElement => {
      const button = element('button', 'ck-button dy-step', text);
      button.id = id;
      button.type = 'button';
      button.disabled = disabled;
      button.addEventListener('click', () => {
        count = Math.min(Math.max(1, count + delta), most);
        renderPreview();
      });
      return button;
    };
    const number = element('b', 'dy-count', String(count));
    number.id = 'drying-count';
    const infoText = element('p', 'dy-info', `${t('drying.info')}${itemName(info.out)} ${count}`);
    const go = element('button', 'ck-go dy-go', t('drying.go'));
    go.id = 'drying-go';
    go.type = 'button';
    go.disabled = most < 1;
    go.addEventListener('click', () => {
      const next = startDrying(gameState.world, tray, selected, count);
      if (!next) return;
      gameState.setWorld(next);
      hide();
    });
    preview.replaceChildren(stage, caption, step('−', 'drying-less', -1, most < 1 || count <= 1), number, step('+', 'drying-more', 1, most < 1 || count >= most), infoText, go);
  };

  function render(): void {
    list.replaceChildren(...Object.keys(stationTable.drying.recipes).map(row));
    renderPreview();
  }

  close.addEventListener('click', hide);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) hide();
  });
  eventBus.on('drying-open', (index) => {
    tray = index;
    count = 1;
    // เลือกของที่มีพอตากก่อน
    selected = Object.keys(stationTable.drying.recipes).find((id) => maxDrying(gameState.world, id) > 0) ?? Object.keys(stationTable.drying.recipes)[0]!;
    render();
    backdrop.hidden = false;
    revealWhenReady(backdrop);
    gameState.setWindowOpen(WINDOW, true);
  });
}

