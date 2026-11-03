import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState } from '../core/state';
import { baits, baitsInBag } from '../systems/fishing';
import { countOf } from '../systems/farm';
import { itemImage, itemName } from './inventory';

const WINDOW = 'pond-menu';

/** ยืนริมบ่อแล้วกด เลือกเหยื่อเพื่อเหวี่ยงเบ็ด หรืออาบน้ำ นาฬิกาหยุดระหว่างเลือก */
export function createPondMenu(uiRoot: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'pond-menu';
  backdrop.hidden = true;
  const panel = document.createElement('div');
  panel.className = 'seed-picker__panel pond-menu__panel';
  backdrop.append(panel);
  uiRoot.append(backdrop);

  const close = (): void => {
    backdrop.hidden = true;
    gameState.setWindowOpen(WINDOW, false);
  };
  /** ปิดหน้าต่างก่อน นาฬิกาจะได้เดินตอนฉากเริ่มท่า */
  const choose = (emit: () => void): void => {
    close();
    emit();
  };

  const render = (): void => {
    const { bag } = gameState.world;
    const owned = baitsInBag(bag);
    const title = Object.assign(document.createElement('h3'), { textContent: t('pond.title') });
    const hint = Object.assign(document.createElement('p'), { textContent: t(owned.length > 0 ? 'pond.pick_bait' : 'pond.no_bait') });
    const choices = owned.map((id) => {
      const item = baits[id]!.item;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'seed-choice';
      button.dataset.bait = id;
      button.append(itemImage(item, false), Object.assign(document.createElement('small'), { textContent: `${itemName(item)} ×${countOf(bag, item)}` }));
      button.addEventListener('click', () => choose(() => eventBus.emit('fish-cast', id)));
      return button;
    });
    const bath = document.createElement('button');
    bath.id = 'pond-bath';
    bath.type = 'button';
    bath.className = 'phone-tool';
    bath.textContent = t('pond.bath');
    bath.addEventListener('click', () => choose(() => eventBus.emit('bath-start', undefined)));
    panel.replaceChildren(title, hint, ...choices, bath);
  };

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) close();
  });
  eventBus.on('pond-open', () => {
    render();
    backdrop.hidden = false;
    gameState.setWindowOpen(WINDOW, true);
  });
}
