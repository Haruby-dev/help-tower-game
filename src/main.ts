import Phaser from 'phaser';
import { t } from './core/i18n';
import { eventBus } from './core/events';
import { sound } from './core/audio';
import { gameState } from './core/state';
import { computeViewport, homeScreenAppSize, isHomeScreenApp, type Viewport } from './core/viewport';
import display from './data/display.json';
import { BaseScene } from './scenes/BaseScene';
import { BootScene } from './scenes/BootScene';
import { changeMoney } from './systems/economy';
import { newWorld } from './systems/gauges';
import { createOverlay, updateRotationRequired } from './ui/overlay';
import { showTitleScreen } from './ui/saves';
import './ui/styles.css';

const appRoot = document.getElementById('app')!;
const gameRoot = document.getElementById('game')!;
const uiRoot = document.getElementById('ui')!;

function fitHomeScreenApp(): void {
  if (!isHomeScreenApp()) return;
  const size = homeScreenAppSize(window.screen.width, window.screen.height, window.innerWidth >= window.innerHeight);
  appRoot.style.width = `${size.width}px`;
  appRoot.style.height = `${size.height}px`;
}

function readViewport(): Viewport {
  return computeViewport({
    cssWidth: appRoot.clientWidth,
    cssHeight: appRoot.clientHeight,
    devicePixelRatio: window.devicePixelRatio,
    baseWidth: display.baseWidth,
    baseHeight: display.baseHeight,
    zoomStep: gameState.zoomStep,
  });
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
  render: { pixelArt: true, roundPixels: true, antialias: false },
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
  // จอย้ายไปจอที่ความหนาแน่นพิกเซลต่างกันโดยขนาดหน้าต่างไม่เปลี่ยน
  window.addEventListener('resize', onScreenChanged);
});

const params = new URLSearchParams(window.location.search);
if (params.has('test')) {
  (window as unknown as { __game: Phaser.Game; __state: typeof gameState }).__game = game;
  (window as unknown as { __state: typeof gameState }).__state = gameState;
  (window as unknown as { __changeMoney: typeof changeMoney }).__changeMoney = changeMoney;
  (window as unknown as { __sound: typeof sound }).__sound = sound;
}
// การทดสอบที่ไม่ได้สนใจเซฟข้ามหน้าเลือกช่อง
if (params.has('test') && !params.has('saves')) gameState.startGame(1, newWorld());
else showTitleScreen(uiRoot);
