import Phaser from 'phaser';

const TREE_KINDS = 4;
const TWINKLE_FRAMES = 16;
const TWINKLE_LIGHT = 40;
const TWINKLE_EDGE = 0.6;
const SWAY_MS = 2500;
const SWAY_PX = 0.8;
const PHASE_STEP = 0.9;

const canopyKey = (kind: number): string => `tree_canopy_${kind}`;
const twinkleKey = (kind: number): string => `tree_twinkle_${kind}`;
export const treeMaskKey = (kind: number, mask: 'canopy' | 'light'): string => `fx_tree_big_${kind}_${mask}_mask`;

function pixelsOf(scene: Phaser.Scene, key: string): ImageData {
  const source = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(source, 0, 0);
  return context.getImageData(0, 0, source.width, source.height);
}

/**
 * เตรียมภาพพุ่มใบที่ขยับได้กับแสงระยิบ จากหน้ากากที่ฝั่งวางแผนส่งมา
 * แสงระยิบเป็นแผ่นหลายเฟรม เติมความสว่างด้วยการผสมสีแบบบวก
 */
export function prepareTreeSway(scene: Phaser.Scene): void {
  for (let kind = 0; kind < TREE_KINDS; kind += 1) {
    const tree = pixelsOf(scene, `tree_big_${kind}`);
    const canopyMask = pixelsOf(scene, treeMaskKey(kind, 'canopy'));
    const lightMask = pixelsOf(scene, treeMaskKey(kind, 'light'));
    const { width, height } = tree;
    const canopy = new ImageData(width, height);
    for (let i = 0; i < width * height; i += 1) {
      const on = (canopyMask.data[i * 4] ?? 0) > 127 && (canopyMask.data[i * 4 + 3] ?? 0) > 0;
      if (on) canopy.data.set(tree.data.subarray(i * 4, i * 4 + 4), i * 4);
    }
    const canopyTexture = scene.textures.createCanvas(canopyKey(kind), width, height)!;
    canopyTexture.getContext().putImageData(canopy, 0, 0);
    canopyTexture.refresh();

    const twinkle = scene.textures.createCanvas(twinkleKey(kind), width * TWINKLE_FRAMES, height)!;
    const sheet = new ImageData(width * TWINKLE_FRAMES, height);
    for (let frame = 0; frame < TWINKLE_FRAMES; frame += 1) {
      const t = (frame / TWINKLE_FRAMES) * Math.PI * 2;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          if ((lightMask.data[i] ?? 0) < 128 || (tree.data[i + 3] ?? 0) === 0) continue;
          if (Math.sin(t * 2 + x * 0.7 + y * 0.5) <= TWINKLE_EDGE) continue;
          sheet.data.set([TWINKLE_LIGHT, TWINKLE_LIGHT, TWINKLE_LIGHT, 255], (y * width * TWINKLE_FRAMES + frame * width + x) * 4);
        }
      }
      twinkle.add(frame, 0, frame * width, 0, width, height);
    }
    twinkle.getContext().putImageData(sheet, 0, 0);
    twinkle.refresh();
  }
}

interface SwayingTree {
  canopy: Phaser.GameObjects.Image;
  twinkle: Phaser.GameObjects.Image;
  x: number;
  phase: number;
}

/** พุ่มใบขยับไม่เกิน 1 พิกเซล ลำต้นนิ่ง แต่ละต้นคนละจังหวะ */
export class TreeSway {
  private readonly trees: SwayingTree[] = [];

  add(scene: Phaser.Scene, tree: Phaser.GameObjects.Image, kind: number): void {
    const canopy = scene.add.image(tree.x, tree.y, canopyKey(kind)).setOrigin(tree.originX, tree.originY).setDepth(tree.depth + 0.01);
    const twinkle = scene.add
      .image(tree.x, tree.y, twinkleKey(kind), 0)
      .setOrigin(tree.originX, tree.originY)
      .setDepth(tree.depth + 0.02)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.trees.push({ canopy, twinkle, x: tree.x, phase: this.trees.length * PHASE_STEP });
  }

  update(time: number): void {
    const base = (time / SWAY_MS) * Math.PI * 2;
    for (const tree of this.trees) {
      const t = base + tree.phase;
      const x = tree.x + Math.round(SWAY_PX * Math.sin(t));
      const turn = (((t % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
      tree.canopy.setX(x);
      tree.twinkle.setX(x).setFrame(Math.floor(turn * TWINKLE_FRAMES) % TWINKLE_FRAMES);
    }
  }
}
