import { assetUrl, registry } from '../core/assets';
import { sliceUrl } from '../core/atlas';

/** ที่อยู่ภาพจากทะเบียน สลับเป็นภาพจริงได้ด้วยการแก้ทะเบียนอย่างเดียว · ภาพที่ตัดจากแผ่นรวมแล้วใช้ภาพในเครื่อง ไม่ต้องโหลดไฟล์เดี่ยวซ้ำ */
export function artUrl(id: string): string {
  const entry = registry[id];
  if (entry?.type !== 'local' && entry?.type !== 'character') throw new Error(`${id} has no image in the registry`);
  return sliceUrl(id) ?? assetUrl(entry.file);
}

/**
 * ภาพขนาดจริงคูณหน่วยพิกเซลของที่ที่วาง (ค่าเริ่มต้น --px) ไม่ย่อขยายทีละชิ้น ขนาดจุดภาพจึงเท่ากันทั้งหน้าจอ
 * ในโทรศัพท์ สมุด และการ์ด --px ถูกตั้งเป็นพิกเซลภาพหนึ่งจุดของที่นั้นแล้ว
 */
export function sizedArt(id: string, className: string, unit = '--px', scale = 1): HTMLImageElement {
  const entry = registry[id];
  if (entry?.type !== 'local') throw new Error(`${id} is not a local image`);
  const image = document.createElement('img');
  image.className = `pixel-img ${className}`;
  image.src = artUrl(id);
  image.alt = '';
  image.dataset.art = id;
  image.style.width = `calc(var(${unit}) * ${entry.width * scale})`;
  image.style.height = `calc(var(${unit}) * ${entry.height * scale})`;
  return image;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
}

function pixelCanvas(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `calc(var(--px) * ${width})`;
  canvas.style.height = `calc(var(--px) * ${height})`;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas 2d is not available');
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

const STICKER_WHITE = 2;
const STICKER_EDGE = 3;
const STICKER_EDGE_COLOR = '#d6c8e8';
const STICKER_FILL_COLOR = '#ffffff';

/** ขอบสติกเกอร์ของไอคอนแอป วาดเป็นพิกเซลรอบรูป ไม่ใช้ filter */
export function stickerIcon(id: string): HTMLCanvasElement {
  const entry = registry[id];
  if (entry?.type !== 'local') throw new Error(`${id} is not an image`);
  const { canvas, context } = pixelCanvas(entry.width + STICKER_EDGE * 2, entry.height + STICKER_EDGE * 2);
  void loadImage(assetUrl(entry.file)).then((image) => {
    const probe = document.createElement('canvas');
    probe.width = entry.width;
    probe.height = entry.height;
    const reader = probe.getContext('2d');
    if (!reader) return;
    reader.drawImage(image, 0, 0);
    const pixels = reader.getImageData(0, 0, entry.width, entry.height).data;
    const opaque = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < entry.width && y < entry.height && (pixels[(y * entry.width + x) * 4 + 3] ?? 0) > 40;
    const nearBy = (x: number, y: number, reach: number): boolean => {
      for (let dy = -reach; dy <= reach; dy += 1) {
        for (let dx = -reach; dx <= reach; dx += 1) {
          if (Math.abs(dx) + Math.abs(dy) <= reach + 1 && opaque(x + dx, y + dy)) return true;
        }
      }
      return false;
    };
    for (let y = -STICKER_EDGE; y < entry.height + STICKER_EDGE; y += 1) {
      for (let x = -STICKER_EDGE; x < entry.width + STICKER_EDGE; x += 1) {
        if (nearBy(x, y, STICKER_WHITE)) context.fillStyle = STICKER_FILL_COLOR;
        else if (nearBy(x, y, STICKER_EDGE)) context.fillStyle = STICKER_EDGE_COLOR;
        else continue;
        context.fillRect(x + STICKER_EDGE, y + STICKER_EDGE, 1, 1);
      }
    }
    context.drawImage(image, STICKER_EDGE, STICKER_EDGE);
  });
  return canvas;
}

/** วงกลมพิกเซลสำหรับกรอบรูปหน้า */
export function pixelDisc(diameter: number, fill: string, outline: string): HTMLCanvasElement {
  const { canvas, context } = pixelCanvas(diameter, diameter);
  const radius = diameter / 2;
  for (let y = 0; y < diameter; y += 1) {
    for (let x = 0; x < diameter; x += 1) {
      const distance = Math.hypot(x + 0.5 - radius, y + 0.5 - radius);
      if (distance > radius) continue;
      context.fillStyle = distance > radius - 2 ? outline : fill;
      context.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

export interface NineSlice {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const BUBBLE_TAIL_HEIGHT = 3;
const BUBBLE_TAIL_WIDTH = 8;

/** วาดฟองคำพูดตามขนาดที่ต้องการ หางอยู่กลางล่างและไม่ถูกยืด */
export function drawSpeechBubble(canvas: HTMLCanvasElement, image: HTMLImageElement, slice: NineSlice, width: number, bodyHeight: number): void {
  const height = bodyHeight + BUBBLE_TAIL_HEIGHT;
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `calc(var(--px) * ${width})`;
  canvas.style.height = `calc(var(--px) * ${height})`;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.imageSmoothingEnabled = false;

  const sourceBody = image.height - BUBBLE_TAIL_HEIGHT;
  const sourceMiddleWidth = image.width - slice.left - slice.right;
  const targetMiddleWidth = width - slice.left - slice.right;
  const sourceMiddleHeight = sourceBody - slice.top - slice.bottom;
  const targetMiddleHeight = bodyHeight - slice.top - slice.bottom;
  const rows: [number, number, number, number][] = [
    [0, slice.top, 0, slice.top],
    [slice.top, sourceMiddleHeight, slice.top, targetMiddleHeight],
    [sourceBody - slice.bottom, slice.bottom, bodyHeight - slice.bottom, slice.bottom],
  ];
  for (const [sourceY, sourceH, targetY, targetH] of rows) {
    context.drawImage(image, 0, sourceY, slice.left, sourceH, 0, targetY, slice.left, targetH);
    context.drawImage(image, slice.left, sourceY, sourceMiddleWidth, sourceH, slice.left, targetY, targetMiddleWidth, targetH);
    context.drawImage(image, image.width - slice.right, sourceY, slice.right, sourceH, width - slice.right, targetY, slice.right, targetH);
  }
  // หางตัดจากกลางภาพต้นฉบับ พร้อมแถวขอบล่างของตัวฟอง
  const tailTop = sourceBody - 2;
  const tailHeight = BUBBLE_TAIL_HEIGHT + 2;
  const sourceX = Math.floor((image.width - BUBBLE_TAIL_WIDTH) / 2);
  const targetX = Math.floor((width - BUBBLE_TAIL_WIDTH) / 2);
  context.clearRect(targetX, bodyHeight - 2, BUBBLE_TAIL_WIDTH, tailHeight);
  context.drawImage(image, sourceX, tailTop, BUBBLE_TAIL_WIDTH, tailHeight, targetX, bodyHeight - 2, BUBBLE_TAIL_WIDTH, tailHeight);
}

export const bubbleImage = (id: string): Promise<HTMLImageElement> => loadImage(artUrl(id));
