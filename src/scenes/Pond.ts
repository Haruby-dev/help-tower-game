import Phaser from 'phaser';
import type { Direction4 } from '../core/movement';
import { createRng, type Rng } from '../core/rng';
import { BAYER4, NearestPoints, chamferDistance, ellipseOutline, holeRadius, linePoints } from './pondMath';

export interface CastSpot {
  x: number;
  y: number;
  facing: Direction4;
}

/** ระลอกรอบลอบอยู่สูงจากเท้าภาพลอบในน้ำเท่านี้ (แนวน้ำในภาพ) */
const TRAP_WATERLINE = 4;
const CAST_DIRECTIONS: [Direction4, number, number][] = [
  ['east', 1, 0],
  ['west', -1, 0],
  ['south', 0, 1],
  ['north', 0, -1],
];
/** ทิศที่หันอยู่ได้เปรียบเท่านี้ ตัวละครจึงไม่หันกลับไปมาเมื่อน้ำอยู่ใกล้พอ ๆ กันสองทาง */
const FACING_BONUS_PX = 6;
const THROW_STEPS = 16;

/** ของที่อยู่ในบ่อ ใช้ทำเงาและกันไม่ให้หลุมอยู่ใต้ท่าน้ำ */
export interface PondObject {
  key: string;
  left: number;
  top: number;
  width: number;
  /** ความสูงที่มองเห็น หินจมน้ำถูกตัดล่าง */
  height: number;
}

type Rgb = [number, number, number];

const WATER_TILESET = 'ground_water';
const DOCK_KEY = 'fishing_dock';
const PAD = 4;
const SEED = 21;

const BANDS: Rgb[] = [
  [128, 196, 150],
  [82, 172, 150],
  [40, 140, 148],
  [34, 112, 134],
  [30, 94, 122],
];
const BAND_EDGES = [3, 8, 14, 22];
const COBBLES: Rgb[] = [
  [150, 140, 122],
  [132, 126, 112],
  [162, 150, 128],
  [120, 114, 104],
  [140, 132, 118],
];
const COBBLE_AREA = 69;
const COBBLE_Y_SCALE = 1.25;
const HOLE_RADIUS = 17;
const HOLE_Y_SCALE = 0.72;
const HOLE_CLEARANCE = 18;
const HOLE_DARK: Rgb = [10, 26, 44];
const HOLE_MID: Rgb = [18, 48, 74];
const HOLE_STEPS = [0.28, 0.42, 0.58, 0.76, 1];
const BANK_SHADE: [number, number, number][] = [
  [-1, 0, 1],
  [-2, 0, 0.8],
  [-3, 0, 0.6],
  [-4, 0, 0.4],
  [-5, 0, 0.25],
  [0, -1, 0.6],
  [0, -2, 0.4],
  [0, -3, 0.2],
];
const SHADE_STRENGTH = 0.42;
const OBJECT_SHADE = 0.55;

const FRAME_MS = 70;
const CYCLE_FRAMES = 48;
const CAUSTIC_FRAMES = 24;
const CAUSTIC_POINTS = 260;
const CLOUD_MS = 25_000;
const CLOUD_RX = 70;
const CLOUD_RY = 40;
const CLOUD_TINT = 219;
const SPARKLE_COUNT = 110;
const MAX_STONES = 35;
const FISH = [
  { phase: 0, angle: 1, size: 1 },
  { phase: 0.35, angle: -0.6, size: 0 },
  { phase: 0.7, angle: 2.3, size: 1 },
];
const BUBBLES = 6;
const LILY_GROUPS = 3;

const color = ([r, g, b]: Rgb): number => (r << 16) | (g << 8) | b;
/** น้ำในแผ่นเป็นสีเขียวน้ำเงิน หญ้าฟ้าน้อยกว่าเขียวมาก จึงแยกด้วยสัดส่วนน้ำเงินต่อเขียว */
const isWaterPixel = (r: number, g: number, b: number, a: number): boolean => a > 0 && b > g * 0.8 && b > r * 1.4 && g > r * 1.2;

interface Stone {
  x: number;
  y: number;
  r: number;
}

