import type Phaser from 'phaser';
import atlasJson from '../data/atlas.json';
import type { AtlasManifest } from '../data/schema';
import { assetUrl, registry } from './assets';

/**
 * แผ่นรวมภาพ (tools/pack-atlases.ts): โหลดไม่กี่ไฟล์แล้วตัดกลับเป็นภาพเดิมในเครื่อง ทุกพิกเซลเหมือนเดิม
 * ภาพที่ตัดแล้วเก็บเป็น canvas ชื่อเดิม Phaser ใช้เป็นภาพปกติ หน้าจอ HTML ได้ที่อยู่ภาพจาก canvas เดียวกัน
 * หมวด boot โหลดตอนเปิดเกม · ui โหลดตอนหน้าจอโหลด · monster_<id> โหลดตอนมอนสเตอร์ตัวนั้นจะมาเยี่ยม
 */
const manifest = atlasJson as unknown as AtlasManifest;
const slices = new Map<string, HTMLCanvasElement>();
const urls = new Map<string, string>();
const groups = new Map<string, Promise<void>>();
const failed = new Set<string>();

/** หมวดที่ภาพนี้อยู่ ไม่ได้รวมไว้ตอบ null (โหลดไฟล์เดี่ยวเหมือนเดิม) */
export function atlasGroupOf(id: string): string | null {
  const frame = manifest.frames[id];
  return frame ? manifest.pages[frame[0]]!.group : null;
}

/** รหัสภาพทั้งหมดในหมวดนี้ */
export const idsInGroup = (group: string): string[] => Object.keys(manifest.frames).filter((id) => atlasGroupOf(id) === group);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
}

/** โหลดแผ่นของหมวดนี้แล้วตัดเป็นภาพเดิม (เรียกซ้ำได้ ได้งานเดิม) */
export function loadAtlasGroup(group: string): Promise<void> {
  const known = groups.get(group);
  if (known) return known;
  const pages = manifest.pages.map((page, index) => ({ page, index })).filter(({ page }) => page.group === group);
  const job = Promise.all(pages.map(({ page, index }) => loadImage(assetUrl(page.file)).then((image) => ({ image, index }))))
    .then((images) => {
      const byPage = new Map(images.map(({ image, index }) => [index, image]));
      for (const id of idsInGroup(group)) {
        const [page, x, y, width, height] = manifest.frames[id]!;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(byPage.get(page)!, x, y, width, height, 0, 0, width, height);
        slices.set(id, canvas);
      }
    })
    .catch((error: unknown) => {
      failed.add(group);
      throw error;
    });
  groups.set(group, job);
  return job;
}

export const atlasGroupFailed = (group: string): boolean => failed.has(group);

/**
 * ที่อยู่ภาพสำหรับหน้าจอ HTML ถ้าตัดจากแผ่นแล้ว ไม่งั้นตอบ null (ใช้ไฟล์เดี่ยว)
 * ต่อท้ายด้วย #ชื่อไฟล์เดิม เบราว์เซอร์ไม่นำส่วนนี้ไปถอดภาพ แต่คนดีบักและเทสต์ยังเห็นว่าเป็นภาพไหน
 */
export function sliceUrl(id: string): string | null {
  const known = urls.get(id);
  if (known) return known;
  const canvas = slices.get(id);
  if (!canvas) return null;
  const entry = registry[id];
  const name = entry && 'file' in entry ? entry.file : id;
  const url = `${canvas.toDataURL('image/png')}#${name}`;
  urls.set(id, url);
  return url;
}

/** ขนาดเฟรมของภาพชุด (spritesheet) ภาพเดี่ยวตอบ null */
function frameSize(id: string): { width: number; height: number } | null {
  const entry = registry[id];
  if (entry?.type === 'character') return { width: entry.frameWidth, height: entry.frameHeight };
  if (entry?.type === 'local' && entry.frame_width && entry.frame_height) return { width: entry.frame_width, height: entry.frame_height };
  return null;
}

/** ใส่ภาพที่ตัดแล้วของหมวดนี้เข้า Phaser ชื่อเดิม ภาพชุดแบ่งเฟรมเรียงซ้ายไปขวา บนลงล่างเหมือนตัวโหลดของ Phaser */
export function registerAtlasGroup(textures: Phaser.Textures.TextureManager, group: string): void {
  for (const id of idsInGroup(group)) {
    if (textures.exists(id)) continue;
    const canvas = slices.get(id);
    if (!canvas) continue;
    const texture = textures.addCanvas(id, canvas)!;
    const size = frameSize(id);
    if (!size) continue;
    const columns = Math.floor(canvas.width / size.width);
    const rows = Math.floor(canvas.height / size.height);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) texture.add(row * columns + column, 0, column * size.width, row * size.height, size.width, size.height);
    }
  }
}

/** ใส่ภาพเดี่ยวที่ตัดแล้วเข้า Phaser ตอนต้องใช้ (เช่น ผักจิ๋วของหมวด ui ในมือตอนกิน) ยังไม่ได้ตัดตอบ false */
export function registerSlice(textures: Phaser.Textures.TextureManager, id: string): boolean {
  if (textures.exists(id)) return true;
  const canvas = slices.get(id);
  if (!canvas) return false;
  textures.addCanvas(id, canvas);
  return true;
}
