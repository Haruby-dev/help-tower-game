import Phaser from 'phaser';

const FX_DEPTH = 8500;
const DIRT_COLORS = [0x7a4a2c, 0x9a6438, 0x5e3822];
const DROP_COLOR = 0x8fd0f5;
const SPARKLE_COLOR = 0xfff1a8;

/** เศษดินกระเด็นตอนตบดินและตอนพรวน เป็นจุดพิกเซลล้วน */
export function dirtPuff(scene: Phaser.Scene, x: number, y: number): void {
  for (let index = 0; index < 5; index += 1) {
    const color = DIRT_COLORS[index % DIRT_COLORS.length]!;
    const piece = scene.add.rectangle(x, y, 2, 2, color).setDepth(FX_DEPTH);
    scene.tweens.add({
      targets: piece,
      x: x + Phaser.Math.Between(-10, 10),
      y: y - Phaser.Math.Between(3, 11),
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => piece.destroy(),
    });
  }
}

/** หยดน้ำโค้งลงจากบัวไปที่แปลง */
export function waterDrops(scene: Phaser.Scene, fromX: number, fromY: number, toX: number, toY: number): void {
  for (let index = 0; index < 8; index += 1) {
    const drop = scene.add.rectangle(fromX, fromY, 2, 2, DROP_COLOR).setDepth(FX_DEPTH);
    scene.tweens.add({
      targets: drop,
      x: toX + Phaser.Math.Between(-9, 9),
      y: toY + Phaser.Math.Between(-5, 7),
      delay: index * 55,
      duration: 300,
      ease: 'Quad.easeIn',
      onComplete: () => drop.destroy(),
    });
  }
}

export function sparkle(scene: Phaser.Scene, x: number, y: number): void {
  for (let index = 0; index < 4; index += 1) {
    const dot = scene.add.rectangle(x, y, 2, 2, SPARKLE_COLOR).setDepth(FX_DEPTH);
    scene.tweens.add({
      targets: dot,
      x: x + Phaser.Math.Between(-8, 8),
      y: y + Phaser.Math.Between(-9, 4),
      alpha: 0,
      duration: 380,
      onComplete: () => dot.destroy(),
    });
  }
}

/** ผลผลิตลอยเป็นโค้งจากดินเข้ามือ พร้อมประกายตามทาง */
export function harvestArc(scene: Phaser.Scene, icon: string, fromX: number, fromY: number, toX: number, toY: number, onDone: () => void): void {
  const image = scene.add.image(fromX, fromY, icon).setDepth(FX_DEPTH);
  const path = { progress: 0 };
  scene.tweens.add({
    targets: path,
    progress: 1,
    duration: 420,
    ease: 'Sine.easeInOut',
    onUpdate: () => {
      const lift = Math.sin(path.progress * Math.PI) * 24;
      image.setPosition(Phaser.Math.Linear(fromX, toX, path.progress), Phaser.Math.Linear(fromY, toY, path.progress) - lift);
      if (Math.random() < 0.3) sparkle(scene, image.x, image.y);
    },
    onComplete: () => {
      image.destroy();
      onDone();
    },
  });
}

/** ข้อความ +1 ลอยขึ้นแล้วจาง วาดที่ความละเอียดจริงของจอ */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, resolution: number): void {
  const label = scene.add
    .text(x, y, text, { fontFamily: 'Mali', fontSize: '9px', fontStyle: 'bold', color: '#ffffff', stroke: '#5c304c', strokeThickness: 2 })
    .setOrigin(0.5, 1)
    .setDepth(FX_DEPTH + 1)
    .setResolution(resolution);
  scene.tweens.add({ targets: label, y: y - 14, alpha: 0, delay: 350, duration: 650, onComplete: () => label.destroy() });
}