/** บ่อน้ำใส วาดพื้นบ่อครั้งเดียวจากแผ่นน้ำในแผนที่ ส่วนที่ขยับวาดทีละพิกเซลเต็ม */
export class Pond {
  private readonly left: number;
  private readonly top: number;
  private readonly width: number;
  private readonly height: number;
  private readonly water: Uint8Array;
  private readonly object: Uint8Array;
  private readonly depth: Float32Array;
  private readonly shade: Float32Array;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly rng: Rng;
  private hole = { x: 0, y: 0 };
  private stones: Stone[] = [];
  private reeds: { x: number; y: number }[] = [];
  private lilies: { x: number; y: number }[] = [];
  private sparkles: { x: number; y: number; phase: number; length: number }[] = [];
  private bubbles: { phase: number; offset: number }[] = [];
  private rocks: { x: number; y: number }[] = [];
  /** ลอบที่วางในน้ำ (พิกัดในบ่อ) วาดระลอกเหมือนหินกลางบ่อ */
  private traps: { x: number; y: number }[] = [];
  private caustic: Phaser.GameObjects.Image | null = null;
  private causticFrames: string[] = [];
  private causticPoints: { x: number; y: number; ax: number; ay: number }[] = [];
  private cloud: Phaser.GameObjects.Image | null = null;
  private shownFrame = -1;
  private effectsOn = true;
  /** หินกรวดของแต่ละพิกเซล ใช้ไล่ความมืดรอบหลุมทีละก้อน */
  private cobbleOf = new Int32Array(0);

  static create(scene: Phaser.Scene, ground: Phaser.Tilemaps.TilemapLayer, objects: PondObject[], depth: number): Pond | null {
    const tiles = ground.getTilesWithin().filter((tile) => tile.index >= 0 && tile.tileset?.name === WATER_TILESET);
    if (tiles.length === 0) return null;
    return new Pond(scene, tiles, objects, depth);
  }

  private constructor(
    private readonly scene: Phaser.Scene,
    tiles: Phaser.Tilemaps.Tile[],
    objects: PondObject[],
    depth: number,
  ) {
    this.rng = createRng(SEED);
    const tileWidth = tiles[0]!.width;
    const tileHeight = tiles[0]!.height;
    const minX = Math.min(...tiles.map((tile) => tile.pixelX));
    const minY = Math.min(...tiles.map((tile) => tile.pixelY));
    const maxX = Math.max(...tiles.map((tile) => tile.pixelX + tileWidth));
    const maxY = Math.max(...tiles.map((tile) => tile.pixelY + tileHeight));
    this.left = minX - PAD;
    this.top = minY - PAD;
    this.width = maxX - minX + PAD * 2;
    this.height = maxY - minY + PAD * 2;
    const size = this.width * this.height;
    this.water = new Uint8Array(size);
    this.object = new Uint8Array(size);
    this.readWater(tiles);
    const dock = new Uint8Array(size);
    this.readObjects(objects, dock);
    const deep = new Uint8Array(size);
    // ท่าน้ำนับเป็นน้ำตอนวัดความลึก น้ำใต้ท่าจึงไม่ตื้นผิดธรรมชาติ
    for (let i = 0; i < size; i += 1) deep[i] = this.water[i] || dock[i] ? 1 : 0;
    this.depth = chamferDistance(deep, this.width, this.height);
    this.shade = new Float32Array(size);
    this.rocks = objects
      .filter((item) => item.key.startsWith('rock'))
      .map((item) => ({ x: Math.round(item.left + item.width / 2 - this.left), y: Math.round(item.top + item.height - this.top - 2) }));

    const floor = this.paintFloor();
    this.paintHole(floor);
    this.paintShade(floor, deep);
    this.placeShore(deep);
    this.paintStones(floor);
    this.placeDecor();

    const floorKey = 'pond_floor';
    if (scene.textures.exists(floorKey)) scene.textures.remove(floorKey);
    const canvas = scene.textures.createCanvas(floorKey, this.width, this.height)!;
    canvas.getContext().putImageData(floor, 0, 0);
    canvas.refresh();
    scene.add.image(this.left, this.top, floorKey).setOrigin(0).setDepth(depth);

    this.graphics = scene.add.graphics().setPosition(this.left, this.top).setDepth(depth + 0.3);
    if (scene.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) this.setUpLightLayers(depth);
  }

