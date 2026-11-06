import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import type { Point } from '../core/state';

/**
 * ทายแฝดในฉากเฉลยชั้น 5 (ไอเดียของผู้ใช้): ป้ายคำถามกลางบน และปุ่มแตะทับตัวแฝดแต่ละตัว
 * แตะตัวที่คิดว่าชอบกินปลา แล้วส่งคำตอบกลับไปที่ฉาก · ปุ่มกว้างอย่างน้อย 44px
 */
export function createTwinQuiz(uiRoot: HTMLElement): void {
  const layer = document.createElement('div');
  layer.id = 'twin-quiz';
  layer.hidden = true;
  const prompt = document.createElement('p');
  prompt.className = 'twin-quiz__prompt';
  layer.append(prompt);
  uiRoot.append(layer);
  let picks: { button: HTMLButtonElement; anchor: () => Point | null }[] = [];

  const close = (): void => {
    layer.hidden = true;
    for (const pick of picks) pick.button.remove();
    picks = [];
  };

  const follow = (): void => {
    if (layer.hidden) return;
    for (const pick of picks) {
      const at = pick.anchor();
      pick.button.hidden = at === null;
      if (!at) continue;
      pick.button.style.left = `${at.x}px`;
      pick.button.style.top = `${at.y}px`;
    }
    requestAnimationFrame(follow);
  };

  eventBus.on('twin-quiz', (event) => {
    close();
    prompt.textContent = event.prompt;
    picks = event.anchors.map((anchor, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'twin-quiz__pick';
      button.dataset.twin = String(index);
      button.setAttribute('aria-label', t((index === 0 ? 'twins.pick_left' : 'twins.pick_right') as TextKey));
      const arrow = document.createElement('span');
      arrow.className = 'twin-quiz__arrow';
      arrow.textContent = '▲';
      button.append(arrow);
      button.addEventListener('click', () => {
        close();
        eventBus.emit('twin-quiz-answer', { index });
      });
      layer.append(button);
      return { button, anchor };
    });
    layer.hidden = false;
    requestAnimationFrame(follow);
  });
  eventBus.on('twin-quiz-close', close);
}
