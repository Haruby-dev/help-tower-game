export type Terrain = 'grass' | 'dirt' | 'dark' | 'forest' | 'water' | 'upper' | 'wall' | 'soil';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapLayout {
  widthTiles: number;
  heightTiles: number;
  terrainLegend: Record<string, Terrain>;
  /** ผังพื้นเขียนที่จุดมุมของช่อง แต่ละแถวมี widthTiles + 1 ตัว และมี heightTiles + 1 แถว */
  terrain: string[];
  blockers: Rect[];
  openings: Rect[];
  walkableOverWater: Rect[];
  footprints: Record<string, { width: number; height: number }>;
  flat: string[];
  flowers: {
    seed: number;
    screenTiles: number;
    smallPerScreen: number;
    bigPerScreen: number;
    minSpacing: number;
    stoneClearance: number;
    keepOut: Rect[];
  };
  effects: { name: string; x: number; y: number; width: number; height: number }[];
  objects: { id: string; x: number; y: number; submerged?: number; plot?: number }[];
  spawns: Record<string, { x: number; y: number }>;
}

/** พื้นกำหนดที่จุดมุมของช่อง จึงมีจุดมุมมากกว่าจำนวนช่อง 1 แถว */
export function buildCorners(layout: MapLayout): Terrain[][] {
  if (layout.terrain.length !== layout.heightTiles + 1) {
    throw new Error(`terrain needs ${layout.heightTiles + 1} rows, found ${layout.terrain.length}`);
  }
  return layout.terrain.map((row, y) => {
    if (row.length !== layout.widthTiles + 1) {
      throw new Error(`terrain row ${y} needs ${layout.widthTiles + 1} corners, found ${row.length}`);
    }
    return [...row].map((symbol, x) => {
      const terrain = layout.terrainLegend[symbol];
      if (!terrain) throw new Error(`unknown terrain ${symbol} at ${x},${y}`);
      return terrain;
    });
  });
}

function cornerAt(corners: Terrain[][], x: number, y: number): Terrain {
  const terrain = corners[y]?.[x];
  if (!terrain) throw new Error(`no corner at ${x},${y}`);
  return terrain;
}

export interface TileCorners {
  NW: Terrain;
  NE: Terrain;
  SW: Terrain;
  SE: Terrain;
}

export function tileCorners(corners: Terrain[][], x: number, y: number): TileCorners {
  return {
    NW: cornerAt(corners, x, y),
    NE: cornerAt(corners, x + 1, y),
    SW: cornerAt(corners, x, y + 1),
    SE: cornerAt(corners, x + 1, y + 1),
  };
}

function tileBlocked(corners: Terrain[][], x: number, y: number): boolean {
  const terrains = Object.values(tileCorners(corners, x, y));
  if (terrains.every((terrain) => terrain === 'forest')) return true;
  if (terrains.includes('wall')) return true;
  return terrains.includes('upper') && !terrains.every((terrain) => terrain === 'upper');
}

/**
 * กันเดินทีละครึ่งช่อง: น้ำกันเป็นรายมุมเพื่อให้ขอบบ่อตรงกับภาพ ส่วนป่าและหน้าผากันทั้งช่อง
 * clear คือพื้นที่ที่เดินได้แม้จะมีหน้าผาหรือน้ำ เช่น บันไดและท่าน้ำ แล้วรวมแถบยาวเพื่อลดจำนวนกล่อง
 */
export function blockedRects(corners: Terrain[][], tileSize: number, clear: Rect[] = []): Rect[] {
  const half = tileSize / 2;
  const rows = (corners.length - 1) * 2;
  const columns = ((corners[0]?.length ?? 1) - 1) * 2;
  const rects: Rect[] = [];

  const isClear = (column: number, row: number): boolean =>
    clear.some(
      (area) =>
        column * half >= area.x &&
        (column + 1) * half <= area.x + area.width &&
        row * half >= area.y &&
        (row + 1) * half <= area.y + area.height,
    );

  for (let row = 0; row < rows; row += 1) {
    let start: number | null = null;
    for (let column = 0; column <= columns; column += 1) {
      const blocked =
        column < columns &&
        !isClear(column, row) &&
        (cornerAt(corners, Math.round((column + 0.5) / 2), Math.round((row + 0.5) / 2)) === 'water' ||
          tileBlocked(corners, Math.floor(column / 2), Math.floor(row / 2)));
      if (blocked && start === null) start = column;
      if (!blocked && start !== null) {
        rects.push({ x: start * half, y: row * half, width: (column - start) * half, height: half });
        start = null;
      }
    }
  }
  return rects;
}

export function footprintRect(
  footprint: { width: number; height: number },
  footX: number,
  footY: number,
): Rect {
  return { x: footX - footprint.width / 2, y: footY - footprint.height, width: footprint.width, height: footprint.height };
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** เดินจากจุดเริ่มเป็นตาราง ตอบว่าตัวละครขนาด bodyWidth×bodyHeight ไปถึงจุดเป้าหมายได้ไหม */
export function canReach(
  start: { x: number; y: number },
  goal: { x: number; y: number },
  obstacles: Rect[],
  world: { width: number; height: number },
  body: { width: number; height: number },
  step: number,
): boolean {
  const blocked = (x: number, y: number): boolean => {
    const rect = { x: x - body.width / 2, y: y - body.height / 2, width: body.width, height: body.height };
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > world.width || rect.y + rect.height > world.height) return true;
    return obstacles.some((obstacle) => overlaps(rect, obstacle));
  };
  const key = (x: number, y: number): string => `${x},${y}`;
  const startX = Math.round(start.x / step) * step;
  const startY = Math.round(start.y / step) * step;
  const seen = new Set([key(startX, startY)]);
  const queue = [{ x: startX, y: startY }];

  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    if (!point) break;
    if (Math.abs(point.x - goal.x) <= step && Math.abs(point.y - goal.y) <= step) return true;
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const x = point.x + dx;
      const y = point.y + dy;
      if (seen.has(key(x, y)) || blocked(x, y)) continue;
      seen.add(key(x, y));
      queue.push({ x, y });
    }
  }
  return false;
}
