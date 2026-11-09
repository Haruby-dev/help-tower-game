/**
 * รวมภาพเล็ก ๆ เป็นแผ่นใหญ่ตามหมวด เกมจะได้โหลดไม่กี่ไฟล์แทนเกือบพันไฟล์ (มือถือรอทีละไฟล์จนเปิดเกมช้า)
 * เกมตัดแผ่นกลับเป็นภาพเดิมในเครื่องตอนโหลด ทุกพิกเซลเหมือนเดิม ไม่ย่อไม่ขยาย
 *
 * หมวด: boot = ภาพที่ Phaser ใช้ตั้งแต่เปิดเกม · ui = ภาพหน้าจอ (lazy) · monster_<id> = มอนสเตอร์แต่ละตัว โหลดตอนจะมาเยี่ยม · gate<N> = ภาพในเกตบานนั้น โหลดตอนเข้าเกต
 * ไม่รวม: ชุดพื้นแผนที่ (Tiled ต้องใช้ภาพจริง) และภาพที่กว้างเกินแผ่น
 * รันเองด้วย npm run pack-atlases (fetch-assets เรียกให้ตอนจบ) · validate ตรวจว่าแผ่นตรงกับไฟล์ต้นทาง
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { monstersSchema, registrySchema, type AtlasManifest } from '../src/data/schema';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** แผ่นกว้างและสูงไม่เกินนี้ ภาพที่ใหญ่กว่านี้โหลดแยกเหมือนเดิม */
const MAX = 2048;
const GAP = 1;
const ATLAS_DIR = 'atlas';
const ROUND = 4;

type Item = { id: string; file: string };

function pythonCommand(): string {
  const local = ['.venv/Scripts/python.exe', '.venv/bin/python'].map((path) => join(projectRoot, path));
  return local.find((path) => existsSync(path)) ?? 'python';
}

const assets = join(projectRoot, 'public/assets');
const read = (file: string): PNG => PNG.sync.read(readFileSync(join(assets, file)));
export const fileHash = (file: string): string => createHash('md5').update(readFileSync(join(assets, file))).digest('hex').slice(0, 12);

/** ภาพที่รวมได้แยกตามหมวด (ชุดพื้นแผนที่และภาพกว้างเกินแผ่นไม่รวม) */
export function atlasGroups(): Map<string, Item[]> {
  const registry = registrySchema.parse(JSON.parse(readFileSync(join(projectRoot, 'assets-src/registry.json'), 'utf8')));
  const monsters = monstersSchema.parse(JSON.parse(readFileSync(join(projectRoot, 'src/data/monsters.json'), 'utf8')));
  // มอนสเตอร์แต่ละตัว (แฝดน้องอยู่หมวดเดียวกับพี่ เพราะชื่อภาพขึ้นต้นด้วยชื่อพี่)
  const monsterPrefixes = Object.entries(monsters)
    .filter(([, monster]) => monster.art && !monster.twinOf)
    .map(([id, monster]) => ({ group: `monster_${id}`, prefix: `${monster.art!.sheet}_` }));
  const groups = new Map<string, Item[]>();
  const add = (group: string, id: string, file: string): void => {
    groups.set(group, [...(groups.get(group) ?? []), { id, file }]);
  };
  for (const [id, entry] of Object.entries(registry)) {
    if (entry.type !== 'local' && entry.type !== 'character' && entry.type !== 'object') continue;
    if (!existsSync(join(assets, entry.file))) continue;
    if (entry.type !== 'character' && (entry.width > MAX || entry.height > MAX)) continue;
    const monster = monsterPrefixes.find(({ prefix }) => id.startsWith(prefix));
    const sheet = entry.type === 'character' || (entry.type === 'local' && entry.frame_width !== undefined);
    // ภาพในเกตแต่ละบาน (gate3_bg, gate3_kin_…) โหลดตอนเข้าเกตนั้น เปิดเกมจึงไม่ช้าลง
    const gate = /^(gate\d+)_/.exec(id)?.[1];
    if (gate) add(gate, id, entry.file);
    else if (monster && sheet) add(monster.group, id, entry.file);
    else if (entry.type === 'local' && entry.lazy && !sheet) add('ui', id, entry.file);
    else add('boot', id, entry.file);
  }
  return groups;
}

