import Phaser from 'phaser';
import type { MonsterData } from '../data/schema';
import balance from '../data/balance.json';

export type MonsterArt = NonNullable<MonsterData[string]['art']>;
export type SheetKind = 'stand' | 'walk' | 'eat';
export const SHEET_KINDS: SheetKind[] = ['stand', 'walk', 'eat'];
export const DIRECTIONS = ['south', 'east', 'north', 'west'] as const;
export type Facing = (typeof DIRECTIONS)[number];

const { eyeSteps } = balance.monsters;
/** สีเนื้ออาหารจิ๋วบนจาน คิดจากสีที่สดที่สุดของไอคอนอาหาร (ข้ามพิกเซลสีขาวเทาของจานใบตอง) */
const DULL_SPREAD = 40;
const MOUND = { width: 9, height: 4 };
const PLATE = { width: 11, height: 4 };

const hex = (value: string): [number, number, number] => [1, 3, 5].map((at) => Number.parseInt(value.slice(at, at + 2), 16)) as [number, number, number];

/**
 * ชื่อภาพของมอนสเตอร์ตามระดับความชอบ
 * level 0 คือภาพหิว (ตาแดง) · 1..eyeSteps-1 คือภาพหิวที่สีตาค่อย ๆ เปลี่ยนเป็นสีตาตอนหวาน · 'sweet' คือภาพหวาน (ครบ 100%)
 */
export function sheetKey(art: MonsterArt, level: number | 'sweet', kind: SheetKind): string {
  if (level === 'sweet') return `${art.sheet}_sweet_${kind}`;
  return level <= 0 ? `${art.sheet}_hungry_${kind}` : `${art.sheet}_eye${level}_${kind}`;
}

/** ระดับสีตาจากเปอร์เซ็นต์ความชอบ */
export function eyeLevel(percent: number, cleared: boolean): number | 'sweet' {
  if (cleared) return 'sweet';
  return Math.min(eyeSteps - 1, Math.max(0, Math.floor((percent / 100) * eyeSteps)));
}

function pixels(scene: Phaser.Scene, key: string): ImageData {
  const source = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(source, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** เพิ่มภาพจาก canvas แล้วแบ่งเฟรมเท่า ๆ กันเหมือน spritesheet */
function addSheet(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, frame: number): void {
  const texture = scene.textures.addCanvas(key, canvas)!;
  const columns = Math.floor(canvas.width / frame);
  const rows = Math.floor(canvas.height / frame);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) texture.add(row * columns + column, 0, column * frame, row * frame, frame, frame);
  }
}

