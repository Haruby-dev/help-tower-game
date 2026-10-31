import Phaser from 'phaser';
import type { Registry } from '../data/schema';

type PlaceholderEntry = Extract<Registry[string], { type: 'placeholder' }>;

/** ขอบกล่องแทนภาพ เข้มกว่าสีกล่องเล็กน้อยให้เห็นว่ายังไม่ใช่ภาพจริง */
const BOX_EDGE = 0x3c2a22;
const BOX_ALPHA = 0.85;

export function createPlaceholderTexture(scene: Phaser.Scene, id: string, entry: PlaceholderEntry): void {
  const { width, height, gridSize } = entry;
  const graphics = scene.make.graphics({}, false);
  graphics.fillStyle(Phaser.Display.Color.HexStringToColor(entry.color).color, BOX_ALPHA);
  graphics.fillRect(0, 0, width, height);
  graphics.lineStyle(1, BOX_EDGE, 1);
  if (gridSize) {
    for (let x = 0; x <= width; x += gridSize) graphics.lineBetween(x + 0.5, 0, x + 0.5, height);
    for (let y = 0; y <= height; y += gridSize) graphics.lineBetween(0, y + 0.5, width, y + 0.5);
  }
  graphics.strokeRect(0.5, 0.5, width - 1, height - 1);
  graphics.generateTexture(id, width, height);
  graphics.destroy();
}

interface SoftEllipse {
  width: number;
  height: number;
  /** สีแบบ r, g, b */
  color: string;
  alpha: number;
  /** จุดที่เริ่มจางจากกลาง 0–1 */
  solidUntil: number;
}

/** วงรีไล่จางวาดลงผืนขนาดจริง ไม่ใช้ filter และไม่ต้องย่อขยาย */
export function softEllipseTexture(scene: Phaser.Scene, ellipse: SoftEllipse): string {
  const { width, height, color, alpha, solidUntil } = ellipse;
  const key = `soft_${width}x${height}_${color}_${alpha}_${solidUntil}`.replaceAll(/[ ,.]/g, '_');
  if (scene.textures.exists(key)) return key;

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`could not create texture ${key}`);
  const context = texture.getContext();
  context.translate(width / 2, height / 2);
  context.scale(width / 2, height / 2);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, `rgba(${color}, ${alpha})`);
  gradient.addColorStop(solidUntil, `rgba(${color}, ${alpha})`);
  gradient.addColorStop(1, `rgba(${color}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(-1, -1, 2, 2);
  texture.refresh();
  return key;
}

export const SHADOW_COLOR = '24, 44, 40';
export const SHADOW_ALPHA = 0.34;

export function shadowTexture(scene: Phaser.Scene, width: number, height: number): string {
  return softEllipseTexture(scene, { width, height, color: SHADOW_COLOR, alpha: SHADOW_ALPHA, solidUntil: 0.35 });
}
