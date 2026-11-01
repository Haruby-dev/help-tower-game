import { z } from 'zod';

const rgbSchema = z.tuple([z.number(), z.number(), z.number()]);

export const displaySchema = z.strictObject({
  baseWidth: z.number().int().positive(),
  baseHeight: z.number().int().positive(),
  lighting: z.strictObject({
    maskDivisor: z.number().int().positive(),
    seed: z.number().int(),
    treeBlobs: z.number().int().positive(),
    patchBlobs: z.number().int().positive(),
    blobRadiusMin: z.number().positive(),
    blobRadiusMax: z.number().positive(),
    fleckPerScreen: z.number().int().positive(),
    fleckRadiusMin: z.number().positive(),
    fleckRadiusMax: z.number().positive(),
    softEdge: z.number().positive(),
    driftPx: z.number().nonnegative(),
    driftSpeed: z.number().positive(),
    shadeTint: rgbSchema,
    shadeStrength: z.number(),
    warmGrade: rgbSchema,
    poolAdd: rgbSchema,
    glowFire: rgbSchema,
    glowGate: rgbSchema,
    glowBurrow: rgbSchema,
    glowStrength: z.number(),
    flickerAmount: z.number(),
    vignetteStrength: z.number(),
    vignetteRadius: z.number().positive(),
  }),
});

export const balanceSchema = z.strictObject({
  player: z.strictObject({
    speed: z.number().positive(),
  }),
  land: z.strictObject({
    /** ราคาชั่วคราวของที่ดิน 3 แปลง เรียงจากซ้ายไปขวา */
    prices: z.array(z.number().int().positive()).length(3),
  }),
  gio: z.strictObject({
    sitMinMs: z.number().positive(),
    sitMaxMs: z.number().positive(),
    hopSpeed: z.number().positive(),
    wanderRadius: z.number().positive(),
    keepAwayDistance: z.number().positive(),
  }),
});

export const translationsSchema = z.record(z.string().min(1), z.string().min(1));

const characterEntrySchema = z.strictObject({
  type: z.literal('character'),
  pixellabId: z.uuid(),
  animation: z.string().min(1),
  group: z.uuid().optional(),
  /** ใช้แทน group เมื่อแต่ละทิศมาจากคนละกลุ่มท่า */
  directionGroups: z.record(z.string().min(1), z.uuid()).optional(),
  directions: z.record(z.string().min(1), z.url()),
  frameCount: z.number().int().positive(),
  frameWidth: z.number().int().positive(),
  frameHeight: z.number().int().positive(),
  frameRate: z.number().positive().optional(),
  file: z.string().min(1),
});

const objectEntrySchema = z.strictObject({
  type: z.literal('object'),
  pixellabId: z.uuid(),
  url: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  file: z.string().min(1),
  jade_tone: z.boolean().optional(),
  /** เหตุผลที่เลิกใช้ ภาพยังอยู่จนกว่าแผนที่จะเลิกอ้างถึง */
  not_used: z.string().min(1).optional(),
});

const tilesetEntrySchema = z.strictObject({
  type: z.literal('tileset'),
  pixellabId: z.uuid(),
  file: z.string().min(1),
  metaFile: z.string().min(1),
  jade_tone: z.boolean().optional(),
});

/** ภาพที่เก็บในโปรเจกต์ ไม่ดึงจาก PixelLab */
const localEntrySchema = z.strictObject({
  type: z.literal('local'),
  source: z.string().min(1),
  pixellab_job: z.string().min(1).optional(),
  index: z.number().int().nonnegative().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  file: z.string().min(1),
  jade_tone: z.boolean().optional(),
  /** ภาพต้นไม้ที่ใช้เทียบสีเขียวของบ้าน */
  jade_tone_house_ref: z.string().min(1).optional(),
  currency: z.enum(['coins', 'stars']).optional(),
  /** ยังไม่โหลดตอนเปิดเกม */
  lazy: z.boolean().optional(),
  note: z.string().min(1).optional(),
});

/** ชุดพื้นที่ภาพอยู่ในโปรเจกต์แล้ว ดึงจาก PixelLab แค่ metadata */
const localTilesetEntrySchema = z.strictObject({
  type: z.literal('local_tileset'),
  pixellabId: z.uuid(),
  source: z.string().min(1),
  file: z.string().min(1),
  metaFile: z.string().min(1),
  jade_tone: z.boolean().optional(),
  lazy: z.boolean().optional(),
  note: z.string().min(1).optional(),
  /** สีโดยประมาณของพื้นล่างในภาพต้นฉบับ ใช้แยกมุมแผ่น เพราะ corners ใน metadata ไม่ตรงกับภาพ */
  lower_rgb: z.tuple([z.number(), z.number(), z.number()]),
});

/** ภาพที่ตัดสินแล้วว่าไม่ใช้ เก็บไว้กันหยิบมาใช้ผิด ไม่มีไฟล์ในเกม */
const notUsedEntrySchema = z.strictObject({
  type: z.literal('not_used'),
  pixellab_job: z.string().min(1),
  reason: z.string().min(1),
});

/** กล่องสีพร้อมชื่อ ใช้จนกว่าภาพจริงจะมา สลับเป็นภาพจริงด้วยการแก้ทะเบียน */
const placeholderEntrySchema = z.strictObject({
  type: z.literal('placeholder'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  color: z.string().regex(/^#[0-9a-f]{6}$/),
  labelKey: z.string().min(1),
  gridSize: z.number().int().positive().optional(),
});

const assetEntrySchema = z.discriminatedUnion('type', [
  characterEntrySchema,
  objectEntrySchema,
  tilesetEntrySchema,
  localEntrySchema,
  localTilesetEntrySchema,
  notUsedEntrySchema,
  placeholderEntrySchema,
]);

export const registrySchema = z.record(z.string().regex(/^[a-z0-9_]+$/), assetEntrySchema);

/** ตำแหน่งแถวของเท้าในแต่ละเฟรม วัดจากภาพจริงโดย fetch-assets */
export const spriteMetaSchema = z.record(
  z.string(),
  z.strictObject({ footY: z.record(z.string(), z.number().int().positive()) }),
);

const cornerSide = z.enum(['lower', 'upper', 'transition']);

export const tilesetMetaSchema = z.array(
  z.strictObject({
    index: z.number().int().nonnegative(),
    corners: z.strictObject({ NW: cornerSide, NE: cornerSide, SW: cornerSide, SE: cornerSide }),
    /** แผ่นที่ pattern_4x4 ระบุเพื่อนบ้านเหนือหรือใต้ไว้ เช่น หน้าผาที่กินสองแถว */
    hinted: z.boolean(),
  }),
);

export type CharacterEntry = z.infer<typeof characterEntrySchema>;
export type ObjectEntry = z.infer<typeof objectEntrySchema>;
export type TilesetEntry = z.infer<typeof tilesetEntrySchema>;
export type LocalEntry = z.infer<typeof localEntrySchema>;
export type LocalTilesetEntry = z.infer<typeof localTilesetEntrySchema>;
export type AssetEntry = z.infer<typeof assetEntrySchema>;
export type Registry = z.infer<typeof registrySchema>;
export type SpriteMeta = z.infer<typeof spriteMetaSchema>;
export type TilesetMeta = z.infer<typeof tilesetMetaSchema>;
