/** คณิตล้วนของบ่อน้ำ ไม่แตะ Phaser จึงทดสอบแยกได้ */

const DIAGONAL = Math.SQRT2;

/**
 * ระยะจากพิกเซลที่อยู่นอกเขต ประมาณแบบ chamfer สองรอบ พอสำหรับไล่สีตามความลึก
 * edgeIsOutside: นอกกรอบนับเป็นนอกเขตหรือไม่
 */
export function chamferDistance(inside: Uint8Array, width: number, height: number, edgeIsOutside = true): Float32Array {
  const far = width + height;
  const dist = new Float32Array(width * height);
  for (let i = 0; i < dist.length; i += 1) dist[i] = inside[i] ? far : 0;
  const edge = edgeIsOutside ? 0 : far;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= width || y >= height ? edge : dist[y * width + x]!);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (!dist[i]) continue;
      dist[i] = Math.min(dist[i]!, at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + DIAGONAL, at(x + 1, y - 1) + DIAGONAL);
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const i = y * width + x;
      if (!dist[i]) continue;
      dist[i] = Math.min(dist[i]!, at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + DIAGONAL, at(x - 1, y + 1) + DIAGONAL);
    }
  }
  return dist;
}

/** ขอบหลุมไม่กลมเป๊ะ ตามสูตรที่ผู้ใช้อนุมัติ */
export function holeRadius(theta: number, radius: number): number {
  return radius * (1 + 0.1 * Math.sin(2 * theta + 1.1) + 0.07 * Math.sin(3 * theta + 2.6) + 0.04 * Math.sin(5 * theta + 0.4));
}

export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** หาจุดใกล้สุดสองจุด ใช้ตารางแบ่งช่องให้เร็วพอทำตอนเปิดเกม yScale ทำให้เซลล์กว้างกว่าสูง */
export class NearestPoints {
  private readonly cells = new Map<number, number[]>();
  private readonly columns: number;

  constructor(
    private readonly xs: Float32Array,
    private readonly ys: Float32Array,
    private readonly cellSize: number,
    private readonly yScale = 1,
  ) {
    this.columns = 1 << 12;
    for (let i = 0; i < xs.length; i += 1) {
      const key = this.key(Math.floor(xs[i]! / cellSize), Math.floor(ys[i]! / cellSize));
      const list = this.cells.get(key);
      if (list) list.push(i);
      else this.cells.set(key, [i]);
    }
  }

  private key(cx: number, cy: number): number {
    return (cy + 64) * this.columns + cx + 64;
  }

  /** ตอบ [ใกล้สุด, ระยะใกล้สุด, ระยะอันดับสอง] */
  query(x: number, y: number): [number, number, number] {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    let best = -1;
    let first = Infinity;
    let second = Infinity;
    for (let reach = 1; reach <= 4; reach += 1) {
      for (let dy = -reach; dy <= reach; dy += 1) {
        for (let dx = -reach; dx <= reach; dx += 1) {
          if (reach > 1 && Math.abs(dx) < reach && Math.abs(dy) < reach) continue;
          for (const i of this.cells.get(this.key(cx + dx, cy + dy)) ?? []) {
            const d = Math.hypot(this.xs[i]! - x, (this.ys[i]! - y) * this.yScale);
            if (d < first) {
              second = first;
              first = d;
              best = i;
            } else if (d < second) {
              second = d;
            }
          }
        }
      }
      if (second <= reach * this.cellSize) break;
    }
    return [best, first, second];
  }
}

/** จุดรอบวงรีแบบพิกเซลเต็ม ไม่ซ้ำ */
export function ellipseOutline(cx: number, cy: number, rx: number, ry: number): [number, number][] {
  const seen = new Set<string>();
  const points: [number, number][] = [];
  const steps = Math.max(16, Math.ceil((rx + ry) * 4));
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(angle) * rx);
    const y = Math.round(cy + Math.sin(angle) * ry);
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    points.push([x, y]);
  }
  return points;
}

/** เส้นตรงทีละพิกเซล */
export function linePoints(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = [];
  let x = Math.round(x0);
  let y = Math.round(y0);
  const ex = Math.round(x1);
  const ey = Math.round(y1);
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let error = dx + dy;
  for (;;) {
    points.push([x, y]);
    if (x === ex && y === ey) return points;
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
  }
}
