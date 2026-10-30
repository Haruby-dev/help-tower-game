import Phaser from 'phaser';
import { t } from './core/i18n';
import { eventBus } from './core/events';
import { gameState } from './core/state';
import { computeViewport, type Viewport } from './core/viewport';
import display from './data/display.json';
import { BaseScene } from './scenes/BaseScene';
import { BootScene } from './scenes/BootScene';
import { createOverlay, updateRotationRequired } from './ui/overlay';
import './ui/styles.css';

const appRoot = document.getElementById('app')!;
const gameRoot = document.getElementById('game')!;
const uiRoot = document.getElementById('ui')!;

function readViewport(): Viewport {
  return computeViewport({
    cssWidth: appRoot.clientWidth,
    cssHeight: appRoot.clientHeight,
    devicePixelRatio: window.devicePixelRatio,
    baseWidth: display.baseWidth,
    baseHeight: display.baseHeight,
  });
}

function applyCanvasSize(game: Phaser.Game, viewport: Viewport): void {
  game.scale.resize(viewport.canvasWidth, viewport.canvasHeight);
  game.canvas.style.width = `${viewport.styleWidth}px`;
  game.canvas.style.height = `${viewport.styleHeight}px`;
  game.scale.updateBounds();
}

document.title = t('game.title');
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
  const viewport = readViewport();
  applyCanvasSize(game, viewport);
  gameState.setViewport(viewport);
  updateRotationRequired(appRoot);
}

game.events.once(Phaser.Core.Events.READY, () => {
  onScreenChanged();
  new ResizeObserver(onScreenChanged).observe(appRoot);
  // จอย้ายไปจอที่ความหนาแน่นพิกเซลต่างกันโดยขนาดหน้าต่างไม่เปลี่ยน
  window.addEventListener('resize', onScreenChanged);
});

if (new URLSearchParams(window.location.search).has('test')) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
