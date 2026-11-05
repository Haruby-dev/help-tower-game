import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState } from '../core/state';

/**
 * ปุ่มจัดวางอยู่แถบบนข้างปุ่มตั้งค่า (ผู้ใช้ขอ 5 พ.ย. 2026) ไอคอนยังไม่มีภาพ ใช้กล่องสีพร้อมชื่อแทน
 * ระหว่างจัดวางแถบล่างบอกวิธีและมีปุ่ม วางตรงนี้ · ยกเลิก · เสร็จ ส่วนปุ่มอื่นของ HUD ซ่อน
 */
export function createArrange(uiRoot: HTMLElement): void {
  const button = document.createElement('button');
  button.id = 'arrange-button';
  button.type = 'button';
  button.dataset.missingIcon = '';
  button.setAttribute('aria-label', t('arrange.open'));
  button.textContent = t('arrange.icon_placeholder');

  const panel = document.createElement('div');
  panel.id = 'arrange-panel';
  panel.hidden = true;
  const hint = document.createElement('p');
  hint.className = 'arrange-panel__hint';
  const place = document.createElement('button');
  place.id = 'arrange-place';
  place.type = 'button';
  place.className = 'phone-tool';
  place.textContent = t('arrange.place');
  const cancel = document.createElement('button');
  cancel.id = 'arrange-cancel';
  cancel.type = 'button';
  cancel.className = 'phone-tool';
  cancel.textContent = t('arrange.cancel');
  const done = document.createElement('button');
  done.id = 'arrange-done';
  done.type = 'button';
  done.className = 'phone-tool';
  done.textContent = t('arrange.done');
  panel.append(hint, place, cancel, done);
  uiRoot.append(button, panel);

  button.addEventListener('click', () => {
    if (!gameState.started) return;
    eventBus.emit('arrange-toggle', undefined);
  });
  place.addEventListener('click', () => eventBus.emit('arrange-command', 'place'));
  cancel.addEventListener('click', () => eventBus.emit('arrange-command', 'cancel'));
  done.addEventListener('click', () => eventBus.emit('arrange-command', 'done'));

  eventBus.on('arrange-changed', ({ active, selected, valid }) => {
    panel.hidden = !active;
    if (active) uiRoot.dataset.arrange = 'open';
    else delete uiRoot.dataset.arrange;
    hint.textContent = t(!selected ? 'arrange.hint_pick' : valid ? 'arrange.hint_ok' : 'arrange.hint_move');
    place.disabled = !selected || !valid;
    cancel.hidden = !selected;
  });
}