interface Placed {
  file: string;
  png: PNG;
  x: number;
  y: number;
}

/** วางแบบชั้นวางของ เรียงสูงไปต่ำ ชั้นเต็มขึ้นชั้นใหม่ แผ่นเต็มขึ้นแผ่นใหม่ ผลเหมือนเดิมทุกครั้งถ้าภาพเหมือนเดิม */
function pack(files: string[]): { width: number; height: number; placed: Placed[] }[] {
  const images = files.map((file) => ({ file, png: read(file) }));
  images.sort((a, b) => b.png.height - a.png.height || b.png.width - a.png.width || a.file.localeCompare(b.file));
  const area = images.reduce((sum, image) => sum + (image.png.width + GAP) * (image.png.height + GAP), 0);
  const widest = Math.max(...images.map((image) => image.png.width));
  const width = Math.min(MAX, Math.max(widest, Math.ceil(Math.sqrt(area * 1.15) / ROUND) * ROUND));
  const pages: { width: number; height: number; placed: Placed[] }[] = [];
  let page = { width, height: 0, placed: [] as Placed[] };
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const image of images) {
    if (x + image.png.width > width) {
      x = 0;
      y += shelf + GAP;
      shelf = 0;
    }
    if (y + image.png.height > MAX) {
      pages.push(page);
      page = { width, height: 0, placed: [] };
      x = 0;
      y = 0;
      shelf = 0;
    }
    page.placed.push({ file: image.file, png: image.png, x, y });
    page.height = Math.max(page.height, y + image.png.height);
    x += image.png.width + GAP;
    shelf = Math.max(shelf, image.png.height);
  }
  pages.push(page);
  return pages.map((one) => ({ ...one, height: Math.ceil(one.height / ROUND) * ROUND }));
}

export function packAtlases(): AtlasManifest {
  const directory = join(assets, ATLAS_DIR);
  if (existsSync(directory)) for (const old of readdirSync(directory)) rmSync(join(directory, old));
  mkdirSync(directory, { recursive: true });
  const manifest: AtlasManifest = { pages: [], frames: {}, hashes: {} };
  for (const [group, items] of [...atlasGroups().entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const files = [...new Set(items.map((item) => item.file))].sort();
    const where = new Map<string, [number, number, number, number, number]>();
    pack(files).forEach((page, index) => {
      const out = new PNG({ width: page.width, height: page.height });
      out.data.fill(0);
      for (const placed of page.placed) {
        PNG.bitblt(placed.png, out, 0, 0, placed.png.width, placed.png.height, placed.x, placed.y);
        where.set(placed.file, [manifest.pages.length, placed.x, placed.y, placed.png.width, placed.png.height]);
      }
      const png = `${ATLAS_DIR}/${group}_${index}.png`;
      writeFileSync(join(assets, png), PNG.sync.write(out, { deflateLevel: 9 }));
      // WebP แบบไม่เสียรายละเอียดเล็กกว่า PNG ราว 4 เท่า สคริปต์ตรวจทุกพิกเซลหลังแปลง
      execFileSync(pythonCommand(), [join(projectRoot, 'tools/webp_lossless.py'), join(assets, png)]);
      manifest.pages.push({ group, file: png.replace(/.png$/, '.webp'), width: page.width, height: page.height });
    });
    for (const item of items.sort((a, b) => a.id.localeCompare(b.id))) manifest.frames[item.id] = where.get(item.file)!;
    for (const file of files) manifest.hashes[file] = fileHash(file);
  }
  writeFileSync(join(projectRoot, 'src/data/atlas.json'), `${JSON.stringify(manifest)}\n`);
  return manifest;
}

if (process.argv[1]?.endsWith('pack-atlases.ts')) {
  const manifest = packAtlases();
  const groups = [...new Set(manifest.pages.map((page) => page.group))];
  console.log(`atlas: ${Object.keys(manifest.frames).length} images in ${manifest.pages.length} sheets (${groups.length} groups)`);
}
