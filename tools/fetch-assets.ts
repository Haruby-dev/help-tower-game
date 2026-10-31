import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import {
  registrySchema,
  type CharacterEntry,
  type LocalEntry,
  type ObjectEntry,
  type SpriteMeta,
  type TilesetEntry,
  type TilesetMeta,
} from '../src/data/schema';
import { projectRoot } from './checks';

async function downloadBytes(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function downloadPng(url: string): Promise<PNG> {
  return PNG.sync.read(await downloadBytes(url));
}

function savePng(file: string, png: PNG): void {
  const target = join(projectRoot, 'public/assets', file);
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

  savePng(entry.file, sheet);
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

async function fetchTileset(id: string, entry: TilesetEntry): Promise<void> {
  const base = `https://api.pixellab.ai/mcp/tilesets/${entry.pixellabId}`;
  const image = await downloadPng(`${base}/image?inline=true`);
  const raw = JSON.parse((await downloadBytes(`${base}/metadata`)).toString('utf8')) as {
    tileset_data: { tiles: RawTile[] };
  };
  const columns = image.width / 32;
  const tiles: TilesetMeta = raw.tileset_data.tiles.map((tile) => ({
    index: (tile.bounding_box.y / 32) * columns + tile.bounding_box.x / 32,
    corners: tile.corners,
    hinted: [...tile.pattern_4x4.row_0, ...tile.pattern_4x4.row_3].some((value) => value !== EMPTY_PATTERN),
  }));

  savePng(entry.file, image);
  const metaTarget = join(projectRoot, entry.metaFile);
  mkdirSync(dirname(metaTarget), { recursive: true });
  writeFileSync(metaTarget, `${JSON.stringify(tiles, null, 2)}\n`);
  console.log(`${id}: saved ${tiles.length} tiles`);
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
}

writeFileSync(join(projectRoot, 'src/data/sprite-meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