  /** ลอบในน้ำเปลี่ยน รับเท้าลอบเป็นพิกเซลแผนที่ ระลอกอยู่ที่แนวน้ำเหนือเท้า 2 พิกเซลเหมือนหิน */
  setTraps(points: { x: number; y: number }[]): void {
    this.traps = points.map((point) => ({ x: Math.round(point.x - this.left), y: Math.round(point.y - this.top - TRAP_WATERLINE) }));
    this.shownFrame = -1;
  }

  private index(x: number, y: number): number {
    return y * this.width + x;
  }

  /** ขอบน้ำ (พิกเซลน้ำที่ติดพื้นบก) พิกัดแผนที่ คิดครั้งแรกที่ใช้ */
  private shore: { x: number; y: number }[] | null = null;

  /** ระยะจากจุดนี้ถึงน้ำที่ใกล้ที่สุด (พิกเซลแผนที่) อยู่ในน้ำเป็น 0 ใช้ปรับเสียงบ่อน้ำตามระยะ */
  distanceToWater(x: number, y: number): number {
    if (this.isWater(Math.round(x - this.left), Math.round(y - this.top))) return 0;
    if (!this.shore) {
      this.shore = [];
      for (let py = 0; py < this.height; py += 1) {
        for (let px = 0; px < this.width; px += 1) {
          if (!this.isWater(px, py)) continue;
          if (this.isWater(px - 1, py) && this.isWater(px + 1, py) && this.isWater(px, py - 1) && this.isWater(px, py + 1)) continue;
          this.shore.push({ x: px + this.left, y: py + this.top });
        }
      }
    }
    let best = Infinity;
    for (const point of this.shore) best = Math.min(best, (point.x - x) ** 2 + (point.y - y) ** 2);
    return Math.sqrt(best);
  }

  private isWater(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height && this.water[this.index(x, y)] === 1;
  }

