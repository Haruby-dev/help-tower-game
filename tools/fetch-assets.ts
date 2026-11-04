import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import {
  registrySchema,
  type CharacterEntry,
  type LocalEntry,
  type LocalTilesetEntry,
  type ObjectEntry,
  type Registry,
  type SpriteMeta,
  type TilesetEntry,
  type TilesetMeta,
} from '../src/data/schema';
import { projectRoot } from './checks';
import { buildHopSheet, steadyWalkRow } from './sprite-fix';

async function downloadBytes(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function downloadPng(url: string): Promise<PNG> {
  return PNG.sync.read(await downloadBytes(url));
}

/** ไฟล์เดิมที่พิกเซลเหมือนกันทุกจุดไม่เขียนทับ ไฟล์ที่ฝั่งวางแผนบีบอัดมาเล็กกว่าจะได้ไม่เปลี่ยนใน git */
function samePixels(target: string, png: PNG): boolean {
  if (!existsSync(target)) return false;
  const old = PNG.sync.read(readFileSync(target));
  return old.width === png.width && old.height === png.height && old.data.equals(png.data);
}

function savePng(file: string, png: PNG): void {
  const target = join(projectRoot, 'public/assets', file);
  if (samePixels(target, png)) return;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, PNG.sync.write(png));
}

/** แถวล่างสุดที่มีภาพ นับเป็นความสูงจากขอบบนของเฟรม */
function lowestRow(png: PNG, left: number, top: number, width: number, height: number): number {
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      if ((png.data[((top + y) * png.width + left + x) * 4 + 3] ?? 0) > 0) return y + 1;
    }
  }
  throw new Error('frame is empty');
}

function median(values: number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
}

/** ตัวเอกผิวสว่างที่ผู้ใช้อนุมัติ 4 พ.ย. 2026 ฝั่งวางแผนสลับสีบนแผ่นที่สร้างเสร็จแล้ว ภาพใน PixelLab ยังเป็นผิวเดิม */
const FAIR_SKIN_DIR = 'assets-src/skin_fair_1104';

/** ใช้แผ่นผิวสว่างแทนแผ่นที่เพิ่งสร้าง จุดเท้ายังวัดจากแผ่นที่สร้าง เพราะสลับแค่สี ไม่ได้ย้ายพิกเซล */
function fairSkinSheet(id: string, processed: PNG): PNG | null {
  const path = join(projectRoot, FAIR_SKIN_DIR, `${id}.png`);
  if (!existsSync(path)) return null;
  const fair = PNG.sync.read(readFileSync(path));
  if (fair.width !== processed.width || fair.height !== processed.height) {
    throw new Error(`${FAIR_SKIN_DIR}/${id}.png is ${fair.width}x${fair.height}, expected ${processed.width}x${processed.height}`);
  }
  return fair;
}

async function fetchCharacter(id: string, entry: CharacterEntry, meta: SpriteMeta): Promise<void> {
  const directions = Object.entries(entry.directions);
  const sheet = new PNG({
    width: entry.frameWidth * entry.frameCount,
    height: entry.frameHeight * directions.length,
  });
  const footY: Record<string, number> = {};

  for (const [row, [direction, urlTemplate]] of directions.entries()) {
    const rows: number[] = [];
    for (let index = 0; index < entry.frameCount; index += 1) {
      const frame = await downloadPng(urlTemplate.replace('{i}', String(index)));
      if (frame.width > entry.frameWidth || frame.height > entry.frameHeight) {
        throw new Error(
          `${id} ${direction} frame ${index} is ${frame.width}x${frame.height}, larger than ${entry.frameWidth}x${entry.frameHeight}`,
        );
      }
      // PixelLab ให้ผืนคนละขนาดในแต่ละทิศ โดยตัวละครอยู่กลางผืนเสมอ จึงจัดกึ่งกลางลงช่องขนาดเดียวกัน
      const padX = (entry.frameWidth - frame.width) / 2;
      const padY = (entry.frameHeight - frame.height) / 2;
      PNG.bitblt(
        frame,
        sheet,
        0,
        0,
        frame.width,
        frame.height,
        index * entry.frameWidth + padX,
        row * entry.frameHeight + padY,
      );
      rows.push(padY + lowestRow(frame, 0, 0, frame.width, frame.height));
    }
    footY[direction] = median(rows);
  }

  for (const [direction, fix] of Object.entries(entry.steady_rows ?? {})) {
    steadyWalkRow(sheet, directions.findIndex(([name]) => name === direction), entry.frameWidth, entry.frameHeight, entry.frameCount, fix);
  }
  const processed = entry.squash_stretch
    ? buildHopSheet(sheet, entry.frameWidth, entry.frameHeight, directions.length, entry.squash_stretch)
    : sheet;
  savePng(entry.file, fairSkinSheet(id, processed) ?? processed);
  meta[id] = { footY };
  console.log(`${id}: saved ${directions.length} directions, ${entry.frameCount} frames each`);
}

