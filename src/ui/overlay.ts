import { assetUrl, registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState } from '../core/state';
import { needsRotation, uiZoomFor } from '../core/viewport';
import display from '../data/display.json';
import { createChestWindow } from './chest';
import { createCookingWindow } from './cooking';
import { createHud } from './hud';
import { createJoystick } from './joystick';
import { createPhone } from './phone';
import { createRecipeBook } from './recipeBook';
import { createUpdateCheck } from './update';
import { createSaves } from './saves';
import { createSettings, createSupportCard, initSettings } from './settings';
import { createAlbum } from './album';
import { createPetsBook } from './petsBook';
import { createGateBook } from './gateBook';
import { createMailBook } from './mailBook';
import { createSound } from './sound';
import { createLandConfirm } from './land';
import { createArrange } from './arrange';
import { createToolbar } from './toolbar';
import { createGioWindows } from './gio';
import { createTrayWindow } from './tray';
import { createWorldBubbles } from './bubbles';
import { createTwinQuiz } from './twinQuiz';

/** ภาพตัวอย่างของฝั่งวางแผนวาดที่ 3 จุดจอต่อพิกเซลภาพ (2796×1290) */
const MOCK_SCALE = 3;

function createRotatePrompt(uiRoot: HTMLElement): void {
  const gio = registry.gio_sit;
  if (gio?.type !== 'local' || !gio.frame_width || !gio.frame_height) throw new Error('gio_sit is not a sheet');
  const prompt = document.createElement('div');
  prompt.id = 'rotate-prompt';
  prompt.hidden = true;

  const sprite = document.createElement('div');
  sprite.className = 'rotate-prompt__gio';
  sprite.style.backgroundImage = `url("${assetUrl(gio.file)}")`;
  sprite.style.setProperty('--sheet-width', `${gio.width}px`);
  sprite.style.setProperty('--sheet-height', `${gio.height}px`);
  sprite.style.setProperty('--frame-height', `${gio.frame_height}px`);
  sprite.style.setProperty('--frame-width', `${gio.frame_width}px`);

  const message = document.createElement('p');
  message.className = 'panel';
  message.textContent = t('orientation.rotate_prompt');

  const hint = document.createElement('p');
  hint.className = 'panel rotate-prompt__hint';
  hint.textContent = t('orientation.rotate_hint');

  prompt.append(sprite, message, hint);
  uiRoot.append(prompt);

  eventBus.on('rotation-required-changed', (required) => {
    prompt.hidden = !required;
  });
}

export function createOverlay(uiRoot: HTMLElement, appRoot: HTMLElement): void {
  // ทุกขนาดใน CSS นับเป็นพิกเซลเกมคูณ --px ภาพจึงตรงตารางพิกเซลเดียวกัน
  eventBus.on('viewport-changed', (viewport) => {
    const pixel = uiZoomFor(viewport, display.uiDesign) / window.devicePixelRatio;
    uiRoot.style.setProperty('--px', `${pixel}px`);
    uiRoot.style.setProperty('--tpx', `${uiZoomFor(viewport, display.titleDesign) / window.devicePixelRatio}px`);
    // โทรศัพท์ สมุด และการ์ดเขียนเป็นพิกเซลของภาพตัวอย่าง (3 จุดจอต่อพิกเซลภาพบน iPhone แนวนอน) แล้วย่อขยายทั้งก้อนด้วย zoom
    const dpr = window.devicePixelRatio;
    const phone = uiZoomFor(viewport, display.phoneDesign);
    const book = uiZoomFor(viewport, display.bookDesign);
    uiRoot.style.setProperty('--bpx', `${book / dpr}px`);
    // พื้นที่แตะอย่างน้อย 44 พิกเซลจอในการ์ด (หน่วยในการ์ดคือพิกเซลภาพ จึงหารด้วยขนาดพิกเซลภาพ)
    uiRoot.style.setProperty('--bpxn', String(book / dpr));
    uiRoot.style.setProperty('--bz', String(book / MOCK_SCALE / dpr));
    uiRoot.style.setProperty('--pz', String(phone / MOCK_SCALE / dpr));
    // ภาพที่ภาพตัวอย่างวาด 2 หรือ 4 จุดต่อพิกเซล: ปัดให้เป็นจำนวนเต็มของจุดจอเสมอ ภาพจึงคมทุกขนาดจอ (iPhone ได้เท่าภาพตัวอย่างพอดี)
    const mockPx = (dots: number): string => `${(dots * MOCK_SCALE) / phone}px`;
    uiRoot.style.setProperty('--m2', mockPx(Math.max(1, Math.round((2 * phone) / MOCK_SCALE))));
    uiRoot.style.setProperty('--m4', mockPx(Math.max(1, Math.round((4 * phone) / MOCK_SCALE))));
    uiRoot.style.setProperty('--m4cover', mockPx(Math.ceil((4 * phone) / MOCK_SCALE)));
  });
  createHud(uiRoot);
  createJoystick(uiRoot);
  createRotatePrompt(uiRoot);
  initSettings(appRoot);
  createToolbar(uiRoot);
  // ปุ่มจัดวางอยู่ในชั้นเดียวกับ HUD หน้าต่าง สมุด และการ์ดที่สร้างทีหลังจึงทับปุ่มนี้ได้
  createArrange(uiRoot);
  createCookingWindow(uiRoot);
  createGioWindows(uiRoot);
  createTrayWindow(uiRoot);
  createWorldBubbles(uiRoot);
  createTwinQuiz(uiRoot);
  createChestWindow(uiRoot);
  createSettings(uiRoot);
  createPhone(uiRoot);
  createSaves(uiRoot);
  createRecipeBook(uiRoot);
  createAlbum(uiRoot);
  createPetsBook(uiRoot);
  createGateBook(uiRoot);
  createMailBook(uiRoot);
  createSupportCard(uiRoot);
  createUpdateCheck(uiRoot);
  createLandConfirm(uiRoot);
  createSound();
}

export function updateRotationRequired(appRoot: HTMLElement): void {
  const isTouchScreen = window.matchMedia('(pointer: coarse)').matches;
  gameState.setRotationRequired(needsRotation(appRoot.clientWidth, appRoot.clientHeight, isTouchScreen));
}
