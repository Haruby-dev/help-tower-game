import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState } from '../core/state';
import { countOf } from '../systems/farm';
import { craft, craftStatus, ownedCount, workbenchTable, type CraftStatus } from '../systems/crafting';
import { bagArtId, itemName } from './inventory';
import { sizedArt } from './pixelArt';
import { revealWhenReady } from './preload';

/**
 * หน้าต่างโต๊ะช่างเก่า (งานอาหารโซน 1 ขั้นที่ 4) ทำแก้วไม้ไผ่ ถาดสาน 3 ขนาด ถาดตาก ลอบ จากวัสดุในกระเป๋า
 * ยังไม่มีภาพตัวอย่างของหน้าต่างนี้ ใช้กรอบ สี และขนาดเดียวกับหน้าต่างทำอาหาร K2 (พิกเซลภาพตัวอย่าง ย่อขยายด้วย --pz)
 * ในเกมเรียก "ของเก่า" ไม่บอกว่าของใคร (กฎก่อนบทที่ 9)
 */
const WINDOW = 'workbench';
const BUTTON_TEXT: Record<CraftStatus, TextKey> = {
  ok: 'workbench.make',
  missing: 'workbench.make',
  owned: 'workbench.owned',
  max: 'workbench.max',
  locked: 'workbench.make',
};

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** ภาพของในแถว: ของในกระเป๋าใช้ภาพในกระเป๋า ถาดตากกับลอบใช้ภาพในฉาก */
function rowArt(id: string): HTMLElement {
  const art = bagArtId(id) ?? (registry[id]?.type === 'local' ? id : null);
  if (art && registry[art]?.type === 'local') return sizedArt(art, 'wb-row__art', '--px2');
  return element('i', 'wb-row__art wb-row__art--none');
}

function materialChip(item: string, need: number): HTMLElement {
  const have = countOf(gameState.world.bag, item);
  const chip = element('span', `wb-chip${have < need ? ' is-short' : ''}`);
  chip.dataset.material = item;
  const mini = `ing_mini_${item}`;
  if (registry[mini]?.type === 'local') chip.append(sizedArt(mini, 'wb-chip__art'));
  else chip.append(element('small', 'wb-chip__name', itemName(item)));
  chip.append(element('b', 'wb-chip__count', `${have}/${need}`));
  chip.setAttribute('aria-label', `${itemName(item)} ${have}/${need}`);
  return chip;
}

export function createWorkbenchWindow(uiRoot: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'workbench-window';
  backdrop.hidden = true;
  const panel = element('div', 'ck wb');
  const title = element('h2', 'wb-title', t('workbench.title'));
  const hint = element('span', 'wb-hint', t('workbench.hint'));
  const close = element('button', 'ck-button ck-close wb-close', '×');
  close.id = 'workbench-close';
  close.type = 'button';
  close.setAttribute('aria-label', t('ui.close'));
  const list = element('div', 'wb-list');
  panel.append(title, hint, close, list);
  backdrop.append(panel);
  uiRoot.append(backdrop);

  const hide = (): void => {
    backdrop.hidden = true;
    gameState.setWindowOpen(WINDOW, false);
  };

  const row = (id: string): HTMLElement | null => {
    const recipe = workbenchTable[id]!;
    const world = gameState.world;
    const status = craftStatus(world, id);
    if (status === 'locked') return null;
    const box = element('div', `wb-row is-${status}`);
    box.dataset.craft = id;
    const owned = ownedCount(world, id);
    const name = element('div', 'wb-row__name');
    name.append(element('b', '', `${itemName(id)}${recipe.gives > 1 ? ` ×${recipe.gives}` : ''}`));
    const have = recipe.max !== undefined ? `${t('workbench.have')} ${owned}/${recipe.max}` : `${t('workbench.have')} ${owned}`;
    name.append(element('small', 'wb-row__have', have));
    const materials = element('div', 'wb-row__materials');
    materials.append(...Object.entries(recipe.materials).map(([item, need]) => materialChip(item, need)));
    const button = element('button', 'ck-go wb-make', t(BUTTON_TEXT[status]));
    button.type = 'button';
    button.disabled = status !== 'ok';
    button.dataset.craft = id;
    button.addEventListener('click', () => {
      const next = craft(gameState.world, id);
      if (!next) {
        eventBus.emit('player-says', 'bagFull');
        return;
      }
      gameState.setWorld(next);
      eventBus.emit('notice-text', `${itemName(id)} ${t('workbench.made')}`);
      render();
    });
    box.append(rowArt(id), name, materials, button);
    return box;
  };

  function render(): void {
    list.replaceChildren(...Object.keys(workbenchTable).flatMap((id) => row(id) ?? []));
  }

  close.addEventListener('click', hide);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) hide();
  });
  eventBus.on('workbench-open', () => {
    render();
    backdrop.hidden = false;
    revealWhenReady(backdrop);
    gameState.setWindowOpen(WINDOW, true);
  });
}