async function fetchObject(id: string, entry: ObjectEntry, meta: SpriteMeta): Promise<void> {
  const image = await downloadPng(entry.url);
  if (image.width !== entry.width || image.height !== entry.height) {
    throw new Error(`${id} is ${image.width}x${image.height}, expected ${entry.width}x${entry.height}`);
  }
  savePng(entry.file, image);
  meta[id] = { footY: { default: lowestRow(image, 0, 0, image.width, image.height) } };
  console.log(`${id}: saved`);
}

function copyLocal(id: string, entry: LocalEntry, meta: SpriteMeta): void {
  const image = PNG.sync.read(readFileSync(join(projectRoot, entry.source)));
  if (image.width !== entry.width || image.height !== entry.height) {
    throw new Error(`${id} is ${image.width}x${image.height}, expected ${entry.width}x${entry.height}`);
  }
  savePng(entry.file, image);
  meta[id] = { footY: { default: lowestRow(image, 0, 0, image.width, image.height) } };
  console.log(`${id}: copied`);
}

interface RawTile {
  corners: TilesetMeta[number]['corners'];
  bounding_box: { x: number; y: number; width: number; height: number };
  pattern_4x4: { row_0: number[]; row_3: number[] };
}

const EMPTY_PATTERN = 255;

function tilesetBase(entry: { pixellabId: string }): string {
  return `https://api.pixellab.ai/mcp/tilesets/${entry.pixellabId}`;
}

const CORNER_SAMPLE_SIZE = 6;
const CORNER_OFFSETS = { NW: [1, 1], NE: [25, 1], SW: [1, 25], SE: [25, 25] } as const;
type Rgb = readonly [number, number, number];
const colorDistance = (a: Rgb, b: Rgb): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function meanColor(image: PNG, left: number, top: number): Rgb {
  const total = [0, 0, 0];
  for (let y = 0; y < CORNER_SAMPLE_SIZE; y += 1) {
    for (let x = 0; x < CORNER_SAMPLE_SIZE; x += 1) {
      const at = ((top + y) * image.width + left + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) total[channel]! += image.data[at + channel] ?? 0;
    }
  }
  const pixels = CORNER_SAMPLE_SIZE ** 2;
  return [total[0]! / pixels, total[1]! / pixels, total[2]! / pixels];
}

/** ชุดพื้นใหม่ค่า corners ใน metadata ไม่ตรงกับภาพ จึงอ่านมุมจากพิกเซล สีที่ไกลจากพื้นล่างที่สุดคือพื้นบน */
function cornersFromPixels(image: PNG, lowerRgb: Rgb): TilesetMeta {
  const columns = image.width / 32;
  const rows = image.height / 32;
  const positions = Array.from({ length: columns * rows }, (_, index) => ({
    index,
    left: (index % columns) * 32,
    top: Math.floor(index / columns) * 32,
  }));
  const colorAt = (position: { left: number; top: number }, [dx, dy]: readonly [number, number]): Rgb =>
    meanColor(image, position.left + dx, position.top + dy);
  const samples = positions.flatMap((position) =>
    Object.values(CORNER_OFFSETS).map((offset) => colorAt(position, offset)),
  );
  const upperRgb = samples.reduce((far, color) =>
    colorDistance(color, lowerRgb) > colorDistance(far, lowerRgb) ? color : far,
  );
  const side = (color: Rgb): 'lower' | 'upper' =>
    colorDistance(color, lowerRgb) <= colorDistance(color, upperRgb) ? 'lower' : 'upper';
  return positions.map((position) => ({
    index: position.index,
    corners: {
      NW: side(colorAt(position, CORNER_OFFSETS.NW)),
      NE: side(colorAt(position, CORNER_OFFSETS.NE)),
      SW: side(colorAt(position, CORNER_OFFSETS.SW)),
      SE: side(colorAt(position, CORNER_OFFSETS.SE)),
    },
    hinted: false,
  }));
}

