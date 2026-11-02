import { z } from 'zod';

const rgbSchema = z.tuple([z.number(), z.number(), z.number()]);

export const displaySchema = z.strictObject({
  baseWidth: z.number().int().positive(),
  baseHeight: z.number().int().positive(),
  /** ความมืดของฉากตามเวลา เรียงตามชั่วโมง */
  night: z.strictObject({
    color: z.string().regex(/^#[0-9a-f]{6}$/),
    keys: z.array(z.strictObject({ hour: z.number(), alpha: z.number().min(0).max(1) })).min(2),
  }),
  /** ขนาดที่หน้าจอโทรศัพท์ต้องใส่ได้ เป็นพิกเซลเกม */
  uiDesign: z.strictObject({ width: z.number().positive(), height: z.number().positive() }),
  zoomSteps: z.array(z.number().int().nonnegative()).min(1),
  touchDefaultZoomStep: z.number().int().nonnegative(),
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
    runSpeedMultiplier: z.number().positive(),
    runAnimationMultiplier: z.number().positive(),
  }),
  time: z.strictObject({
    realSecondsPerGameHour: z.number().positive(),
    dayStartHour: z.number(),
    lateLimitHour: z.number(),
    restCurtainMs: z.number().nonnegative(),
  }),
  gauges: z.strictObject({
    min: z.number(),
    max: z.number(),
    start: z.strictObject({
      fullness: z.number(),
      happiness: z.number(),
      cleanliness: z.number(),
      homesickness: z.number(),
    }),
    fullness: z.strictObject({ awakePerHour: z.number(), asleepPerHour: z.number() }),
    happiness: z.strictObject({ sleepGain: z.number(), homesickDivisor: z.number().positive() }),
    cleanliness: z.strictObject({ idlePerHour: z.number() }),
    homesickness: z.strictObject({ perDay: z.number() }),
    faint: z.strictObject({ skipHours: z.number(), recoverTo: z.number(), gioFee: z.number() }),
  }),
  hud: z.strictObject({
    beadsPerGauge: z.number().int().positive(),
    moodHappyFrom: z.number(),
    moodNormalFrom: z.number(),
    moodTiredFrom: z.number(),
    pulseAt: z.number(),
    alertAt: z.number(),
    dirtyBelow: z.number(),
    bubbleMs: z.number().positive(),
  }),
  wallet: z.strictObject({ logLimit: z.number().int().positive() }),
  calendar: z.strictObject({
    /** 0 คือวันจันทร์ วันที่ 1 ของเกมเป็นวันเสาร์ */
    firstDayWeekdayIndex: z.number().int().min(0).max(6),
    daysPerMonth: z.number().int().positive(),
    currentFloorPlaceholder: z.number().int().positive(),
    totalFloors: z.number().int().positive(),
  }),
  interact: z.strictObject({ reachPx: z.number().positive() }),
  farm: z.strictObject({
    plotOrigin: z.strictObject({ col: z.number().int().nonnegative(), row: z.number().int().nonnegative() }),
    cols: z.number().int().positive(),
    rows: z.number().int().positive(),
    stages: z.number().int().min(2),
    actionMinutes: z.number().positive(),
    reachPx: z.number().positive(),
    actionFrameMs: z.number().positive(),
    gauges: z.strictObject({ happinessPerHour: z.number(), cleanlinessPerHour: z.number() }),
    bag: z.strictObject({ slots: z.number().int().positive(), stack: z.number().int().positive() }),
    seedsPerProduce: z.strictObject({ min: z.number().int().positive(), max: z.number().int().positive() }),
    /** ของเริ่มเกมชั่วคราวจนกว่าบทนำจะมาใน M9 */
    starterBag: z.record(z.string().min(1), z.number().int().positive()),
  }),
  land: z.strictObject({
    /** ราคาชั่วคราวของที่ดิน 3 แปลง เรียงจากซ้ายไปขวา */
    prices: z.array(z.number().int().positive()).length(3),
  }),
  gio: z.strictObject({
    sitMinMs: z.number().positive(),
    sitMaxMs: z.number().positive(),
    hopSpeed: z.number().positive(),
    hopsPerSecond: z.number().positive(),
    hopsPerTrip: z.number().int().positive(),
    hopArcPx: z.number().positive(),
    hopTakeOffShare: z.number().positive(),
    hopLandingShare: z.number().positive(),
    wanderRadius: z.number().positive(),
    keepAwayDistance: z.number().positive(),
  }),
});

