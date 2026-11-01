import Phaser from 'phaser';
import type { Rng } from '../core/rng';
import display from '../data/display.json';
import type { Registry } from '../data/schema';

const { lighting } = display;

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

export interface ShadeArea {
  x: number;
  y: number;
  width: number;
  height: number;
  blobs: number;
}

/** หน้ากากร่มเงาใบไม้ความละเอียดต่ำ ใช้วงไล่จางแทน filter เพราะ iPhone ไม่รองรับ filter บน canvas */
export function createCanopyMask(
  scene: Phaser.Scene,
  key: string,
  worldWidth: number,
  worldHeight: number,
  areas: ShadeArea[],
  rng: Rng,
): void {
  const divisor = lighting.maskDivisor;
  const texture = scene.textures.createCanvas(key, Math.ceil(worldWidth / divisor), Math.ceil(worldHeight / divisor));
  if (!texture) throw new Error(`could not create texture ${key}`);
  const context = texture.getContext();
  context.scale(1 / divisor, 1 / divisor);
  context.fillStyle = '#000';
  context.fillRect(0, 0, worldWidth, worldHeight);

  const softDot = (x: number, y: number, radiusX: number, radiusY: number, color: string): void => {
    context.save();
    context.translate(x, y);
    context.scale(radiusX, radiusY);
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, `rgba(${color}, 1)`);
    gradient.addColorStop(0.4, `rgba(${color}, 0.6)`);
    gradient.addColorStop(1, `rgba(${color}, 0)`);
    context.fillStyle = gradient;
    context.fillRect(-1, -1, 2, 2);
    context.restore();
  };

  for (const area of areas) {
    for (let index = 0; index < area.blobs; index += 1) {
      const radius = rng.between(lighting.blobRadiusMin, lighting.blobRadiusMax) + lighting.softEdge * 2;
      const x = area.x + rng.between(-area.width / 2, area.width / 2);
      const y = area.y + rng.between(-area.height / 2, area.height / 2);
      softDot(x, y, radius, radius * 0.8, '255, 255, 255');
    }
  }

  const screens = (worldWidth * worldHeight) / (display.baseWidth * display.baseHeight);
  for (let index = 0; index < Math.round(lighting.fleckPerScreen * screens); index += 1) {
    const radius = rng.between(lighting.fleckRadiusMin, lighting.fleckRadiusMax) + 2;
    softDot(rng.between(0, worldWidth), rng.between(0, worldHeight), radius, radius, '0, 0, 0');
  }
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
}
