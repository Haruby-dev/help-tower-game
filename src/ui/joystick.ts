import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { joystickVector } from '../core/movement';
import { gameState } from '../core/state';

/** ปุ่มกลางเลื่อนได้ไกลสุดเท่ารัศมีวงนอกลบรัศมีปุ่มกลาง กำหนดขนาดจริงใน styles.css */
export function createJoystick(uiRoot: HTMLElement): void {
  if (!window.matchMedia('(pointer: coarse)').matches) return;

  const base = document.createElement('div');
  base.id = 'joystick';
  base.setAttribute('role', 'application');
  base.setAttribute('aria-label', t('ui.joystick'));

  const knob = document.createElement('div');
  knob.className = 'joystick__knob';
  base.append(knob);
  uiRoot.append(base);

  let activePointer: number | null = null;

  const moveTo = (event: PointerEvent): void => {
    const bounds = base.getBoundingClientRect();
    const radius = (bounds.width - knob.offsetWidth) / 2;
    const vector = joystickVector(
      event.clientX - (bounds.left + bounds.width / 2),
      event.clientY - (bounds.top + bounds.height / 2),
      radius,
    );
    knob.style.transform = `translate(${vector.x * radius}px, ${vector.y * radius}px)`;
    gameState.setJoystick(vector);
  };

  const release = (event: PointerEvent): void => {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    knob.style.transform = '';
    gameState.setJoystick({ x: 0, y: 0 });
  };

  base.addEventListener('pointerdown', (event) => {
    if (activePointer !== null) return;
    event.preventDefault();
    activePointer = event.pointerId;
    base.setPointerCapture(event.pointerId);
    moveTo(event);
  });
  base.addEventListener('pointermove', (event) => {
    if (event.pointerId === activePointer) moveTo(event);
  });
  base.addEventListener('pointerup', release);
  base.addEventListener('pointercancel', release);
  base.addEventListener('lostpointercapture', release);

  // หมุนจอระหว่างลาก บางเบราว์เซอร์ไม่แจ้งว่านิ้วหลุด ตัวละครจะเดินค้างเมื่อกลับมาเล่น
  eventBus.on('rotation-required-changed', (required) => {
    if (!required) return;
    activePointer = null;
    knob.style.transform = '';
    gameState.setJoystick({ x: 0, y: 0 });
  });
}
