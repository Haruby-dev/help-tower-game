import { z } from 'zod';

export const displaySchema = z.strictObject({
  baseWidth: z.number().int().positive(),
  baseHeight: z.number().int().positive(),
});

export const balanceSchema = z.strictObject({
  player: z.strictObject({
    speed: z.number().positive(),
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
});

const tilesetEntrySchema = z.strictObject({
  type: z.literal('tileset'),
  pixellabId: z.uuid(),
  recolor: z.literal('soft').optional(),
  file: z.string().min(1),
  metaFile: z.string().min(1),
});

const assetEntrySchema = z.discriminatedUnion('type', [
  characterEntrySchema,
  objectEntrySchema,
  tilesetEntrySchema,
]);

export const registrySchema = z.record(z.string().regex(/^[a-z0-9_]+$/), assetEntrySchema);

/** ตำแหน่งแถวของเท้าในแต่ละเฟรม วัดจากภาพจริงโดย fetch-assets */
export const spriteMetaSchema = z.record(
  z.string(),
  z.strictObject({ footY: z.record(z.string(), z.number().int().positive()) }),
);

export const tilesetMetaSchema = z.array(
  z.strictObject({
    index: z.number().int().nonnegative(),
    corners: z.strictObject({
      NW: z.enum(['lower', 'upper']),
      NE: z.enum(['lower', 'upper']),
      SW: z.enum(['lower', 'upper']),
      SE: z.enum(['lower', 'upper']),
    }),
  }),
);

export type CharacterEntry = z.infer<typeof characterEntrySchema>;
export type ObjectEntry = z.infer<typeof objectEntrySchema>;
export type TilesetEntry = z.infer<typeof tilesetEntrySchema>;
export type AssetEntry = z.infer<typeof assetEntrySchema>;
export type Registry = z.infer<typeof registrySchema>;
export type SpriteMeta = z.infer<typeof spriteMetaSchema>;
export type TilesetMeta = z.infer<typeof tilesetMetaSchema>;
