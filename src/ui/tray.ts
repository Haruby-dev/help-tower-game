import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState, type BagStack } from '../core/state';
import { countOf } from '../systems/farm';
import { dishesInBag, plateCount, plateFor, putOnTray, takeBackFromTray } from '../systems/tray';
import { cornerBadge, itemImage, itemName } from './inventory';
import { revealWhenReady } from './preload';
import { uiSound } from './sound';

const WINDOW = 'tray';
const HOLD_MS = 450;

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** แตะครั้งเดียวทำ once · กดค้างทำ hold (เหมือนหน้าฝากขายจีโอ) */
function tapOrHold(slot: HTMLButtonElement, once: () => void, hold: () => void): void {
  let held = false;
  let timer = 0;
  slot.addEventListener('pointerdown', () => {
    held = false;
    timer = window.setTimeout(() => {
      held = true;
      hold();
    }, HOLD_MS);
  });
  const cancel = (): void => window.clearTimeout(timer);
  slot.addEventListener('pointerup', cancel);
  slot.addEventListener('pointerleave', cancel);
  slot.addEventListener('click', () => {
    if (!held) once();
  });
}

function stackSlot(stack: BagStack | null, className: string): HTMLButtonElement {
  const slot = element('button', className);
  slot.type = 'button';
  if (!stack) {
    slot.disabled = true;
    return slot;
  }
  slot.dataset.item = stack.item;
  slot.setAttribute('aria-label', itemName(stack.item));
  slot.append(itemImage(stack.item, false), element('b', '', String(stack.count)));
  cornerBadge(slot, stack.item);
  return slot;
}

/** หน้าต่างถาดอาหาร: อาหารในกระเป๋าทางซ้าย จานบนถาดทางขวา จานละ 1 เมนู นาฬิกาหยุดระหว่างเปิด */
export function createTrayWindow(uiRoot: HTMLElement): void {
  const root = element('div', 'gio-backdrop');
  root.id = 'tray-window';
  root.hidden = true;
  const panel = element('div', 'consign-panel tray-panel');
  root.append(panel);
  uiRoot.append(root);

  const close = (): void => {
    root.hidden = true;
    gameState.setWindowOpen(WINDOW, false);
  };

  const put = (item: string, count: number): void => {
    const world = gameState.world;
    if (plateFor(world.tray, item) === null) {
      uiSound('ui_error');
      eventBus.emit('notice', 'tray.full');
      return;
    }
    const next = putOnTray(world, item, Math.min(count, countOf(world.bag, item)));
    if (next) gameState.setWorld(next);
  };

  const takeBack = (index: number, count: number): void => {
    const next = takeBackFromTray(gameState.world, index, count);
    if (next) gameState.setWorld(next);
    else eventBus.emit('player-says', 'bagFull');
  };

  function render(): void {
    const world = gameState.world;
    const head = element('div', 'consign-head');
    const back = element('button', 'phone-tool consign-back', '×');
    back.type = 'button';
    back.id = 'tray-close';
    back.setAttribute('aria-label', t('ui.close'));
    back.addEventListener('click', close);
    head.append(back, element('h2', 'consign-title', t('tray.title')));

    const left = element('div', 'consign-left');
    const grid = element('div', 'consign-grid');
    const dishes = dishesInBag(world.bag);
    for (const stack of dishes) {
      const slot = stackSlot(stack, 'bag-slot consign-slot tray-dish');
      tapOrHold(
        slot,
        () => put(stack.item, 1),
        () => put(stack.item, countOf(gameState.world.bag, stack.item)),
      );
      grid.append(slot);
    }
    left.append(element('b', 'consign-label', t('tray.bag')), grid);
    if (dishes.length === 0) left.append(element('small', 'consign-hint', t('tray.empty_bag')));
    left.append(element('small', 'consign-hint', t('tray.hint')));

    const right = element('div', 'consign-right');
    const plates = element('div', 'consign-pack tray-plates');
    plates.id = 'tray-plates';
    for (let index = 0; index < plateCount(world.tray.level); index += 1) {
      const plate = world.tray.plates[index] ?? null;
      const slot = stackSlot(plate, 'consign-pack__slot tray-plate');
      slot.dataset.plate = String(index);
      if (!plate) slot.setAttribute('aria-label', t('tray.plate_empty'));
      else
        tapOrHold(
          slot,
          () => takeBack(index, 1),
          () => takeBack(index, plate.count),
        );
      plates.append(slot);
    }
    right.append(element('b', 'consign-label', t('tray.plates')), plates);

    const body = element('div', 'consign-body');
    body.append(left, right);
    panel.replaceChildren(head, body);
  }

  eventBus.on('tray-open', () => {
    render();
    root.hidden = false;
    revealWhenReady(root);
    gameState.setWindowOpen(WINDOW, true);
  });
  eventBus.on('world-changed', () => {
    if (!root.hidden) render();
  });
  root.addEventListener('click', (event) => {
    if (event.target === root) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !root.hidden) close();
  });
}
