import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState } from '../core/state';
import { needsBigTable, parseSet, putOnBigTable, setTable, tableSlots, takeFromBigTable } from '../systems/sets';
import { itemName, setImage } from './inventory';
import { sizedArt } from './pixelArt';
import { revealWhenReady } from './preload';
import { uiSound } from './sound';

/**
 * หน้าต่างโต๊ะใหญ่ (งานอาหารโซน 1 ขั้นที่ 6 · สเปก 6.4) ยังไม่มีภาพตัวอย่าง ใช้กรอบเดียวกับหน้าเลือกของตาก
 * ซ้ายชุดถาดกลางกับถาดใหญ่ในกระเป๋า ขวาโต๊ะกับช่องวางชุด (3 ช่อง ผู้ใช้เลือก 9 พ.ย. 2026)
 * แตะชุดในรายการแล้วกด วางบนโต๊ะ ชุดลงช่องที่มีกรอบเส้นประ (แตะช่องว่างอื่นเพื่อเปลี่ยนช่อง)
 * แตะชุดบนโต๊ะแล้วกด เก็บคืน · มอนสเตอร์ที่มาเยี่ยมเดินมาหยิบด้วยกฎเดียวกับถาดอาหาร
 */
const WINDOW = 'big-table';
/** กล่องช่องวางชุดกว้างและสูงเท่าถาดใหญ่ (พิกเซลภาพ) */
const SLOT_BOX = 32;

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
  const sub = element('span', 'dy-sub bt-sub');
  const close = element('button', 'ck-button ck-close dy-close', '×');
  close.id = 'table-close';
  close.type = 'button';
  close.setAttribute('aria-label', t('ui.close'));
  const list = element('div', 'dy-list bt-list');
  const preview = element('div', 'dy-preview bt-preview');
  panel.append(head, title, sub, close, list, preview);
  backdrop.append(panel);
  uiRoot.append(backdrop);

  /** ชุดในกระเป๋าที่เลือกไว้จะวาง */
  let selected: string | null = null;
  /** ช่องว่างที่จะวางลง */
  let target: number | null = null;
  /** ช่องที่มีชุดซึ่งเลือกไว้จะเก็บคืน */
  let picked: number | null = null;

  const hide = (): void => {
    backdrop.hidden = true;
    gameState.setWindowOpen(WINDOW, false);
  };

  const candidates = (): { item: string; count: number }[] => gameState.world.bag.filter((stack) => needsBigTable(stack.item));

  const row = (item: string, count: number): HTMLElement => {
    const box = element('button', `dy-row bt-row${item === selected && picked === null ? ' is-selected' : ''}`);
    box.type = 'button';
    box.dataset.tableSet = item;
    const icons = element('span', 'dy-row__icons');
    icons.append(setImage(item, 'bt-row__art'));
    box.append(icons, element('b', 'dy-row__label bt-row__label', `${itemName(item)} ×${count}`), element('small', 'dy-row__have bt-row__have', dishesText(item)));
    box.addEventListener('click', () => {
      selected = item;
      picked = null;
      render();
    });
    return box;
  };

  const slotButton = (item: string | null, slot: number): HTMLElement => {
    const button = element('button', 'bt-slot');
    button.type = 'button';
    button.dataset.tableSlot = String(slot);
    button.classList.toggle('is-filled', item !== null);
    button.classList.toggle('is-selected', item !== null && slot === picked);
    button.classList.toggle('is-target', item === null && picked === null && selected !== null && slot === target);
    button.style.left = `calc(var(--dpx) * ${setTable.bigTable.slots[slot]! - SLOT_BOX / 2})`;
    button.style.top = `calc(var(--dpx) * ${setTable.bigTable.trayBottom - SLOT_BOX})`;
    if (item) {
      const art = setImage(item, 'bt-slot__set', '--dpx');
      const size = art instanceof HTMLCanvasElement ? { w: art.width, h: art.height } : { w: SLOT_BOX, h: SLOT_BOX };
      art.style.left = `calc(var(--dpx) * ${Math.round(SLOT_BOX / 2 - size.w / 2)})`;
      art.style.top = `calc(var(--dpx) * ${SLOT_BOX - size.h})`;
      button.setAttribute('aria-label', itemName(item));
      button.append(art);
    } else {
      button.setAttribute('aria-label', t('table.empty_slot'));
    }
    button.addEventListener('click', () => {
      if (item) picked = slot;
      else {
        picked = null;
        target = slot;
      }
      render();
    });
    return button;
  };

  const renderPreview = (slots: (string | null)[]): void => {
    const stage = element('div', 'bt-stage');
    stage.append(sizedArt('big_table', 'bt-stage__table', '--dpx'), ...slots.map((item, slot) => slotButton(item, slot)));
    const onTable = picked !== null ? slots[picked] ?? null : null;
    const shown = onTable ?? selected;
    const full = !slots.includes(null);
    const caption = element('b', 'dy-caption bt-caption', shown ? `${onTable ? `${t('table.on')} · ` : ''}${itemName(shown)}` : t('table.empty'));
    const dishes = element('p', 'dy-info bt-dishes', shown ? dishesText(shown) : '');
    const go = element('button', 'ck-go dy-go bt-go', onTable ? t('table.take') : full ? t('table.full') : t('table.put'));
    go.id = 'table-go';
    go.type = 'button';
    go.disabled = !onTable && (full || !selected);
    go.addEventListener('click', () => {
      const next = picked !== null && onTable ? takeFromBigTable(gameState.world, picked) : selected ? putOnBigTable(gameState.world, selected, target ?? undefined) : null;
      if (!next) {
        uiSound('ui_error');
        return;
      }
      gameState.setWorld(next);
      picked = null;
      target = null;
      render();
    });
    preview.replaceChildren(stage, caption, dishes, go);
  };

  function render(): void {
    const slots = tableSlots(gameState.world);
    const stacks = candidates();
    if (selected && !stacks.some((stack) => stack.item === selected)) selected = null;
    selected ??= stacks[0]?.item ?? null;
    if (picked !== null && !slots[picked]) picked = null;
    if (target === null || slots[target] !== null) target = slots.indexOf(null) < 0 ? null : slots.indexOf(null);
    // โต๊ะเต็มแล้ว เลือกชุดแรกบนโต๊ะไว้ ปุ่มจะได้เป็นเก็บคืน
    if (target === null && picked === null) picked = slots.findIndex((item) => item !== null);
    if (picked !== null && picked < 0) picked = null;
    const filled = slots.filter((item) => item !== null).length;
    sub.textContent = `${t('table.hint')} ${slots.length} ${t('table.hint_end')} · ${t('table.on')} ${filled}/${slots.length}`;
    list.replaceChildren(...stacks.map((stack) => row(stack.item, stack.count)));
    if (stacks.length === 0) list.append(element('p', 'ck-empty bt-none', t('table.none')));
    renderPreview(slots);
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
    target = null;
    picked = null;
    render();
    backdrop.hidden = false;
    revealWhenReady(backdrop);
    gameState.setWindowOpen(WINDOW, true);
  });
}
