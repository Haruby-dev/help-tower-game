import { PNG } from 'pngjs';

export interface Cell {
  left: number;
  top: number;
  width: number;
  height: number;
}

function copyCell(source: PNG, cell: Cell): PNG {
  const copy = new PNG({ width: cell.width, height: cell.height });
  PNG.bitblt(source, copy, cell.left, cell.top, cell.width, cell.height, 0, 0);
  return copy;
}

function pasteCell(target: PNG, cell: Cell, image: PNG): void {
  PNG.bitblt(image, target, 0, 0, cell.width, cell.height, cell.left, cell.top);
}

const hasPixel = (image: PNG, x: number, y: number): boolean => (image.data[(y * image.width + x) * 4 + 3] ?? 0) > 0;

export function rowHasPixels(image: PNG, y: number): boolean {
  for (let x = 0; x < image.width; x += 1) if (hasPixel(image, x, y)) return true;
  return false;
}

export function topRow(image: PNG): number {
  for (let y = 0; y < image.height; y += 1) if (rowHasPixels(image, y)) return y;
  throw new Error('frame is empty');
}

export function bottomRow(image: PNG): number {
  for (let y = image.height - 1; y >= 0; y -= 1) if (rowHasPixels(image, y)) return y;
  throw new Error('frame is empty');
}

function moveRow(image: PNG, fromY: number, toY: number, into: PNG): void {
  if (toY < 0 || toY >= into.height || fromY < 0 || fromY >= image.height) return;
  image.data.copy(into.data, toY * into.width * 4, fromY * image.width * 4, (fromY + 1) * image.width * 4);
}

function shiftWhole(image: PNG, down: number): PNG {
  const moved = new PNG({ width: image.width, height: image.height });
  for (let y = 0; y < image.height; y += 1) moveRow(image, y, y + down, moved);
  return moved;
}

/**
 * ยืดหรือหดเฉพาะแถวตรงตำแหน่งตัด ส่วนบนเลื่อนทั้งก้อน จุดพิกเซลของหน้าจึงเหมือนเดิมทุกจุด
 * ส่วนล่างอยู่กับที่ เท้าจึงไม่ขยับ grow เป็นบวกคือสูงขึ้น เป็นลบคือเตี้ยลง
 */
export function resizeAtCut(image: PNG, cutY: number, grow: number): PNG {
  const result = new PNG({ width: image.width, height: image.height });
  for (let y = cutY; y < image.height; y += 1) moveRow(image, y, y, result);
  for (let y = 0; y < cutY; y += 1) moveRow(image, y, y - grow, result);
  for (let y = cutY - grow; y < cutY; y += 1) moveRow(image, cutY, y, result);
  return result;
}

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

function headCenter(image: PNG, top: number, rows: number): number {
  let left = image.width;
  let right = 0;
  for (let y = top; y < top + rows; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (hasPixel(image, x, y)) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
  }
  return Math.round((left + right) / 2);
}

export interface SteadyRow {
  waistY: number;
  /** เฟรมที่หน้าดูปกติ ใช้แทนหน้าเฟรมที่ตาหลับหรืออ้าปาก */
  faceFrame?: number | undefined;
  replaceFaces?: number[] | undefined;
  chinY?: number | undefined;
}

const HEAD_MATCH_ROWS = 10;

/** ทำให้หัวอยู่แถวเดียวกันทุกเฟรมและเท้าอยู่ที่เดิม ท่าเดินขึ้นลงจะไม่ดูเหมือนกระโดด */
export function steadyWalkRow(sheet: PNG, rowIndex: number, frameWidth: number, frameHeight: number, frameCount: number, fix: SteadyRow): void {
  const cells = Array.from({ length: frameCount }, (_, frame) => ({
    left: frame * frameWidth,
    top: rowIndex * frameHeight,
    width: frameWidth,
    height: frameHeight,
  }));
  const frames = cells.map((cell) => copyCell(sheet, cell));
  const feet = median(frames.map(bottomRow));
  const head = median(frames.map(topRow));

  const fixed = frames.map((frame) => {
    const grounded = shiftWhole(frame, feet - bottomRow(frame));
    return resizeAtCut(grounded, fix.waistY, topRow(grounded) - head);
  });

  const { faceFrame, replaceFaces, chinY } = fix;
  if (faceFrame !== undefined && chinY !== undefined) {
    const donor = fixed[faceFrame] as PNG;
    const donorCenter = headCenter(donor, head, HEAD_MATCH_ROWS);
    for (const index of replaceFaces ?? []) {
      const frame = fixed[index] as PNG;
      const offset = headCenter(frame, head, HEAD_MATCH_ROWS) - donorCenter;
      const rowBytes = frame.width * 4;
      frame.data.fill(0, 0, chinY * rowBytes);
      for (let y = head; y < chinY; y += 1) {
        for (let x = 0; x < donor.width; x += 1) {
          const toX = x + offset;
          if (toX < 0 || toX >= frame.width) continue;
          donor.data.copy(frame.data, (y * frame.width + toX) * 4, (y * donor.width + x) * 4, (y * donor.width + x + 1) * 4);
        }
      }
    }
  }
  fixed.forEach((frame, index) => pasteCell(sheet, cells[index] as Cell, frame));
}

export interface SquashStretch {
  rows: number;
  /** ตำแหน่งตัดนับจากยอดหัวถึงเท้า ต้องต่ำกว่าคาง */
  cutShare: number;
}

/** สร้างเฟรมยืดและเฟรมหดจากภาพนิ่ง คอลัมน์เรียงตาม ปกติ ยืด หด */
export function buildHopSheet(sheet: PNG, frameWidth: number, frameHeight: number, rows: number, fix: SquashStretch): PNG {
  const result = new PNG({ width: frameWidth * 3, height: frameHeight * rows });
  for (let row = 0; row < rows; row += 1) {
    const frame = copyCell(sheet, { left: 0, top: row * frameHeight, width: frameWidth, height: frameHeight });
    const top = topRow(frame);
    const cutY = Math.round(top + (bottomRow(frame) - top) * fix.cutShare);
    [frame, resizeAtCut(frame, cutY, fix.rows), resizeAtCut(frame, cutY, -fix.rows)].forEach((variant, column) => {
      pasteCell(result, { left: column * frameWidth, top: row * frameHeight, width: frameWidth, height: frameHeight }, variant);
    });
  }
  return result;
}
