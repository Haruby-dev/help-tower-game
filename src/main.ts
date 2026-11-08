import Phaser from 'phaser';
import { t } from './core/i18n';
import { eventBus } from './core/events';
import { sound } from './core/audio';
import { gameState } from './core/state';
import { computeViewport, fitZoom, homeScreenAppSize, isHomeScreenApp, type Viewport, type ViewportInput } from './core/viewport';
import display from './data/display.json';
import { BaseScene } from './scenes/BaseScene';
import { BootScene } from './scenes/BootScene';
import { visitTestHooks } from './scenes/visits';
import { changeMoney } from './systems/economy';
import { newWorld } from './systems/gauges';
import { createOverlay, updateRotationRequired } from './ui/overlay';
import { showTitleScreen } from './ui/saves';
import './ui/styles.css';
import './ui/phone.css';
import { mortarTestHooks } from './ui/mortar';
import './ui/cooking.css';

const appRoot = document.getElementById('app')!;
const gameRoot = document.getElementById('game')!;
const uiRoot = document.getElementById('ui')!;

function fitHomeScreenApp(): void {
  if (!isHomeScreenApp()) {
    // ออกจากเต็มจอ (เช่นกด F11 ซ้ำ) แล้วกลับไปใช้ขนาดหน้าต่าง ไม่ค้างขนาดจอเต็มจนเกมล้นหน้าต่าง
    appRoot.style.width = '';
    appRoot.style.height = '';
    return;
  }
  const size = homeScreenAppSize(window.screen.width, window.screen.height, window.innerWidth >= window.innerHeight);
  appRoot.style.width = `${size.width}px`;
  appRoot.style.height = `${size.height}px`;
}

function screenInput(): ViewportInput {
  return {
    cssWidth: appRoot.clientWidth,
    cssHeight: appRoot.clientHeight,
    devicePixelRatio: window.devicePixelRatio,
    baseWidth: display.baseWidth,
    baseHeight: display.baseHeight,
    zoomStep: gameState.zoomStep,
  };
}

/**
 * ขนาดภาพก่อนกดปุ่มเต็มจอ ใช้ต่อจนออกจากเต็มจอ ตัวละครจึงไม่ใหญ่ขึ้นตอนเต็มจอ เห็นฉากกว้างขึ้นแทน (ผู้ใช้เลือก 7 พ.ย. 2026)
 * จำตอนกดปุ่ม ไม่ใช่ตอนจอเปลี่ยน เพราะเบราว์เซอร์อาจขยายจอก่อนบอกว่าเต็มจอแล้ว · เปิดเกมมาเต็มจออยู่แล้วใช้กฎเดิม
 */
let fullscreenFit: number | undefined;

function readViewport(): Viewport {
  return computeViewport({ ...screenInput(), fit: fullscreenFit });
}

function applyCanvasSize(game: Phaser.Game, viewport: Viewport): void {
  game.scale.resize(viewport.canvasWidth, viewport.canvasHeight);
  game.canvas.style.width = `${viewport.styleWidth}px`;
  game.canvas.style.height = `${viewport.styleHeight}px`;
  game.scale.updateBounds();
}

document.title = t('game.title');
fitHomeScreenApp();
createOverlay(uiRoot, appRoot);

const initialViewport = readViewport();
gameState.setViewport(initialViewport);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameRoot,
  width: initialViewport.canvasWidth,
  height: initialViewport.canvasHeight,
  backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--world-background').trim(),
  scale: { mode: Phaser.Scale.NONE },
  // มือถือใช้วิธีวาดรวมหลายภาพในครั้งเดียวเหมือนคอม (ค่าเดิมของ Phaser วาดทีละภาพบนมือถือ ทำให้สั่งวาดหลายร้อยครั้งต่อภาพจนกระตุก)
  render: { pixelArt: true, roundPixels: true, antialias: false, autoMobilePipeline: false },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
  banner: false,
  scene: [BootScene, BaseScene],
});

eventBus.on('rotation-required-changed', (required) => {
  if (required) game.pause();
  else game.resume();
});

function onScreenChanged(): void {
  fitHomeScreenApp();
  const viewport = readViewport();
  applyCanvasSize(game, viewport);
  gameState.setViewport(viewport);
  updateRotationRequired(appRoot);
}

game.events.once(Phaser.Core.Events.READY, () => {
  onScreenChanged();
  new ResizeObserver(onScreenChanged).observe(appRoot);
  eventBus.on('zoom-step-changed', onScreenChanged);
  eventBus.on('fullscreen-requested', () => {
    fullscreenFit = fitZoom(screenInput());
  });
  const forgetWhenWindowed = (): void => {
    if (document.fullscreenElement) return;
    fullscreenFit = undefined;
    onScreenChanged();
  };
  document.addEventListener('fullscreenchange', forgetWhenWindowed);
  document.addEventListener('fullscreenerror', forgetWhenWindowed);
  // จอย้ายไปจอที่ความหนาแน่นพิกเซลต่างกันโดยขนาดหน้าต่างไม่เปลี่ยน
  window.addEventListener('resize', onScreenChanged);
});

/**
 * เครื่องที่หน่วยความจำการ์ดจอเต็ม (เช่น iPhone ที่เปิดแอปไว้เยอะ) อาจเสียบริบท WebGL ตอนเกมกำลังเปิด แล้วค้างจอดำ
 * ถ้าเสียก่อนเข้าฉากชั้นฐาน โหลดหน้าใหม่หนึ่งครั้ง (ไม่วนโหลดซ้ำภายใน WEBGL_RELOAD_GAP_MS) · เสียระหว่างเล่น Phaser กู้คืนเอง
 */
const WEBGL_RELOAD_KEY = 'webgl-lost-reload-at';
const WEBGL_RELOAD_GAP_MS = 30_000;
document.addEventListener(
  'webglcontextlost',
  () => {
    if (game.scene.isActive('Base')) return;
    try {
      const last = Number(window.sessionStorage.getItem(WEBGL_RELOAD_KEY) ?? 0);
      if (Date.now() - last < WEBGL_RELOAD_GAP_MS) return;
      window.sessionStorage.setItem(WEBGL_RELOAD_KEY, String(Date.now()));
    } catch {
      // เบราว์เซอร์ไม่ให้จำ จะกันการวนโหลดไม่ได้ จึงไม่โหลดใหม่
      return;
    }
    window.location.reload();
  },
  { capture: true },
);

const params = new URLSearchParams(window.location.search);
if (params.has('test')) {
  (window as unknown as { __game: Phaser.Game; __state: typeof gameState }).__game = game;
  (window as unknown as { __state: typeof gameState }).__state = gameState;
  (window as unknown as { __changeMoney: typeof changeMoney }).__changeMoney = changeMoney;
  (window as unknown as { __sound: typeof sound }).__sound = sound;
  (window as unknown as { __visitSpeed: (speed: number) => void }).__visitSpeed = (speed) => {
    visitTestHooks.speed = speed;
  };
  (window as unknown as { __mortarAuto: (judge: 'perfect' | 'good' | 'miss' | null) => void }).__mortarAuto = (judge) => {
    mortarTestHooks.auto = judge;
  };
}
// การทดสอบที่ไม่ได้สนใจเซฟข้ามหน้าเลือกช่อง
if (params.has('test') && !params.has('saves')) gameState.startGame(1, newWorld());
else showTitleScreen(uiRoot);