export const saveFileSchema = z.strictObject({
  version: z.number().int().positive(),
  savedAt: z.string(),
  world: z.strictObject({
    day: z.number().int().positive(),
    hour: z.number(),
    gauges: z.strictObject({
      fullness: z.number(),
      happiness: z.number(),
      cleanliness: z.number(),
      homesickness: z.number(),
    }),
    player: z.strictObject({ x: z.number(), y: z.number() }).nullable(),
    wallet: z.strictObject({
      coins: z.number(),
      stars: z.number(),
      log: z.array(
        z.strictObject({
          day: z.number(),
          hour: z.number(),
          currency: z.enum(['coins', 'stars']),
          amount: z.number(),
          label: z.string(),
          category: z.string(),
        }),
      ),
      daily: z.array(z.strictObject({ day: z.number(), coins: z.number(), stars: z.number() })),
    }),
    farm: z.strictObject({
      plots: z.array(
        z.strictObject({
          tilled: z.boolean(),
          watered: z.boolean(),
          crop: z
            .strictObject({ id: z.string().min(1), daysGrown: z.number().int().nonnegative(), harvests: z.number().int().nonnegative() })
            .nullable(),
        }),
      ),
    }),
    bag: z.array(z.strictObject({ item: z.string().min(1), count: z.number().int().positive() })),
    cosmetics: z.strictObject({
      equipped: z.strictObject({
        case: z.string().min(1),
        charm: z.string().min(1).nullable(),
        wallpaper: z.string().min(1),
        canSkin: z.string().min(1),
      }),
      owned: z.strictObject({
        cases: z.array(z.string()),
        charms: z.array(z.string()),
        wallpapers: z.array(z.string()),
        canSkins: z.array(z.string()),
      }),
    }),
  }),
});

export type SaveFile = z.infer<typeof saveFileSchema>;

/** พืชหนึ่งชนิด เพิ่มพืชได้โดยแก้แค่ crops.json กับ th.json */
export const cropsSchema = z.record(
  z.string().regex(/^[a-z_]+$/),
  z.strictObject({
    source: z.enum(['start', 'shop', 'gate']),
    growDays: z.number().int().positive(),
    regrowDays: z.number().int().positive().nullable(),
    firstYield: z.number().int().positive(),
    /** เก็บซ้ำได้กี่ครั้งหลังเก็บครั้งแรก ครบแล้วต้นเหี่ยว */
    regrowTimes: z.number().int().nonnegative(),
    regrowYield: z.number().int().positive().nullable(),
    sellPrice: z.number().int().positive(),
    /** null คือไม่ขายในร้าน ได้เมล็ดจากการแปลงผลผลิตเท่านั้น */
    seedPrice: z.number().int().positive().nullable(),
  }),
);

export type Crops = z.infer<typeof cropsSchema>;

/** บทพูดฟองคำพูดของตัวเอก แก้ได้โดยไม่แตะโค้ด */
export const linesSchema = z.strictObject({
  player: z.strictObject({
    lowGauge: z.strictObject({
      fullness: z.string().min(1),
      happiness: z.string().min(1),
      cleanliness: z.string().min(1),
    }),
    bagFull: z.string().min(1),
  }),
  encouragement: z.array(z.string().min(1)).min(1),
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
  /** แก้เฟรมตอนสร้างภาพ ไม่ให้ท่าเดินขึ้นลงดูเหมือนกระโดด */
  steady_rows: z
    .record(
      z.string().min(1),
      z.strictObject({
        waistY: z.number().int().positive(),
        faceFrame: z.number().int().nonnegative().optional(),
        replaceFaces: z.array(z.number().int().nonnegative()).optional(),
        chinY: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  /** สร้างเฟรมยืดและหดจากภาพนิ่ง โดยไม่แตะจุดพิกเซลของหน้า */
  squash_stretch: z.strictObject({ rows: z.number().int().positive(), cutShare: z.number() }).optional(),
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
  /** แผ่นภาพหลายเฟรม เช่น พืช 4 ระยะ */
  frame_width: z.number().int().positive().optional(),
  frame_height: z.number().int().positive().optional(),
  frames: z.number().int().positive().optional(),
  /** เริ่มเล่นท่าจากเฟรมนี้ เฟรมก่อนหน้าใช้ไม่ได้ เช่น ยังไม่มีจอบในมือ */
  play_from: z.number().int().nonnegative().optional(),
  frames_meaning: z.array(z.string().min(1)).optional(),
  name_th: z.string().min(1).optional(),
  nine_slice: z
    .strictObject({
      left: z.number().int().nonnegative(),
      right: z.number().int().nonnegative(),
      top: z.number().int().nonnegative(),
      bottom: z.number().int().nonnegative(),
      tail: z.string().optional(),
    })
    .optional(),
  skins: z.record(z.string().min(1), z.string().min(1)).optional(),
  skin_reference: z.string().min(1).optional(),
  /** ภาพที่มีในชุดส่งมอบแต่ถูกแทนที่แล้ว ห้ามนำมาทำ */
  not_built: z.string().min(1).optional(),
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
