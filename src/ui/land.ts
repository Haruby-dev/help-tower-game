import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState } from '../core/state';
import { buyLand, landPrice } from '../systems/land';
import { setMoney } from './money';

const WINDOW = 'land-confirm';

/** เดินไปแตะป้ายขายที่แล้วกดซื้อ ถามยืนยันพร้อมราคาก่อนจ่ายเหรียญ */
export function createLandConfirm(uiRoot: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'land-confirm';
  backdrop.hidden = true;
  const panel = document.createElement('div');
  panel.className = 'dig-confirm__panel';
  const text = document.createElement('p');
  const price = document.createElement('p');
  price.className = 'land-confirm__price';
  const yes = document.createElement('button');
  yes.id = 'land-yes';
  yes.type = 'button';
  yes.className = 'phone-tool';
  yes.textContent = t('land.yes');
  const no = document.createElement('button');
  no.id = 'land-no';
  no.type = 'button';
  no.className = 'phone-tool';
  no.textContent = t('land.no');
  panel.append(text, price, yes, no);
  backdrop.append(panel);
  uiRoot.append(backdrop);

  let target = -1;
  const close = (): void => {
    backdrop.hidden = true;
    gameState.setWindowOpen(WINDOW, false);
  };
  eventBus.on('land-requested', (land) => {
    target = land;
    text.textContent = t('land.question').replace('{n}', String(land + 1));
    setMoney(price, landPrice(land), '');
    backdrop.hidden = false;
    gameState.setWindowOpen(WINDOW, true);
  });
  yes.addEventListener('click', () => {
    close();
    const result = buyLand(gameState.world, target);
    if (result.world) {
      gameState.setWorld(result.world);
      eventBus.emit('land-bought', target);
    } else if (result.reason === 'money') eventBus.emit('player-says', 'noMoney');
  });
  no.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
}