function copyLocalTileset(id: string, entry: LocalTilesetEntry): void {
  const image = PNG.sync.read(readFileSync(join(projectRoot, entry.source)));
  savePng(entry.file, image);
  writeTilesetMeta(entry.metaFile, cornersFromPixels(image, entry.lower_rgb));
  console.log(`${id}: copied, corners read from pixels`);
}

function writeTilesetMeta(metaFile: string, tiles: TilesetMeta): void {
  const metaTarget = join(projectRoot, metaFile);
  mkdirSync(dirname(metaTarget), { recursive: true });
  writeFileSync(metaTarget, `${JSON.stringify(tiles, null, 2)}\n`);
}

async function fetchTileset(id: string, entry: TilesetEntry): Promise<void> {
  const image = await downloadPng(`${tilesetBase(entry)}/image?inline=true`);
  const raw = JSON.parse((await downloadBytes(`${tilesetBase(entry)}/metadata`)).toString('utf8')) as {
    tileset_data: { tiles: RawTile[] };
  };
  const columns = image.width / 32;
  const tiles: TilesetMeta = raw.tileset_data.tiles.map((tile) => ({
    index: (tile.bounding_box.y / 32) * columns + tile.bounding_box.x / 32,
    corners: tile.corners,
    hinted: [...tile.pattern_4x4.row_0, ...tile.pattern_4x4.row_3].some((value) => value !== EMPTY_PATTERN),
  }));

  savePng(entry.file, image);
  writeTilesetMeta(entry.metaFile, tiles);
  console.log(`${id}: saved ${tiles.length} tiles`);
}

function pythonCommand(): string {
  const local = ['.venv/Scripts/python.exe', '.venv/bin/python'].map((path) => join(projectRoot, path));
  return local.find((path) => existsSync(path)) ?? 'python';
}

/** ลงสีโทนหยกตอนสร้างภาพเท่านั้น ทำหลังไฟล์ทุกชิ้นถูกเขียนใหม่แล้ว จึงไม่มีภาพที่โดนลงสีซ้ำ */
function applyJadeTone(entries: Registry): void {
  const python = pythonCommand();
  const rawDirectory = mkdtempSync(join(tmpdir(), 'jade-tone-'));
  const target = (file: string): string => join(projectRoot, 'public/assets', file);
  const rawFile = (id: string): string => join(rawDirectory, `${id}.png`);
  const toned = Object.entries(entries).flatMap(([id, entry]) =>
    (entry.type === 'object' || entry.type === 'tileset' || entry.type === 'local' || entry.type === 'local_tileset') &&
    entry.jade_tone
      ? [{ id, entry }]
      : [],
  );

  try {
    for (const { id, entry } of toned) copyFileSync(target(entry.file), rawFile(id));
    for (const { id, entry } of toned) {
      // jade_tone.py ลงสีภาพอ้างอิงเอง จึงต้องส่งต้นไม้ที่ยังไม่ได้ลงสี
      const houseRef = entry.type === 'local' ? entry.jade_tone_house_ref : undefined;
      const extra = houseRef ? ['--house', rawFile(houseRef)] : [];
      execFileSync(python, [join(projectRoot, 'tools/jade_tone.py'), rawFile(id), target(entry.file), ...extra]);
    }
  } finally {
    rmSync(rawDirectory, { recursive: true, force: true });
  }
  console.log(`jade tone: ${toned.length} images`);
}

const registry = registrySchema.parse(
  JSON.parse(readFileSync(join(projectRoot, 'assets-src/registry.json'), 'utf8')),
);
const meta: SpriteMeta = {};

for (const [id, entry] of Object.entries(registry)) {
  if (entry.type === 'character') await fetchCharacter(id, entry, meta);
  else if (entry.type === 'object') await fetchObject(id, entry, meta);
  else if (entry.type === 'tileset') await fetchTileset(id, entry);
  else if (entry.type === 'local') copyLocal(id, entry, meta);
  else if (entry.type === 'local_tileset') copyLocalTileset(id, entry);
}

applyJadeTone(registry);

writeFileSync(join(projectRoot, 'src/data/sprite-meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
