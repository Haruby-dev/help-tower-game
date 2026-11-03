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
  /** ขนาดที่หน้าสมุดสูตร 201×300 ต้องใส่ได้ พร้อมขอบ */
  bookDesign: z.strictObject({ width: z.number().positive(), height: z.number().positive() }),
  /** หน้าเริ่มเกมวาดที่ 640×360 */
  titleDesign: z.strictObject({ width: z.number().positive(), height: z.number().positive() }),
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
  cooking: z.strictObject({
    reachPx: z.number().positive(),
    twoStarHappiness: z.number(),
    rawFullness: z.number(),
    ranks: z.record(z.string().min(1), z.strictObject({ minutes: z.number().positive(), fullness: z.number(), equipment: z.string().min(1) })),
    drink: z.strictObject({ minutes: z.number().positive(), fullness: z.number() }),
    mystery: z.strictObject({
      minutes: z.number().positive(),
      fullness: z.number(),
      happinessPenalty: z.number(),
      icon: z.string().min(1),
      bagIcon: z.string().min(1),
    }),
    animationFps: z.number().positive(),
    /** ของเริ่มเกมชั่วคราวจนกว่าบทนำจะมาใน M9 */
    starterBag: z.record(z.string().min(1), z.number().int().positive()),
  }),
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
  fishing: z.strictObject({
    minutes: z.number().positive(),
    happinessGain: z.number(),
    cleanlinessPerHour: z.number(),
    /** ระยะจากเท้าถึงจุดลงทุ่น */
    castMinPx: z.number().positive(),
    castMaxPx: z.number().positive(),
    /** ทุ่นต้องลงในน้ำที่ห่างตลิ่งอย่างน้อยเท่านี้ */
    minDepthPx: z.number().nonnegative(),
    /** จุดลงทุ่นจากเท้า x y ตามทิศที่หัน ทิศตะวันตกกลับด้านจากตะวันออก */
    castThrow: z.strictObject({ north: z.tuple([z.number(), z.number()]), south: z.tuple([z.number(), z.number()]), east: z.tuple([z.number(), z.number()]) }),
    waitMinMs: z.number().positive(),
    waitMaxMs: z.number().positive(),
    biteWindowMs: z.number().positive(),
    autoTapMs: z.number().positive(),
    nibbleRepeatsMin: z.number().int().positive(),
    nibbleRepeatsMax: z.number().int().positive(),
    castFps: z.number().positive(),
    waitFps: z.number().positive(),
    bobberIdleFps: z.number().positive(),
    bobberNibbleFps: z.number().positive(),
    bobberBiteFps: z.number().positive(),
    reelMs: z.number().positive(),
    /** ตั้งแต่ชั่วโมงนี้ถึงตีสองนับเป็นกลางคืน หีบออกง่ายขึ้น */
    nightFromHour: z.number(),
    chestBonus: z.number().nonnegative(),
    startRod: z.string().min(1),
    rods: z.record(z.string().min(1), z.strictObject({ maxRank: z.string().min(1), chestChance: z.number().min(0).max(1) })),
    /** ของเริ่มเกมชั่วคราว เปลี่ยนเป็นรางวัลเกตใน M8 */
    starterBag: z.record(z.string().min(1), z.number().int().positive()),
  }),
  bath: z.strictObject({ minutes: z.number().positive(), cleanlinessGain: z.number(), fps: z.number().positive() }),
  weather: z.strictObject({
    chances: z.strictObject({ sunny: z.number().min(0), rain: z.number().min(0), cloudy: z.number().min(0) }),
    firstDay: z.enum(['sunny', 'rain', 'cloudy']),
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

export const weatherSchema = z.enum(['sunny', 'rain', 'cloudy']);

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
    cooking: z.strictObject({
      slot: z.strictObject({ recipe: z.string().min(1), stars: z.number().int().positive(), minutesLeft: z.number().nonnegative() }).nullable(),
    }),
    recipes: z.strictObject({ known: z.array(z.string().min(1)), bestStars: z.record(z.string(), z.number().int().positive()) }),
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
        clips: z.array(z.string()),
      }),
    }),
    /** สุ่มสภาพอากาศทุกเช้าจากเลขนี้ เซฟเดียวกันจึงได้อากาศเดิมเสมอ */
    seed: z.number().int(),
    weather: weatherSchema,
    fishing: z.strictObject({ rods: z.array(z.string().min(1)).min(1), caught: z.record(z.string(), z.number().int().positive()) }),
    chests: z.strictObject({ sinceCosmetic: z.number().int().nonnegative() }),
    /** ของเล่นจีโอ ระบบใช้ของเล่นมาใน M6 */
    toys: z.array(z.string().min(1)),
    /** ของจากหีบที่ยังไม่มีระบบ เก็บจำนวนไว้ก่อน */
    stash: z.record(z.string(), z.number().int().positive()),
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

const recipeSchema = z.strictObject({
  category: z.enum(['savory', 'sweet', 'drink']),
  rank: z.string().min(1),
  ingredients: z.record(z.string().regex(/^(produce|ing)_[a-zA-Z_]+$/), z.number().int().positive()),
  price: z.number().int().positive(),
  /** วิธีได้สูตร start คือรู้ตั้งแต่วันแรก */
  source: z.enum(['start', 'shop', 'gate', 'quest']),
  /** รหัสภาพในทะเบียน ไม่มีคือใช้กล่องสีแทน */
  icon: z.string().min(1).optional(),
  /** ภาพเล็กสำหรับช่องกระเป๋า ไม่เกิน 32px */
  bagIcon: z.string().min(1).optional(),
});

