import { assetUrl, registry } from '../core/assets';

/** เก็บภาพที่ถอดรหัสแล้วไว้ เบราว์เซอร์จะได้ไม่ทิ้งก่อนเปิดหน้าต่าง */
const kept: HTMLImageElement[] = [];
const REVEAL_LIMIT_MS = 1500;

const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

/** ภาพหน้าจอทุกชิ้นที่ Phaser ไม่ได้โหลด (lazy) โหลดและถอดรหัสตอนเปิดเกม รวมราว 1 MB หน้าต่างจึงขึ้นพร้อมกันทั้งชุด */
export function preloadInterfaceArt(): Promise<void> {
  const files = new Set<string>();
  for (const entry of Object.values(registry)) {
    if (entry.type === 'local' && entry.lazy) files.add(assetUrl(entry.file));
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