/** สร้างภาพช่วงกลาง: เปลี่ยนเฉพาะพิกเซลสีตาตอนหิว ไล่เข้าหาสีที่ตำแหน่งเดียวกันในภาพหวาน (พิกเซลคมเหมือนเดิม ไม่เบลอ) */
function makeEyeSheets(scene: Phaser.Scene, art: MonsterArt): void {
  const [eyeRed, eyeGreen, eyeBlue] = hex(art.hungryEye);
  for (const kind of SHEET_KINDS) {
    const hungry = pixels(scene, sheetKey(art, 0, kind));
    const sweet = pixels(scene, sheetKey(art, 'sweet', kind));
    for (let level = 1; level < eyeSteps; level += 1) {
      const key = sheetKey(art, level, kind);
      if (scene.textures.exists(key)) continue;
      const mix = level / eyeSteps;
      const data = new ImageData(new Uint8ClampedArray(hungry.data), hungry.width, hungry.height);
      for (let at = 0; at < data.data.length; at += 4) {
        if (data.data[at + 3] === 0 || data.data[at] !== eyeRed || data.data[at + 1] !== eyeGreen || data.data[at + 2] !== eyeBlue) continue;
        for (let channel = 0; channel < 3; channel += 1) {
          data.data[at + channel] = Math.round(data.data[at + channel]! + (sweet.data[at + channel]! - data.data[at + channel]!) * mix);
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = data.width;
      canvas.height = data.height;
      canvas.getContext('2d')!.putImageData(data, 0, 0);
      addSheet(scene, key, canvas, art.frame);
    }
  }
}

function makeAnimations(scene: Phaser.Scene, art: MonsterArt, level: number | 'sweet'): void {
  const walk = sheetKey(art, level, 'walk');
  if (scene.anims.exists(`${walk}_south`)) return;
  const walkFrames = 6;
  DIRECTIONS.forEach((facing, row) => {
    scene.anims.create({
      key: `${walk}_${facing}`,
      frames: scene.anims.generateFrameNumbers(walk, { start: row * walkFrames, end: row * walkFrames + walkFrames - 1 }),
      frameRate: 1000 / art.walkMs,
      repeat: -1,
    });
  });
  const eat = sheetKey(art, level, 'eat');
  scene.anims.create({ key: `${eat}_once`, frames: scene.anims.generateFrameNumbers(eat, { frames: art.eatFrames }), frameRate: 1000 / art.eatMs, repeat: 0 });
}

/** ภาพและท่าทุกระดับของมอนสเตอร์ตัวนี้ สร้างครั้งแรกที่มาเยี่ยม */
export function prepareMonsterArt(scene: Phaser.Scene, art: MonsterArt): void {
  makeEyeSheets(scene, art);
  for (let level = 0; level < eyeSteps; level += 1) makeAnimations(scene, art, level);
  makeAnimations(scene, art, 'sweet');
}

function vividColor(scene: Phaser.Scene, key: string): [number, number, number] {
  if (!scene.textures.exists(key)) return [214, 150, 90];
  const data = pixels(scene, key).data;
  const counts = new Map<string, number>();
  for (let at = 0; at < data.length; at += 4) {
    if (data[at + 3]! < 200) continue;
    const color = [data[at]!, data[at + 1]!, data[at + 2]!];
    if (Math.max(...color) - Math.min(...color) < DULL_SPREAD) continue;
    const name = color.join(',');
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  // สีที่สดและพบบ่อย: นับจำนวน × ความสด
  let best: [number, number, number] = [214, 150, 90];
  let bestScore = 0;
  for (const [name, count] of counts) {
    const color = name.split(',').map(Number) as [number, number, number];
    const score = count * (Math.max(...color) - Math.min(...color));
    if (score > bestScore) {
      bestScore = score;
      best = color;
    }
  }
  return best;
}

const shade = (color: [number, number, number], amount: number): string =>
  `rgb(${color.map((channel) => Math.max(0, Math.min(255, Math.round(channel * amount)))).join(',')})`;

/**
 * อาหารจิ๋ววาดด้วยโค้ด (ยังไม่มีภาพอาหารเล็กพอวางบนจานถาด) กองสีตามไอคอนอาหาร มีขอบเข้มและไฮไลต์
 * ใช้ทั้งบนจานถาดและหอคอยอาหารที่มอนสเตอร์ถือ
 */
export function foodMoundKey(scene: Phaser.Scene, recipe: string, icon: string | undefined): string {
  const key = `tray_food_${recipe}`;
  if (scene.textures.exists(key)) return key;
  const color = vividColor(scene, icon ?? '');
  const canvas = document.createElement('canvas');
  canvas.width = MOUND.width;
  canvas.height = MOUND.height;
  const context = canvas.getContext('2d')!;
  const rows = [
    [2, 6],
    [1, 7],
    [0, 8],
    [1, 7],
  ];
  rows.forEach(([from, to], y) => {
    context.fillStyle = y === 3 ? shade(color, 0.62) : shade(color, 1);
    context.fillRect(from!, y, to! - from! + 1, 1);
  });
  context.fillStyle = shade(color, 0.62);
  context.fillRect(0, 2, 1, 1);
  context.fillRect(8, 2, 1, 1);
  context.fillStyle = shade(color, 1.35);
  context.fillRect(3, 1, 2, 1);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** จานขาวเล็กใต้อาหารแต่ละชั้นของหอคอย */
export function miniPlateKey(scene: Phaser.Scene): string {
  const key = 'tower_plate';
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = PLATE.width;
  canvas.height = PLATE.height;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#5c304c';
  context.fillRect(1, 0, 9, 1);
  context.fillRect(0, 1, 1, 2);
  context.fillRect(10, 1, 1, 2);
  context.fillRect(1, 3, 9, 1);
  context.fillStyle = '#fff6f0';
  context.fillRect(1, 1, 9, 2);
  context.fillStyle = '#d9c8d0';
  context.fillRect(2, 2, 7, 1);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** ละอองหิวสีม่วงหม่น 1×1 กับ 2×2 พิกเซล ลอยขึ้นรอบตัวตอนยังหิว จางลงเมื่อชอบมากขึ้น */
export function moteKey(scene: Phaser.Scene, big: boolean): string {
  const key = big ? 'monster_mote_2' : 'monster_mote_1';
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = big ? 2 : 1;
  canvas.height = big ? 2 : 1;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#7d5a9e';
  context.fillRect(0, 0, canvas.width, canvas.height);
  scene.textures.addCanvas(key, canvas);
  return key;
}