  private readWater(tiles: Phaser.Tilemaps.Tile[]): void {
    const source = this.scene.textures.get(WATER_TILESET).getSourceImage() as HTMLImageElement;
    const reader = document.createElement('canvas');
    reader.width = source.width;
    reader.height = source.height;
    const context = reader.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, source.width, source.height).data;
    for (const tile of tiles) {
      const corner = tile.tileset!.getTileTextureCoordinates(tile.index) as { x: number; y: number } | null;
      if (!corner) continue;
      for (let py = 0; py < tile.height; py += 1) {
        for (let px = 0; px < tile.width; px += 1) {
          const s = ((corner.y + py) * source.width + corner.x + px) * 4;
          if (!isWaterPixel(pixels[s]!, pixels[s + 1]!, pixels[s + 2]!, pixels[s + 3]!)) continue;
          const x = tile.pixelX + px - this.left;
          const y = tile.pixelY + py - this.top;
          this.water[this.index(x, y)] = 1;
        }
      }
    }
  }

  private readObjects(objects: PondObject[], dock: Uint8Array): void {
    for (const item of objects) {
      const source = this.scene.textures.get(item.key).getSourceImage() as HTMLImageElement;
      const reader = document.createElement('canvas');
      reader.width = source.width;
      reader.height = source.height;
      const context = reader.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(source, 0, 0);
      const pixels = context.getImageData(0, 0, source.width, source.height).data;
      for (let py = 0; py < item.height; py += 1) {
        for (let px = 0; px < item.width; px += 1) {
          if ((pixels[(py * source.width + px) * 4 + 3] ?? 0) < 128) continue;
          const x = Math.round(item.left) + px - this.left;
          const y = Math.round(item.top) + py - this.top;
          if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;
          const i = this.index(x, y);
          this.object[i] = 1;
          if (item.key === DOCK_KEY) dock[i] = 1;
        }
      }
    }
  }

  private paintFloor(): ImageData {
    const floor = new ImageData(this.width, this.height);
    const count = Math.round((this.width * this.height) / COBBLE_AREA);
    const xs = new Float32Array(count);
    const ys = new Float32Array(count);
    const tints: Rgb[] = [];
    for (let i = 0; i < count; i += 1) {
      xs[i] = this.rng.between(0, this.width);
      ys[i] = this.rng.between(0, this.height);
      tints.push(COBBLES[Math.floor(this.rng.next() * COBBLES.length)]!);
    }
    const nearest = new NearestPoints(xs, ys, 8, COBBLE_Y_SCALE);
    this.cobbleOf = new Int32Array(this.width * this.height);
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const i = this.index(x, y);
        if (!this.water[i]) continue;
        const [cell, first, second] = nearest.query(x, y);
        this.cobbleOf[i] = cell;
        let [r, g, b] = tints[cell]!;
        const lean = x - xs[cell]! + (y - ys[cell]!);
        const light = lean < -2 ? 1.12 : lean > 3 ? 0.86 : 1;
        const edge = second - first < 1.3 ? 0.7 : 1;
        r *= light * edge;
        g *= light * edge;
        b *= light * edge;
        const d = this.depth[i]!;
        let band = BAND_EDGES.filter((value) => d >= value).length;
        if (band < BAND_EDGES.length && BAND_EDGES[band]! - d < 1 && (x + y) % 2 === 0) band += 1;
        const [wr, wg, wb] = BANDS[band]!;
        const k = Math.min(0.82, 0.48 + d / 40);
        const o = i * 4;
        floor.data[o] = r * (1 - k) + wr * k;
        floor.data[o + 1] = g * (1 - k) + wg * k;
        floor.data[o + 2] = b * (1 - k) + wb * k;
        floor.data[o + 3] = 255;
      }
    }
    return floor;
  }

  /** หลุมอยู่จุดลึกที่สุดที่ห่างท่าน้ำกับหิน หินรอบปากหลุมค่อย ๆ มืดลงทีละก้อน */
  private paintHole(floor: ImageData): void {
    const clear = new Uint8Array(this.object.length);
    for (let i = 0; i < clear.length; i += 1) clear[i] = this.object[i] ? 0 : 1;
    const fromObjects = chamferDistance(clear, this.width, this.height, false);
    let best = -1;
    for (let i = 0; i < this.depth.length; i += 1) {
      if (!this.water[i] || fromObjects[i]! <= HOLE_CLEARANCE) continue;
      if (best < 0 || this.depth[i]! > this.depth[best]!) best = i;
    }
    if (best < 0) return;
    this.hole = { x: best % this.width, y: Math.floor(best / this.width) };
    const reachX = Math.ceil(HOLE_RADIUS * 1.6 * 1.25);
    const reachY = Math.ceil(HOLE_RADIUS * 1.6);
    for (let y = this.hole.y - reachY; y <= this.hole.y + reachY; y += 1) {
      for (let x = this.hole.x - reachX; x <= this.hole.x + reachX; x += 1) {
        if (!this.isWater(x, y)) continue;
        const i = this.index(x, y);
        if (this.object[i]) continue;
        const dx = x - this.hole.x;
        const dy = (y - this.hole.y) / HOLE_Y_SCALE;
        const theta = Math.atan2(dy, dx);
        const e = Math.hypot(dx, dy) / holeRadius(theta, HOLE_RADIUS);
        if (e > 1.6) continue;
        const o = i * 4;
        let rgb: Rgb;
        if (e < 0.5) {
          rgb = e < 0.42 ? HOLE_DARK : HOLE_MID;
        } else {
          const cell = this.cobbleOf[i]!;
          const jitter = (((cell * 37) % 7) / 7) * 0.25;
          const t = Math.min(1, Math.max(0, (e - 0.5) / 1.1 + jitter - 0.12));
          const step = HOLE_STEPS[Math.min(4, Math.floor(t * 5))]!;
          rgb = [0, 1, 2].map((c) => floor.data[o + c]! * step + HOLE_DARK[c]! * (1 - step) * 0.6) as Rgb;
        }
        floor.data[o] = rgb[0];
        floor.data[o + 1] = rgb[1];
        floor.data[o + 2] = rgb[2];
      }
    }
  }

  private paintShade(floor: ImageData, deep: Uint8Array): void {
    const land = (x: number, y: number): boolean =>
      x < 0 || y < 0 || x >= this.width || y >= this.height || !deep[this.index(x, y)];
    const objectAt = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < this.width && y < this.height && this.object[this.index(x, y)] === 1;
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const i = this.index(x, y);
        if (!this.water[i]) continue;
        let shade = 0;
        for (const [dy, dx, weight] of BANK_SHADE) if (land(x + dx, y + dy)) shade = Math.max(shade, weight);
        if (!this.object[i]) {
          for (let k = 1; k < 5; k += 1) if (objectAt(x - k, y - k - 1)) shade = Math.max(shade, OBJECT_SHADE);
        }
        this.shade[i] = shade;
        if (!shade) continue;
        const o = i * 4;
        for (let c = 0; c < 3; c += 1) floor.data[o + c] = floor.data[o + c]! * (1 - SHADE_STRENGTH * shade);
      }
    }
  }

  /** หินเล็กกับกกตามแนวน้ำติดตลิ่ง สุ่มด้วย seed เดิมจึงเหมือนเดิมทุกครั้ง */
  private placeShore(deep: Uint8Array): void {
    const edges: [number, number][] = [];
    for (let y = 1; y < this.height - 1; y += 1) {
      for (let x = 1; x < this.width - 1; x += 1) {
        if (!this.water[this.index(x, y)] || this.object[this.index(x, y)]) continue;
        const touchesLand = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => !deep[this.index(x + dx!, y + dy!)]);
        if (touchesLand) edges.push([x, y]);
      }
    }
    for (let i = edges.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [edges[i], edges[j]] = [edges[j]!, edges[i]!];
    }
    const taken: [number, number][] = [];
    for (const [x, y] of edges) {
      if (taken.some(([tx, ty]) => Math.abs(tx - x) <= 6 && Math.abs(ty - y) <= 6)) continue;
      if (this.rng.next() < 0.55) this.stones.push({ x, y, r: this.rng.next() < 0.67 ? 2 : 3 });
      else if (this.rng.next() < 0.35) this.reeds.push({ x, y });
      taken.push([x, y]);
      if (this.stones.length >= MAX_STONES) break;
    }
  }

  private paintStones(floor: ImageData): void {
    const put = (x: number, y: number, [r, g, b]: Rgb): void => {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
      const o = this.index(x, y) * 4;
      floor.data[o] = r;
      floor.data[o + 1] = g;
      floor.data[o + 2] = b;
      floor.data[o + 3] = 255;
    };
    for (const { x, y, r } of this.stones) {
      const rx = r + 1;
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -rx; dx <= rx; dx += 1) {
          const e = (dx / (rx + 0.5)) ** 2 + (dy / (r + 0.5)) ** 2;
          if (e > 1) continue;
          put(x + dx, y + dy, e > 0.55 ? [70, 62, 56] : [120, 112, 100]);
        }
      }
      for (let dx = -r + 1; dx <= 0; dx += 1) put(x + dx, y - r + 1, [168, 158, 140]);
    }
  }

  private placeDecor(): void {
    const open = (x: number, y: number, min: number, max: number): boolean => {
      if (!this.isWater(x, y)) return false;
      const i = this.index(x, y);
      const d = this.depth[i]!;
      return !this.object[i] && d >= min && d <= max;
    };
    for (let tries = 0; this.sparkles.length < SPARKLE_COUNT && tries < SPARKLE_COUNT * 20; tries += 1) {
      const x = Math.floor(this.rng.next() * this.width);
      const y = Math.floor(this.rng.next() * this.height);
      if (open(x, y, 4, Infinity)) this.sparkles.push({ x, y, phase: this.rng.next() * CYCLE_FRAMES, length: this.rng.next() < 0.5 ? 2 : 3 });
    }
    const centers: { x: number; y: number }[] = [];
    for (let tries = 0; centers.length < LILY_GROUPS && tries < 4000; tries += 1) {
      const x = Math.floor(this.rng.next() * this.width);
      const y = Math.floor(this.rng.next() * this.height);
      if (!open(x, y, 6, 10)) continue;
      if (Math.hypot(x - this.hole.x, y - this.hole.y) < 40) continue;
      if (centers.some((c) => Math.hypot(c.x - x, c.y - y) < 60)) continue;
      centers.push({ x, y });
    }
    for (const center of centers) {
      const pads = this.rng.next() < 0.5 ? 3 : 4;
      for (let tries = 0, made = 0; made < pads && tries < 60; tries += 1) {
        const x = Math.round(center.x + this.rng.between(-9, 9));
        const y = Math.round(center.y + this.rng.between(-6, 6));
        if (!open(x, y, 4, 14) || this.lilies.some((pad) => Math.hypot(pad.x - x, pad.y - y) < 7)) continue;
        this.lilies.push({ x, y });
        made += 1;
      }
    }
    this.bubbles = Array.from({ length: BUBBLES }, () => ({ phase: this.rng.next(), offset: this.rng.between(-4, 4) }));
    this.causticPoints = Array.from({ length: CAUSTIC_POINTS }, () => ({
      x: this.rng.between(0, this.width),
      y: this.rng.between(0, this.height),
      ax: this.rng.between(-1, 1),
      ay: this.rng.between(-1, 1),
    }));
  }

  /** ลายแสงใต้น้ำกับเงาเมฆ ใช้การผสมสีของ WebGL จึงทำเฉพาะเครื่องที่รองรับ */
  private setUpLightLayers(depth: number): void {
    const maskKey = 'pond_water_mask';
    if (this.scene.textures.exists(maskKey)) this.scene.textures.remove(maskKey);
    const mask = this.scene.textures.createCanvas(maskKey, this.width, this.height)!;
    const maskData = new ImageData(this.width, this.height);
    for (let i = 0; i < this.water.length; i += 1) if (this.water[i]) maskData.data.set([255, 255, 255, 255], i * 4);
    mask.getContext().putImageData(maskData, 0, 0);
    mask.refresh();
    const maskImage = this.scene.make.image({ x: this.left, y: this.top, key: maskKey, add: false }).setOrigin(0);

    const cloudKey = 'pond_cloud';
    if (!this.scene.textures.exists(cloudKey)) {
      const cloud = this.scene.textures.createCanvas(cloudKey, CLOUD_RX * 2, CLOUD_RY * 2)!;
      const data = new ImageData(CLOUD_RX * 2, CLOUD_RY * 2);
      for (let y = 0; y < CLOUD_RY * 2; y += 1) {
        for (let x = 0; x < CLOUD_RX * 2; x += 1) {
          const e = ((x - CLOUD_RX) / CLOUD_RX) ** 2 + ((y - CLOUD_RY) / CLOUD_RY) ** 2;
          if (e < 0.75 || (e < 1 && BAYER4[y % 4]![x % 4]! < 8)) data.data.set([CLOUD_TINT, CLOUD_TINT, CLOUD_TINT, 255], (y * CLOUD_RX * 2 + x) * 4);
        }
      }
      cloud.getContext().putImageData(data, 0, 0);
      cloud.refresh();
    }
    this.cloud = this.scene.add
      .image(this.left, this.top, cloudKey)
      .setOrigin(0)
      .setDepth(depth + 0.2)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setMask(maskImage.createBitmapMask());
    this.caustic = this.scene.add.image(this.left, this.top, '__DEFAULT').setOrigin(0).setDepth(depth + 0.1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  }

  /** ทำลายแสงทีละเฟรมระหว่างเล่น เกมจะได้ไม่ค้างตอนเปิดฉาก */
  private bakeCausticFrame(): void {
    const frame = this.causticFrames.length;
    const key = `pond_caustic_${frame}`;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const turn = (frame / CAUSTIC_FRAMES) * Math.PI * 2;
    const xs = new Float32Array(this.causticPoints.length);
    const ys = new Float32Array(this.causticPoints.length);
    this.causticPoints.forEach((point, i) => {
      xs[i] = (point.x + Math.cos(turn + point.ax * 3) * 6 + this.width) % this.width;
      ys[i] = (point.y + Math.sin(turn + point.ay * 3) * 4 + this.height) % this.height;
    });
    const nearest = new NearestPoints(xs, ys, 16);
    const data = new ImageData(this.width, this.height);
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const i = this.index(x, y);
        if (!this.water[i] || this.object[i]) continue;
        const [, first, second] = nearest.query(x, y);
        if (second - first >= 1.1) continue;
        const light = Math.round(30 * Math.min(1, Math.max(0.15, 1 - this.depth[i]! / 26)) * (1 - 0.6 * this.shade[i]!));
        data.data.set([light, light, light, 255], i * 4);
      }
    }
    const canvas = this.scene.textures.createCanvas(key, this.width, this.height)!;
    canvas.getContext().putImageData(data, 0, 0);
    canvas.refresh();
    this.causticFrames.push(key);
  }

  /** จุดลงทุ่นที่ใกล้เท้าที่สุดใน 4 ทิศ ต้องเป็นน้ำเปิดที่ห่างตลิ่งพอ ตอบ null เมื่ออยู่ไกลน้ำ */
  castSpot(
    feetX: number,
    feetY: number,
    reach: { minPx: number; maxPx: number; minDepth: number },
    prefer: Direction4,
    throws: Record<'north' | 'south' | 'east', readonly number[]>,
  ): CastSpot | null {
    const deep = (x: number, y: number): boolean => this.open(x, y) && this.depth[this.index(x, y)]! >= reach.minDepth;
    let best: (CastSpot & { score: number }) | null = null;
    for (const [facing, dx, dy] of CAST_DIRECTIONS) {
      for (let distance = reach.minPx; distance <= reach.maxPx; distance += 1) {
        const x = Math.round(feetX + dx * distance) - this.left;
        const y = Math.round(feetY + dy * distance) - this.top;
        if (!deep(x, y)) continue;
        const score = distance - (facing === prefer ? FACING_BONUS_PX : 0);
        if (!best || score < best.score) best = { x, y, facing, score };
        break;
      }
    }
    if (!best) return null;
    // เหวี่ยงทุ่นออกไปทางปลายคัน ไม่ให้ตัวละครบังทุ่น ถ้าตรงนั้นไม่ใช่น้ำลึกพอ ถอยกลับมาหาน้ำจุดแรก
    const [throwX = 0, throwY = 0] = throws[best.facing === 'west' ? 'east' : best.facing];
    const targetX = Math.round(feetX + (best.facing === 'west' ? -throwX : throwX)) - this.left;
    const targetY = Math.round(feetY + throwY) - this.top;
    for (let step = THROW_STEPS; step >= 0; step -= 1) {
      const x = Math.round(best.x + ((targetX - best.x) * step) / THROW_STEPS);
      const y = Math.round(best.y + ((targetY - best.y) * step) / THROW_STEPS);
      if (deep(x, y)) return { x: x + this.left, y: y + this.top, facing: best.facing };
    }
    return { x: best.x + this.left, y: best.y + this.top, facing: best.facing };
  }

  setEffects(on: boolean): void {
    this.effectsOn = on;
    this.cloud?.setVisible(on);
    this.caustic?.setVisible(on && this.causticFrames.length === CAUSTIC_FRAMES);
  }

  update(time: number): void {
    if (this.caustic && this.causticFrames.length < CAUSTIC_FRAMES) {
      this.bakeCausticFrame();
      if (this.causticFrames.length === CAUSTIC_FRAMES) this.caustic.setVisible(this.effectsOn);
    }
    if (this.cloud) {
      const travel = this.width + CLOUD_RX * 2 + 160;
      const share = (time % CLOUD_MS) / CLOUD_MS;
      this.cloud.setPosition(Math.round(this.left - CLOUD_RX * 2 - 80 + share * travel), Math.round(this.top + this.height * 0.45 - CLOUD_RY));
    }
    const frame = Math.floor(time / FRAME_MS) % CYCLE_FRAMES;
    if (frame === this.shownFrame) return;
    this.shownFrame = frame;
    if (this.caustic && this.causticFrames.length === CAUSTIC_FRAMES) {
      this.caustic.setTexture(this.causticFrames[Math.floor((frame / CYCLE_FRAMES) * CAUSTIC_FRAMES)]!);
    }
    this.draw(frame);
  }

  private dot(x: number, y: number, rgb: number, alpha = 1): void {
    this.graphics.fillStyle(rgb, alpha);
    this.graphics.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  private open(x: number, y: number): boolean {
    const rx = Math.round(x);
    const ry = Math.round(y);
    return this.isWater(rx, ry) && !this.object[this.index(rx, ry)];
  }

  private draw(frame: number): void {
    const g = this.graphics;
    g.clear();
    const share = frame / CYCLE_FRAMES;
    const turn = share * Math.PI * 2;

    for (const fish of FISH) {
      const t = (share + fish.phase) % 1;
      const travel = t * 70;
      const x = this.hole.x + Math.cos(fish.angle) * travel;
      const y = this.hole.y + Math.sin(fish.angle) * travel * 0.7;
      const alpha = (160 * Math.sin(t * Math.PI)) / 255;
      if (alpha <= 0 || !this.open(x, y)) continue;
      const cx = Math.cos(fish.angle);
      const cy = Math.sin(fish.angle);
      const length = 6 + fish.size * 2;
      for (let i = -Math.floor(length / 2); i <= Math.floor(length / 2); i += 1) {
        const widthHere = Math.abs(i) < length / 3 ? 1.6 : 0.8;
        for (const j of [-1, 0, 1]) {
          if (Math.abs(j) > widthHere) continue;
          const px = x + cx * i - cy * j;
          const py = y + cy * i * 0.7 + cx * j;
          if (this.open(px, py)) this.dot(px, py, 0x0a1e32, alpha);
        }
      }
      for (const j of [-2, 2]) {
        const tail = Math.floor(length / 2) + 2;
        const px = x - cx * tail - cy * j;
        const py = y - cy * tail * 0.7 + cx * j;
        if (this.open(px, py)) this.dot(px, py, 0x0a1e32, alpha);
      }
    }

    for (const bubble of this.bubbles) {
      const t = (share * 1.5 + bubble.phase) % 1;
      const bx = this.hole.x + bubble.offset + Math.sin(t * 9 + bubble.phase * 10) * 1.2;
      const by = this.hole.y - t * 14;
      const alpha = (220 * (1 - t * 0.6)) / 255;
      const ring = t < 0.92 ? ellipseOutline(bx, by, t < 0.5 ? 1 : 2, t < 0.5 ? 1 : 2) : ellipseOutline(bx, by + 0.5, 4, 1.5);
      for (const [x, y] of ring) this.dot(x, y, 0xc8f0fa, t < 0.92 ? alpha : 120 / 255);
    }

    for (const sparkle of this.sparkles) {
      const t = ((frame + sparkle.phase) % CYCLE_FRAMES) / CYCLE_FRAMES;
      const alpha = Math.sin(t * Math.PI);
      if (alpha < 0.05) continue;
      const startX = Math.floor(sparkle.x + t * 4);
      for (let k = 0; k < (alpha > 0.5 ? sparkle.length : 1); k += 1) {
        if (this.open(startX + k, sparkle.y)) this.dot(startX + k, sparkle.y, 0xe1fafa, (190 * alpha) / 255);
      }
    }

    for (const rock of [...this.rocks, ...this.traps]) {
      for (const offset of [0, CYCLE_FRAMES / 2]) {
        const t = ((frame + offset) % CYCLE_FRAMES) / CYCLE_FRAMES;
        const grow = Math.floor(t * 8);
        for (const [x, y] of ellipseOutline(rock.x, rock.y, 8 + grow * 2, 2 + grow / 2)) {
          if (this.open(x, y)) this.dot(x, y, 0xbeebe8, (190 * (1 - t)) / 255);
        }
      }
    }

    this.stones.forEach((stone) => {
      if ((Math.floor(frame / 6) + stone.x) % 5 === 0) this.dot(stone.x + stone.r + 1, stone.y + stone.r, 0xdcf5f5);
    });

    this.reeds.forEach((reed, i) => {
      const sway = Math.round(Math.sin(turn + i));
      [
        [9, -2],
        [12, 0],
        [8, 2],
      ].forEach(([height, dx], k) => {
        const tipX = reed.x + dx! + sway * (k % 2);
        const tipY = reed.y - height!;
        for (const [x, y] of linePoints(reed.x + dx!, reed.y, tipX, tipY)) this.dot(x, y, 0x46783c);
        this.dot(tipX, tipY, 0x78aa50);
      });
      for (const [x, y] of linePoints(reed.x, reed.y - 12 + sway, reed.x, reed.y - 9 + sway)) this.dot(x, y, 0x785032);
    });

    this.lilies.forEach((pad, i) => {
      const bob = Math.round(Math.sin(turn + i));
      const y = pad.y + bob;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          const e = (dx / 4.5) ** 2 + (dy / 2.5) ** 2;
          if (e > 1) continue;
          this.dot(pad.x + dx, y + dy, e > 0.55 ? color([40, 96, 56]) : color([96, 170, 80]));
        }
      }
      for (const [x, py] of linePoints(pad.x, y, pad.x + 3, y - 1)) this.dot(x, py, color([40, 96, 56]));
      if (i % 3 === 0) {
        this.dot(pad.x - 1, y - 1, 0xffbed2);
        this.dot(pad.x, y - 1, 0xffe6f0);
      }
    });
  }
}
