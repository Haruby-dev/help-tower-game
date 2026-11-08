import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState } from '../core/state';
import { needsBigTable, parseSet, putOnBigTable, setTable, takeFromBigTable } from '../systems/sets';
import { itemName, setImage } from './inventory';
import { sizedArt } from './pixelArt';
import { revealWhenReady } from './preload';
import { uiSound } from './sound';

/**
 * หน้าต่างโต๊ะใหญ่ (งานอาหารโซน 1 ขั้นที่ 6 · สเปก 6.4) ยังไม่มีภาพตัวอย่าง ใช้กรอบเดียวกับหน้าเลือกของตาก
 * ซ้ายชุดถาดกลางกับถาดใหญ่ในกระเป๋า ขวาโต๊ะพร้อมชุดที่วางอยู่ (หรือชุดที่เลือก) ปุ่ม วางบนโต๊ะ · เก็บคืน
 * โต๊ะถือได้ 1 ชุด มอนสเตอร์ที่มาเยี่ยมเดินมาหยิบด้วยกฎเดียวกับถาดอาหาร
 */
const WINDOW = 'big-table';
/** ขอบล่างของถาดบนโต๊ะ นับจากขอบบนของภาพโต๊ะ (พิกเซลภาพ เท่ากับในฉาก) */
const TABLE_TRAY_BOTTOM = 27;
const TABLE_WIDTH = 96;

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const dishesText = (item: string): string => (parseSet(item)?.dishes ?? []).map((dish) => itemName(dish)).join(' · ');

export function createBigTableWindow(uiRoot: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'table-window';
  backdrop.hidden = true;
  const panel = element('div', 'ck dy bt');
  const head = sizedArt('big_table', 'bt-head', '--px2');
  const title = element('h2', 'dy-title bt-title', t('table.title'));
  const sub = element('span', 'dy-sub bt-sub', t('table.hint'));
  const close = element('button', 'ck-button ck-close dy-close', '×');
  close.id = 'table-close';
  close.type = 'button';
  close.setAttribute('aria-label', t('ui.close'));
  const list = element('div', 'dy-list bt-list');
  const preview = element('div', 'dy-preview bt-preview');
  panel.append(head, title, sub, close, list, preview);
  backdrop.append(panel);
  uiRoot.append(backdrop);

  let selected: string | null = null;

  const hide = (): void => {
    backdrop.hidden = true;
    gameState.setWindowOpen(WINDOW, false);
  };

  const candidates = (): { item: string; count: number }[] => gameState.world.bag.filter((stack) => needsBigTable(stack.item));

  const row = (item: string, count: number): HTMLElement => {
    const box = element('button', `dy-row bt-row${item === selected ? ' is-selected' : ''}`);
    box.type = 'button';
    box.dataset.tableSet = item;
    const icons = element('span', 'dy-row__icons');
    icons.append(setImage(item, 'bt-row__art'));
    box.append(icons, element('b', 'dy-row__label bt-row__label', `${itemName(item)} ×${count}`), element('small', 'dy-row__have bt-row__have', dishesText(item)));
    box.addEventListener('click', () => {
      selected = item;
      render();
    });
    return box;
  };

  const tableStage = (item: string | null): HTMLElement => {
    const stage = element('div', 'bt-stage');
    stage.append(sizedArt('big_table', 'bt-stage__table', '--dpx'));
    const parts = item ? parseSet(item) : null;
    if (item && parts) {
      const tray = setTable.trays[parts.size];
      const art = setImage(item, 'bt-stage__set', '--dpx');
      const size = art instanceof HTMLCanvasElement ? { w: art.width, h: art.height } : { w: 32, h: 32 };
      art.style.left = `calc(var(--dpx) * ${Math.round(TABLE_WIDTH / 2 - size.w / 2)})`;
      art.style.top = `calc(var(--dpx) * ${TABLE_TRAY_BOTTOM - size.h})`;
      art.dataset.tray = tray.item;
      stage.append(art);
    }
    return stage;
  };

  const renderPreview = (): void => {
    const onTable = gameState.world.sets.bigTable.set;
    const shown = onTable ?? selected;
    const caption = element('b', 'dy-caption bt-caption', shown ? `${onTable ? `${t('table.on')} · ` : ''}${itemName(shown)}` : t('table.empty'));
    const dishes = element('p', 'dy-info bt-dishes', shown ? dishesText(shown) : '');
    const go = element('button', 'ck-go dy-go bt-go', onTable ? t('table.take') : t('table.put'));
    go.id = 'table-go';
    go.type = 'button';
    go.disabled = !onTable && !selected;
    go.addEventListener('click', () => {
      const next = onTable ? takeFromBigTable(gameState.world) : selected ? putOnBigTable(gameState.world, selected) : null;
      if (!next) {
        uiSound('ui_error');
        return;
      }
      gameState.setWorld(next);
      selected = null;
      render();
    });
    preview.replaceChildren(tableStage(shown), caption, dishes, go);
  };

  function render(): void {
    const stacks = candidates();
    if (selected && !stacks.some((stack) => stack.item === selected)) selected = null;
    selected ??= stacks[0]?.item ?? null;
    list.replaceChildren(...stacks.map((stack) => row(stack.item, stack.count)));
    if (stacks.length === 0) list.append(element('p', 'ck-empty bt-none', t('table.none')));
    renderPreview();
  }

  close.addEventListener('click', hide);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) hide();
  });
  eventBus.on('table-open', () => {
    selected = null;
    render();
    backdrop.hidden = false;
    revealWhenReady(backdrop);
    gameState.setWindowOpen(WINDOW, true);
  });
}
