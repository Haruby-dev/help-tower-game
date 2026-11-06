import { assetUrl, registry } from '../core/assets';
import { atlasGroupOf, loadAtlasGroup } from '../core/atlas';

/** เก็บภาพที่ถอดรหัสแล้วไว้ เบราว์เซอร์จะได้ไม่ทิ้งก่อนเปิดหน้าต่าง */
const kept: HTMLImageElement[] = [];
const REVEAL_LIMIT_MS = 1500;
/** ภาพที่ Phaser โหลดแล้วแต่หน้าจอใช้ด้วย (ป้ายดาว หัวใจบนป้ายชื่อมอนสเตอร์) โหลดไว้ก่อนเหมือนกัน */
const ALSO_IN_INTERFACE = ['star_badge_1', 'star_badge_2', 'star_badge_3', 'fx_heart_5'];

const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * ภาพหน้าจอทุกชิ้นที่ Phaser ไม่ได้โหลด (lazy) พร้อมก่อนเข้าเกม หน้าต่างจึงขึ้นพร้อมกันทั้งชุด
 * ปกติโหลดแผ่นรวม ui แผ่นเดียวแล้วตัดในเครื่อง ถ้าโหลดแผ่นรวมไม่ได้ค่อยโหลดไฟล์เดี่ยวทีละชิ้นแบบเดิม
 */
export function preloadInterfaceArt(): Promise<void> {
  // ภาพหน้าจอที่ใหญ่เกินแผ่นรวม (เช่น โลโก้หน้าเริ่มเกม) ยังโหลดไฟล์เดี่ยว
  const unpacked = preloadFiles((id) => atlasGroupOf(id) === null);
  const packed = loadAtlasGroup('ui').catch(() => preloadFiles((id) => atlasGroupOf(id) === 'ui' || ALSO_IN_INTERFACE.includes(id)));
  return Promise.all([unpacked, packed]).then(() => undefined);
}

function preloadFiles(wanted: (id: string) => boolean): Promise<void> {
  const files = new Set<string>();
  for (const [id, entry] of Object.entries(registry)) {
    if (entry.type === 'local' && (entry.lazy || ALSO_IN_INTERFACE.includes(id)) && wanted(id)) files.add(assetUrl(entry.file));
  }
  const jobs = [...files].map((url) => {
    const image = new Image();
    image.src = url;
    kept.push(image);
    return image.decode().catch(() => undefined);
  });
  return Promise.all(jobs).then(() => undefined);
}

/** ซ่อนหน้าต่างไว้จนภาพทุกชิ้นข้างในพร้อม แล้วแสดงทีเดียว ไม่ให้ชิ้นส่วนโผล่ทีละชิ้น */
export function revealWhenReady(root: HTMLElement): void {
  const pending = [...root.querySelectorAll('img')].filter((image) => !image.complete || image.naturalWidth === 0);
  if (pending.length === 0) return;
  root.style.visibility = 'hidden';
  void Promise.race([Promise.all(pending.map((image) => image.decode().catch(() => undefined))), wait(REVEAL_LIMIT_MS)]).then(() => {
    root.style.visibility = '';
  });
}
