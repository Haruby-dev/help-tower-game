import Phaser from 'phaser';
import type { MonsterData } from '../data/schema';
import { parseSet, setTable } from '../systems/sets';
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

const hex = (value: string): [number, number, number] => [1, 3, 5].map((at) => Number.parseInt(value.slice(at, at + 2), 16)) as [number, number, number];

/**
 * ชื่อภาพของมอนสเตอร์ตามระดับความชอบ
 * level 0 คือภาพหิว (ตาแดง) · 1..eyeSteps-1 คือภาพหิวที่สีตาค่อย ๆ เปลี่ยนเป็นสีตาตอนหวาน · 'sweet' คือภาพหวาน (ครบ 100%)
 */
export function sheetKey(art: MonsterArt, level: number | 'sweet', kind: SheetKind): string {
  if (level === 'sweet') return `${art.sheet}_sweet_${kind}`;
  // ภาพหิววาดมาครบแล้ว (ไม่มีสีตาให้ไล่) ใช้ภาพหิวจนครบ 100%
  return level <= 0 || art.hungryEye === null ? `${art.sheet}_hungry_${kind}` : `${art.sheet}_eye${level}_${kind}`;
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
  if (art.hungryEye === null) return;
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
  // ผู้เฝ้าทุ่งกระโดดบนฐาน เวลาแต่ละเฟรมไม่เท่ากัน Phaser ใช้ duration ของเฟรมแทนเวลาปกติ
  const perFrame = Array.isArray(art.walkMs) ? art.walkMs : null;
  const walkMs = perFrame ? Math.min(...perFrame) : (art.walkMs as number);
  DIRECTIONS.forEach((facing, row) => {
    const frames = scene.anims.generateFrameNumbers(walk, { start: row * walkFrames, end: row * walkFrames + walkFrames - 1 });
    scene.anims.create({
      key: `${walk}_${facing}`,
      frames: perFrame ? frames.map((frame, index) => ({ ...frame, duration: perFrame[index % perFrame.length] })) : frames,
      frameRate: 1000 / walkMs,
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

/** ท่าพิเศษของแฝดชั้น 5 ชื่อลงท้าย _once คือเล่นครั้งเดียวแล้วกลับไปท่ายืน */
export const TWIN_ANIMS = {
  shake: 'monster_tangkrading_b_shake_once',
  giggle: 'monster_tangkrading_a_giggle_once',
  runEast: 'monster_tangkrading_a_run_east',
  runWest: 'monster_tangkrading_a_run_west',
  jumpA: 'monster_tangkrading_a_jump_once',
  jumpB: 'monster_tangkrading_b_jump_once',
} as const;

/** สร้างท่าพิเศษของแฝดตามเวลาในเอกสารส่งงาน (สะบัดฟาง 20 เฟรม เฟรมแรกกับเฟรมท้ายค้างนานกว่า) */
export function prepareTwinArt(scene: Phaser.Scene): void {
  if (scene.anims.exists(TWIN_ANIMS.shake)) return;
  const { shakeMs, giggleMs, giggleRepeat, runMs, jumpMs } = balance.monsters.twins;
  const shakeSheet = 'monster_tangkrading_b_shake';
  const shake = scene.anims.generateFrameNumbers(shakeSheet, { start: 0, end: 19 });
  scene.anims.create({
    key: TWIN_ANIMS.shake,
    frames: shake.map((frame, index) => ({ ...frame, duration: index === 0 ? shakeMs.first : index === shake.length - 1 ? shakeMs.last : shakeMs.middle })),
    frameRate: 1000 / shakeMs.middle,
    repeat: 0,
  });
  const giggleRun = 'monster_tangkrading_a_giggle_run';
  const RUN_FRAMES = 6;
  scene.anims.create({ key: TWIN_ANIMS.giggle, frames: scene.anims.generateFrameNumbers(giggleRun, { start: 0, end: 2 }), frameRate: 1000 / giggleMs, repeat: giggleRepeat - 1 });
  scene.anims.create({ key: TWIN_ANIMS.runEast, frames: scene.anims.generateFrameNumbers(giggleRun, { start: RUN_FRAMES, end: RUN_FRAMES * 2 - 1 }), frameRate: 1000 / runMs, repeat: -1 });
  scene.anims.create({ key: TWIN_ANIMS.runWest, frames: scene.anims.generateFrameNumbers(giggleRun, { start: RUN_FRAMES * 2, end: RUN_FRAMES * 3 - 1 }), frameRate: 1000 / runMs, repeat: -1 });
  scene.anims.create({ key: TWIN_ANIMS.jumpA, frames: scene.anims.generateFrameNumbers('monster_tangkrading_a_jump', { start: 0, end: 5 }), frameRate: 1000 / jumpMs, repeat: 0 });
  scene.anims.create({ key: TWIN_ANIMS.jumpB, frames: scene.anims.generateFrameNumbers('monster_tangkrading_b_jump', { start: 0, end: 5 }), frameRate: 1000 / jumpMs, repeat: 0 });
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
 * อาหารจิ๋ววาดด้วยโค้ด กองสีตามไอคอนอาหาร มีขอบเข้มและไฮไลต์
 * ใช้แทนเมนูที่ยังไม่มีภาพ tray_mini (ตอนนี้คือน้ำสตรอว์เบอร์รี) ทั้งบนจานถาดและหอคอย
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

/** อาหารจิ๋วบนจานถาดและหอคอย: ใช้ภาพ tray_mini (ราว 9 พิกเซล ฝั่งวางแผนทำ 6 พ.ย. 2026) เมนูที่ยังไม่มีภาพ (น้ำสตรอว์เบอร์รี) ใช้กองสีวาดด้วยโค้ด */
/** ชุดอาหารบนจานถาดหอคอยและบนหอคอยเหนือหัวมอนสเตอร์: ไอคอนถาดสานจิ๋วขนาดจริงตามขนาดถาด (ไม่ย่อภาพชุด) null คือไม่ใช่ชุด */
export function setArtKey(item: string): string | null {
  const parts = parseSet(item);
  return parts ? `ing_mini_${setTable.trays[parts.size].item}` : null;
}

export function foodArtKey(scene: Phaser.Scene, recipe: string, icon: string | undefined): string {
  const art = `tray_mini_${recipe}`;
  return scene.textures.exists(art) ? art : foodMoundKey(scene, recipe, icon);
}

const topRows = new Map<string, number>();

/** จำนวนแถวโปร่งด้านบนของภาพ (ภาพอาหารจิ๋วบางชิ้นเว้นแถวบนไว้ 1 แถว) ใช้วางจานชั้นถัดไปของหอคอยบนพิกเซลที่เห็นจริง */
export function artTopPx(scene: Phaser.Scene, key: string): number {
  const known = topRows.get(key);
  if (known !== undefined) return known;
  const { data, width, height } = pixels(scene, key);
  let top = 0;
  while (top < height - 1 && !Array.from({ length: width }, (_, x) => data[(top * width + x) * 4 + 3]!).some((alpha) => alpha > 0)) top += 1;
  topRows.set(key, top);
  return top;
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
