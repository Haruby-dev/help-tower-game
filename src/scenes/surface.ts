import type Phaser from 'phaser';

/** ชุดพื้นที่มีฝั่งดิน: ลานดินหน้าบ้าน (หญ้ากับดิน) และดินแปลงผัก */
const DIRT_TILESETS = new Set(['ground_grass_dirt', 'ground_farm_soil']);

export type Surface = 'grass' | 'dirt';

/**
 * พื้นใต้เท้าตอนนี้ ใช้เลือกเสียงเท้า: ดูชั้นพื้นที่มองเห็นจากบนลงล่าง แผ่นพื้นแบบ Wang ที่ครึ่งหญ้าครึ่งดิน
 * อ่านสีพิกเซลตรงจุดเท้า (ดินแดงกว่าเขียว หญ้าเขียวกว่าแดง แม้ลงสีหยกแล้ว) อย่างอื่นนับเป็นหญ้า
 */
export class SurfaceMap {
  private readonly pixels = new Map<string, { data: Uint8ClampedArray; width: number }>();

  constructor(
    private readonly scene: Phaser.Scene,
    /** ชั้นพื้นเรียงจากบนลงล่าง (ที่ดินที่ซื้อแล้วอยู่บนพื้นหลัก) */
    private readonly layers: () => Phaser.Tilemaps.TilemapLayer[],
  ) {}

  at(x: number, y: number): Surface {
    for (const layer of this.layers()) {
      if (!layer.visible) continue;
      const tile = layer.getTileAtWorldXY(x, y);
      if (!tile || tile.index < 0 || !tile.tileset) continue;
      return this.classify(tile, x, y);
    }
    return 'grass';
  }

  private classify(tile: Phaser.Tilemaps.Tile, x: number, y: number): Surface {
    const tileset = tile.tileset!;
    if (!DIRT_TILESETS.has(tileset.name)) return 'grass';
    const corner = tileset.getTileTextureCoordinates(tile.index) as { x: number; y: number } | null;
    const image = this.read(tileset);
    if (!corner || !image) return 'grass';
    const px = Math.min(tile.width - 1, Math.max(0, Math.floor(x - tile.pixelX)));
    const py = Math.min(tile.height - 1, Math.max(0, Math.floor(y - tile.pixelY)));
    const at = ((corner.y + py) * image.width + corner.x + px) * 4;
    const red = image.data[at]!;
    const green = image.data[at + 1]!;
    return image.data[at + 3]! > 0 && red > green ? 'dirt' : 'grass';
  }

  private read(tileset: Phaser.Tilemaps.Tileset): { data: Uint8ClampedArray; width: number } | null {
    const key = tileset.image?.key;
    if (!key) return null;
    const known = this.pixels.get(key);
    if (known) return known;
    const source = this.scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(source, 0, 0);
    const image = { data: context.getImageData(0, 0, source.width, source.height).data, width: source.width };
    this.pixels.set(key, image);
    return image;
  }
}