/** วิธีทำสูตรละ 3 ขั้น */
export const recipeStepsSchema = z.record(z.string().regex(/^[a-z_]+$/), z.array(z.string().min(1).max(40)).length(3));

export const recipesSchema = z.record(z.string().regex(/^[a-z_]+$/), recipeSchema);
export const ingredientsSchema = z.record(z.string().regex(/^[a-zA-Z_]+$/), z.strictObject({ value: z.number().positive() }));

export type Recipe = z.infer<typeof recipeSchema>;
export type Recipes = z.infer<typeof recipesSchema>;

const rankSchema = z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']);

/** ปลาหนึ่งชนิด เพิ่มปลาได้โดยแก้แค่ fish.json กับ th.json · hours นับต่อเนื่องจากเที่ยงคืน 26 คือตีสอง null คือทั้งวัน */
export const fishSchema = z.record(
  z.string().regex(/^[a-z_]+$/),
  z.strictObject({
    rank: rankSchema,
    hours: z.tuple([z.number(), z.number()]).nullable(),
    weather: z.enum(['any', 'sunny', 'rain', 'cloudy']),
    /** normal กินเหยื่อทุกแบบ เหยื่ออื่นต้องใช้เหยื่อนั้นเท่านั้น */
    bait: z.string().min(1),
    price: z.number().int().positive(),
    /** โอกาสเทียบกับปลาตัวอื่นที่ออกในเวลาเดียวกัน */
    weight: z.number().positive(),
    rod: z.string().min(1),
  }),
);
export type FishTable = z.infer<typeof fishSchema>;

export const baitsSchema = z.record(
  z.string().regex(/^[a-z_]+$/),
  z.strictObject({
    item: z.string().regex(/^bait_[a-z_]+$/),
    /** null คือผักอะไรก็ได้ */
    produce: z.string().min(1).nullable(),
    yield: z.number().int().positive(),
    source: z.enum(['start', 'shop', 'gate']),
  }),
);
export type Baits = z.infer<typeof baitsSchema>;

const chestTierSchema = z.enum(['wooden', 'silver', 'golden']);
const raritySchema = z.enum(['common', 'uncommon', 'rare']);
const chestCategorySchema = z.enum(['seasoning', 'items', 'toys', 'cosmetics']);
const tierWeights = z.strictObject({ wooden: z.number().min(0), silver: z.number().min(0), golden: z.number().min(0) });

/** หีบสมบัติจากการตกปลา ตัวเลขชั่วคราวตามเอกสารหีบ */
export const chestsSchema = z.strictObject({
  tiers: z.record(
    chestTierSchema,
    z.strictObject({
      item: z.string().regex(/^chest_[a-z]+$/),
      chance: z.number().min(0).max(1),
      rolls: z.number().int().positive(),
      coins: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
      duplicateStars: z.number().int().nonnegative(),
      /** uncommon คือ 1 ครั้งได้ของหายากขึ้นไป cosmetic คือ 1 ครั้งได้ของแต่ง */
      guarantee: z.enum(['uncommon', 'cosmetic']).nullable(),
    }),
  ),
  categories: z.record(chestCategorySchema, tierWeights),
  rarity: z.strictObject({ common: z.number().min(0), uncommon: z.number().min(0), rare: z.number().min(0) }),
  pityAfter: z.number().int().positive(),
  pool: z.array(
    z.strictObject({
      category: chestCategorySchema,
      rarity: raritySchema,
      /** bag เข้ากระเป๋า · seed_bag สุ่มเมล็ดจากร้าน · toy ของเล่น · cosmetic ของแต่ง · stash ยังไม่มีระบบ */
      kind: z.enum(['bag', 'seed_bag', 'toy', 'cosmetic', 'stash']),
      item: z.string().min(1),
      min: z.number().int().positive(),
      max: z.number().int().positive(),
      minTier: chestTierSchema.optional(),
    }),
  ),
});
export type Chests = z.infer<typeof chestsSchema>;
export type ChestTier = z.infer<typeof chestTierSchema>;
export type Rarity = z.infer<typeof raritySchema>;

export const cosmeticsSchema = z.record(
  z.string().regex(/^[a-z_]+$/),
  z.strictObject({ slot: z.enum(['canSkins', 'charms', 'clips', 'cases', 'wallpapers']), art: z.string().min(1) }),
);
export type CosmeticTable = z.infer<typeof cosmeticsSchema>;

/** บทพูดฟองคำพูดของตัวเอก แก้ได้โดยไม่แตะโค้ด */
export const linesSchema = z.strictObject({
  player: z.strictObject({
    lowGauge: z.strictObject({
      fullness: z.string().min(1),
      happiness: z.string().min(1),
      cleanliness: z.string().min(1),
    }),
    bagFull: z.string().min(1),
    mysteryFood: z.string().min(1),
    fishEscaped: z.string().min(1),
    noBait: z.string().min(1),
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
  /** จุดในแต่ละเฟรมนับจากมุมซ้ายบน เช่น ปลายคันเบ็ด หรือปลายเสาทุ่น คีย์คือเลขเฟรม */
  anchors: z.record(z.string().regex(/^[0-9]+$/), z.tuple([z.number().int(), z.number().int()])).optional(),
  /** จุดที่วางลงบนโลก เช่น ระดับน้ำของทุ่น */
  pivot: z.tuple([z.number().int(), z.number().int()]).optional(),
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
