import { z } from 'zod';

export const displaySchema = z.strictObject({
  baseWidth: z.number().int().positive(),
  baseHeight: z.number().int().positive(),
});

export const translationsSchema = z.record(z.string().min(1), z.string().min(1));

const assetEntrySchema = z.strictObject({
  name: z.string().min(1),
  type: z.enum(['character']),
  pixellabId: z.uuid(),
  animation: z.string().min(1),
  group: z.uuid(),
  direction: z.string().min(1),
  source: z.strictObject({
    kind: z.literal('frames'),
    urlTemplate: z.url().includes('{i}'),
  }),
  frameCount: z.number().int().positive(),
  frameWidth: z.number().int().positive(),
  frameHeight: z.number().int().positive(),
  frameRate: z.number().positive(),
  file: z.string().min(1),
});

export const registrySchema = z.record(z.string().regex(/^[a-z0-9_]+$/), assetEntrySchema);

export type AssetEntry = z.infer<typeof assetEntrySchema>;
export type Registry = z.infer<typeof registrySchema>;
