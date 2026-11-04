import Phaser from 'phaser';
import { createRng } from '../core/rng';

const FX_DEPTH = 8500;
const POP_FONT_PX = 8;
const POP_SLICE = 5;
const POP_PADDING = 6;
const POP_GAP = 2;
const POP_MIN_HEIGHT = 16;

/** การสุ่มผ่าน core/rng ตามกฎโปรเจกต์ */
const rng = createRng(Date.now());
const between = (min: number, max: number): number => Math.floor(rng.between(min, max + 1));

const BUBBLE_KEY = 'fx_bath_bubble';
const BUBBLE_RISE_PX = 10;
const BUBBLE_MS = 700;

/** ฟองสบู่ตอนอาบน้ำ วาดด้วยโค้ดทีละพิกเซล */
export function bathBubble(scene: Phaser.Scene, x: number, y: number): void {
  if (!scene.textures.exists(BUBBLE_KEY)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff).fillRect(1, 0, 3, 1).fillRect(0, 1, 1, 3).fillRect(4, 1, 1, 3).fillRect(1, 4, 3, 1);
    g.fillStyle(0xcdeefa).fillRect(1, 1, 3, 3);
    g.fillStyle(0xffffff).fillRect(1, 1, 1, 1);
    g.generateTexture(BUBBLE_KEY, 5, 5);
    g.destroy();
  }
  const top = Math.round(y);
  const bubble = scene.add.image(Math.round(x), top, BUBBLE_KEY).setDepth(FX_DEPTH);
  scene.tweens.addCounter({
    from: 0,
    to: BUBBLE_RISE_PX,
    duration: BUBBLE_MS,
    ease: 'Sine.easeOut',
    onUpdate: (tween) => {
      const rise = tween.getValue() ?? 0;
      bubble.setY(top - Math.round(rise)).setAlpha(1 - rise / BUBBLE_RISE_PX);
    },
    onComplete: () => bubble.destroy(),
  });
}

/** เศษดินกระเด็นตอนตบดินและตอนพรวน */
export function dirtPuff(scene: Phaser.Scene, x: number, y: number, pieces = 5): void {
  for (let index = 0; index < pieces; index += 1) {
    const clod = scene.add.image(x, y, 'fx_dirt', between(0, 3)).setDepth(FX_DEPTH);
    scene.tweens.add({
      targets: clod,
      x: x + between(-10, 10),
      y: y - between(3, 11),
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => clod.destroy(),
    });
  }
}

export function splash(scene: Phaser.Scene, x: number, y: number): void {
  const mark = scene.add.image(x, y, 'fx_water', 'splash_0').setDepth(FX_DEPTH);
  scene.time.delayedCall(90, () => mark.setFrame('splash_1'));
  scene.time.delayedCall(180, () => mark.destroy());
}

export function sparkle(scene: Phaser.Scene, x: number, y: number): void {
  const star = scene.add.sprite(x + between(-6, 6), y + between(-7, 3), 'fx_sparkle').setDepth(FX_DEPTH);
  star.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => star.destroy());
  star.play('fx_sparkle_once');
}

/** ผลผลิตลอยเป็นโค้งจากดินเข้ามือ พร้อมประกายตามทาง */
export function harvestArc(scene: Phaser.Scene, icon: string, fromX: number, fromY: number, toX: number, toY: number, onDone: () => void): void {
  const image = scene.add.image(fromX, fromY, icon).setDepth(FX_DEPTH);
  const path = { progress: 0 };
  let nextSparkle = 0;
  scene.tweens.add({
    targets: path,
    progress: 1,
    duration: 420,
    ease: 'Sine.easeInOut',
    onUpdate: () => {
      const lift = Math.sin(path.progress * Math.PI) * 24;
      image.setPosition(Phaser.Math.Linear(fromX, toX, path.progress), Phaser.Math.Linear(fromY, toY, path.progress) - lift);
      if (path.progress >= nextSparkle) {
        sparkle(scene, image.x, image.y);
        nextSparkle += 0.25;
      }
    },
    onComplete: () => {
      image.destroy();
      onDone();
    },
  });
}

/** ป้าย "+1 ชื่อ" รูปอยู่ซ้าย ตัวหนังสืออยู่ในป้าย ลอยขึ้นแล้วจาง */
export function popPill(scene: Phaser.Scene, x: number, y: number, icon: string, text: string, resolution: number): void {
  const label = scene.add
    .text(0, 0, text, { fontFamily: 'Mali', fontSize: `${POP_FONT_PX}px`, fontStyle: 'bold', color: '#5c304c' })
    .setOrigin(0, 0.5)
    .setResolution(resolution);
  const picture = scene.add.image(0, 0, icon).setOrigin(0, 0.5);
  const width = Math.ceil(picture.width + POP_GAP + label.width + POP_PADDING * 2);
  const height = Math.max(POP_MIN_HEIGHT, Math.ceil(picture.height + 2));
  const left = -Math.floor(width / 2);
  picture.setX(left + POP_PADDING);
  label.setX(left + POP_PADDING + picture.width + POP_GAP);
  const pill = scene.add.nineslice(0, 0, 'fx_pop_pill', undefined, width, height, POP_SLICE, POP_SLICE, POP_SLICE, POP_SLICE);
  const group = scene.add.container(x, y, [pill, picture, label]).setDepth(FX_DEPTH + 1);
  scene.tweens.add({ targets: group, y: y - 14, alpha: 0, delay: 350, duration: 650, onComplete: () => group.destroy() });
}
