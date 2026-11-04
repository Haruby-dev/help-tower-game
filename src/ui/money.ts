import { formatMoney } from '../systems/economy';
import { artUrl } from './pixelArt';

/** เหรียญอุ้งเท้า 12×12 ใช้ทุกที่ที่แสดงเงิน */
export function coinIcon(className = ''): HTMLImageElement {
  const icon = document.createElement('img');
  icon.className = `pixel-img coin-icon${className ? ` ${className}` : ''}`;
  icon.alt = '';
  icon.src = artUrl('ui_coin_paw');
  return icon;
}

/** ใส่ตัวเลขเงินตามด้วยเหรียญ ข้อความนำหน้า (เช่น "ซื้อ") ใส่ได้ */
export function setMoney(node: HTMLElement, amount: number, prefix = ''): void {
  const text = document.createElement('span');
  text.className = 'money__amount';
  text.textContent = `${prefix}${formatMoney(amount)}`;
  node.classList.add('money');
  node.replaceChildren(text, coinIcon());
}
