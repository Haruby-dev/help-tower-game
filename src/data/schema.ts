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
  /** ขนาดที่สมุดสองหน้า (หน้าละ 297×268 พร้อมปกและปุ่มปิด) ต้องใส่ได้ เป็นพิกเซลเกม · iPhone แนวนอนได้ 3 เท่าตามภาพตัวอย่าง */
  bookDesign: z.strictObject({ width: z.number().positive(), height: z.number().positive() }),
  /** ขนาดที่หน้าต่างโทรศัพท์ขนาดกลาง (620×299 พิกเซลเกม) ต้องใส่ได้พร้อมขอบ · iPhone แนวนอนได้ 3 เท่าตามภาพตัวอย่าง */
  phoneDesign: z.strictObject({ width: z.number().positive(), height: z.number().positive() }),
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

const gioTierSchema = z.strictObject({
  from: z.number(),
  commission: z.number().min(0).max(1),
  priceBonus: z.number().min(0),
  sellShare: z.number().positive().max(1),
});

export const balanceSchema = z.strictObject({
  player: z.strictObject({
    speed: z.number().positive(),
    runSpeedMultiplier: z.number().positive(),
    runAnimationMultiplier: z.number().positive(),
    /** ท่ากินเวลาต่อเฟรม (9 เฟรม) และท่าเป็นลม เวลาต่อเฟรมกับเวลานอนค้างก่อนม่านขึ้น */
    eatFrameMs: z.array(z.number().positive()).length(9),
    faintFrameMs: z.number().positive(),
    faintHoldMs: z.number().nonnegative(),
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
    /** ไอคอนปุ่มกระทำของจุดกดใช้ทั่วไป (โต๊ะช่าง ต้นกล้วย ฯลฯ) อุ้งเท้าแมวของจอยสติ๊ก */
    interactIcon: z.string().regex(/^[a-z0-9_]+$/),
    /** บทตอนได้ของใหม่ครั้งแรกรอให้ป้ายของเด้งผ่านไปก่อน ฟองจะได้ไม่ทับป้าย */
    firstItemDelayMs: z.number().nonnegative(),
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
    /** ท่าทำอาหารตามวิธี (zone1 food update 2) ต่อทิศ: แผ่นท่า และจำนวนเฟรมเปิดตัวที่เล่นครั้งเดียว ที่เหลือวนซ้ำ ทิศตะวันตกกลับด้านจากตะวันออก */
    poses: z.record(
      z.string().regex(/^[a-z_]+$/),
      z.strictObject({
        south: z.strictObject({ sheet: z.string().min(1), intro: z.number().int().positive() }),
        east: z.strictObject({ sheet: z.string().min(1), intro: z.number().int().positive() }),
        north: z.strictObject({ sheet: z.string().min(1), intro: z.number().int().positive() }),
      }),
    ),
    /**
     * ภาชนะตามวิธีทำของสูตร: ท่าของตัวเอก ภาพกองไฟในหน้าต่าง และภาชนะบนกองไฟ (null คือไม่มี เช่น ตะแกรงรวมอยู่ในภาพกองไฟ ครกไม่ทำที่กองไฟ)
     * ภาชนะวางกลางกองไฟตามแนวนอน ห่างขอบบนภาพกองไฟ vesselY พิกเซลภาพ (ภาพตัวอย่าง: กระทะ 3 หม้อดิน 0)
     */
    methods: z.record(
      z.enum(['grill', 'iron_pan', 'clay_pot', 'bowl', 'pot', 'pan', 'oven', 'mortar']),
      z.strictObject({
        pose: z.string().min(1).nullable(),
        fire: z.string().min(1).nullable(),
        vessel: z.string().min(1).nullable(),
        vesselY: z.number().int().nonnegative().nullable(),
      }),
    ),
    /** เครื่องดื่มทุกแก้วต้องมีของนี้ในกระเป๋า (แก้วไม้ไผ่ ทำครั้งเดียวใช้ตลอด ไม่หมด) */
    drinkNeeds: z.string().regex(/^[a-z_]+$/),
    /** ทำครั้งเดียว เวลาเดียว: กดเริ่มทำแล้วนาฬิกาเดินเร็ว เวลาของแรงก์ผ่านไปในเวลาจริงเท่านี้ ระหว่างตัวเอกทำท่าทำอาหาร */
    fastCookMs: z.number().positive(),
    /** วัตถุดิบลอยลงภาชนะในหน้าต่างก่อนปิด: เวลาลอยต่อชิ้น เว้นระหว่างชิ้น และไอน้ำตอนท้าย */
    float: z.strictObject({ itemMs: z.number().positive(), gapMs: z.number().nonnegative(), steamMs: z.number().nonnegative() }),
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
    /** เก็บเกี่ยวแต่ละครั้งมีโอกาสได้เมล็ดพืชนั้นเพิ่ม 1 เมล็ด ทักษะชาวสวนแรงก์ C จะเพิ่มเป็นราว 0.33 */
    seedDropChance: z.number().min(0).max(1),
    /** ของเริ่มเกมชั่วคราวจนกว่าบทนำจะมาใน M9 */
    starterBag: z.record(z.string().min(1), z.number().int().positive()),
  }),
  /** ระบบวางของบนตาราง: โซน (ช่องแผนที่) กับของที่ย้ายได้ ขนาดฐานเป็นจำนวนช่อง เท้าของอยู่กลางขอบล่างของฐาน */
  placement: z.strictObject({
    zones: z.record(z.string().regex(/^[a-z_]+$/), z.strictObject({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() })),
    items: z.record(z.string().regex(/^[a-z0-9_]+$/), z.strictObject({ zone: z.string().min(1), cols: z.number().int().positive(), rows: z.number().int().positive() })),
  }),
  /** ปุ่มลับช่วงทดสอบ ต้องเอาออกก่อนปล่อยจริง */
  test: z.strictObject({ stars: z.number().int().positive() }),
  land: z.strictObject({
    /** ราคาชั่วคราวของที่ดิน 3 แปลง เรียงจากซ้ายไปขวา ซื้อตามลำดับ */
    prices: z.array(z.number().int().positive()).length(3),
    /** plots คือช่องแปลงผักเต็มช่อง (ช่องแผนที่) · area คือพื้นที่ในรั้ว (ช่อง ทศนิยมได้) ยังไม่ซื้อเดินเข้าไม่ได้ ซื้อแล้ววัชพืช ตอไม้ หินในนี้หายไป */
    lands: z
      .array(
        z.strictObject({
          plots: z.strictObject({ col: z.number().int(), row: z.number().int(), cols: z.number().int().positive(), rows: z.number().int().positive() }),
          area: z.strictObject({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }),
        }),
      )
      .length(3),
  }),
  /**
   * ท็อปปิ้ง (งานอาหารโซน 1 ขั้นที่ 3): ชิ้นที่ถูกประเภทได้โบนัสราคาและความชอบชิ้นละ pieceBonus (ผงนัวใช้ bonus ของตัวเอง)
   * ใส่ได้ไม่เกิน maxPieces ชิ้นต่อจาน นับทุกชิ้นรวมชิ้นผิดประเภท (ผู้ใช้ตัดสิน 9 พ.ย. 2026 02:44 เอาขวดความเยอะออก)
   * ท็อปปิ้งที่มอนสเตอร์ชอบคูณ favouriteMultiplier · spots คือกลางชิ้นบนภาพอาหาร 48 พิกเซล ชิ้นที่ k วางที่จุด k
   */
  toppings: z.strictObject({
    pieceBonus: z.number().positive(),
    maxPieces: z.number().int().positive(),
    favouriteMultiplier: z.number().positive(),
    umamiSayChance: z.number().min(0).max(1),
    openDelayMs: z.number().nonnegative(),
    dropMs: z.number().positive(),
    dropPx: z.number().int().positive(),
    spots: z.strictObject({ food: z.array(z.tuple([z.number().int(), z.number().int()])).min(1), drink: z.array(z.tuple([z.number().int(), z.number().int()])).min(1) }),
    /** ประกายผงนัวกะพริบวนบนจาน (ภาพตัวอย่าง umami_twinkle_1109.gif) ตำแหน่งนับจากกลางภาพผงนัว */
    twinkle: z.strictObject({
      at: z.tuple([z.number().int(), z.number().int()]),
      glints: z.tuple([z.tuple([z.number().int(), z.number().int()]), z.tuple([z.number().int(), z.number().int()])]),
      frames: z.array(z.strictObject({ ms: z.number().positive(), shape: z.enum(['none', 'dot', 'plus', 'big', 'glintLeft', 'glintRight']) })).min(1),
    }),
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
    /** ตกปลาอัตโนมัติรอนานกว่าและพลาดได้ ตกเองยังดีที่สุด */
    autoWaitMultiplier: z.number().min(1),
    autoCatchChance: z.number().min(0).max(1),
    /** พักก่อนเหวี่ยงเบ็ดใหม่ด้วยเหยื่อเดิม ให้เห็นของที่ได้ก่อน */
    rebaitDelayMs: z.number().nonnegative(),
    nibbleRepeatsMin: z.number().int().positive(),
    nibbleRepeatsMax: z.number().int().positive(),
    /** จังหวะทุ่นเท่ากันทุกครั้ง พักระหว่างตอดแต่ละครั้ง และพักก่อนทุ่นจม */
    nibbleGapMs: z.number().nonnegative(),
    biteLeadMs: z.number().nonnegative(),
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
    /** จีโอ v2 เดินสี่ขา ไม่กระโดดแล้ว */
    walkSpeed: z.number().positive(),
    walkFps: z.number().positive(),
    walkMinMs: z.number().positive(),
    walkMaxMs: z.number().positive(),
    sitFps: z.number().positive(),
    /** กะพริบตาระหว่างนั่งทุก ๆ ช่วงนี้ */
    blinkEveryMinMs: z.number().positive(),
    blinkEveryMaxMs: z.number().positive(),
    wanderRadius: z.number().positive(),
    keepAwayDistance: z.number().positive(),
    /** ยืนสี่ขาพักระหว่างเดินเล่น แล้วกลับไปนั่งในตะกร้าหลังเดินครบจำนวนรอบที่สุ่ม */
    standMinMs: z.number().positive(),
    standMaxMs: z.number().positive(),
    walksBeforeHomeMin: z.number().int().positive(),
    walksBeforeHomeMax: z.number().int().positive(),
    /** เดินไม่ขยับนานเท่านี้ (ชนของ) ให้หยุดยืน */
    stuckMs: z.number().positive(),
    /** แถวในภาพตะกร้า: เท้าตอนนั่ง ขอบหน้าที่วาดทับตัวจีโอ และระยะจุดลุกหน้าตะกร้า */
    seatFeetRow: z.number().int().nonnegative(),
    seatRimRow: z.number().int().nonnegative(),
    seatExitGap: z.number().positive(),
    eatFps: z.number().positive(),
    eatLoops: z.number().int().positive(),
    heartRisePx: z.number().positive(),
    heartRiseMs: z.number().positive(),
    heartStaggerMs: z.number().nonnegative(),
    heartsByTaste: z.strictObject({ like: z.number().int().nonnegative(), love: z.number().int().nonnegative(), special: z.number().int().nonnegative() }),
    sparkleBlinkMs: z.number().positive(),
    sparkleSpots: z.array(z.tuple([z.number().int(), z.number().int()])),
  }),
  /** ความสุขจีโอ ฝากขาย แมวเลีย ตามขั้นที่ 1 ของ GDD ช่วงความสุขเรียงจากสูงไปต่ำ */
  gioCare: z.strictObject({
    startHappiness: z.number(),
    dailyDecay: z.number(),
    leaveHour: z.number(),
    tripWindowHours: z.number(),
    returnHour: z.number(),
    bagSlots: z.number().int().positive(),
    tiers: z.array(gioTierSchema).min(1),
    treatsPerDay: z.number().int().positive(),
    treatGains: z.array(z.number()).min(1),
    specialWeeklyGain: z.number(),
    petGain: z.number(),
    dishStarPrice: z.array(z.number().positive()).length(3),
    talkReachPx: z.number().positive(),
    /** เกมใหม่จีโอให้เงินก้อนแรก แทนรางวัลเควสแรกของจีโอที่จะมาใน M9 (GDD 100 ×10) */
    firstGiftCoins: z.number().int().nonnegative(),
    /** ความสุขช่วงบนสุด จีโอมีโอกาสได้ของแปลก ๆ มาฝาก (GDD 20%) รายการของยังเป็นค่าชั่วคราว */
    giftChance: z.number().min(0).max(1),
    /** ได้รับตั้งแต่เท่านี้ จีโอพูดบทขายดีสุด ๆ (ค่าชั่วคราว) */
    bigDayCoins: z.number().int().nonnegative(),
    giftPool: z.array(z.strictObject({ item: z.string().min(1), count: z.number().int().positive() })).min(1),
    /** ข่าวที่ได้ตอนจีโอกลับจากเร่ขาย ตามช่วงความสุขตอนฝาก (GDD: 2 ข้อ · 1 ข้อ · 1 ข้อทุก 2 วัน) */
    newsByTier: z.array(z.strictObject({ count: z.number().int().nonnegative(), everyDays: z.number().int().positive() })).min(1),
  }),
  /** ดาวผักและอาหาร ตาม docs/star_system_2026-11-05.md · rolls คือโอกาส 1/2/3 ดาวตามระดับปุ๋ย (1 = ไม่ใส่ปุ๋ย) */
  stars: z.strictObject({
    max: z.number().int().positive(),
    rolls: z.record(z.string().regex(/^[1-3]$/), z.array(z.number().min(0).max(1)).length(3)),
    skillShift: z.number().min(0).max(1),
    happyBonusFrom: z.number(),
    happyBonusChance: z.number().min(0).max(1),
    /** ราคาขายผักตามดาว เหมือนอาหาร (ค่าที่ฝั่งโค้ดเติม รอผู้ใช้ยืนยัน) */
    priceMultiplier: z.array(z.number().positive()).length(3),
  }),
  /** รหัสปุ๋ยในกระเป๋ากับระดับของมัน */
  fertilizer: z.strictObject({ tiers: z.record(z.string().regex(/^fertilizer_[a-z0-9_]+$/), z.number().int().min(2).max(3)) }),
  /** วัสดุคราฟ (zone1 food update 4) ขายไม่ได้ ไม้ไผ่ได้จากเกต 2 (M8) ตอนนี้เสกจากการ์ดเดฟ */
  /**
   * วัสดุและงานประดิษฐ์ (งานอาหารโซน 1 ขั้นที่ 4): วัสดุ (เสกได้จากการ์ดเดฟ) · เกี่ยวพืชบางชนิดได้ของแถมต่อช่อง (ข้าว → ฟางข้าว)
   * เขย่าต้นกล้วยวันละครั้งได้ของตาม banana · startStations คือถาดตากกับลอบที่มีตั้งแต่เกมใหม่ (ลอบเก่าที่ท่าน้ำ 1 อัน)
   */
  crafting: z.strictObject({
    materials: z.array(z.string().regex(/^[a-z_]+$/)).min(1),
    reachPx: z.number().positive(),
    /** ระยะเอื้อมถาดตากกับลอบ (สั้นกว่าโต๊ะช่าง ริมบ่อจะได้ยังตกปลาได้) */
    stationReachPx: z.number().positive(),
    harvestExtras: z.record(z.string().regex(/^[a-z_]+$/), z.record(z.string().regex(/^[a-z_]+$/), z.number().int().positive())),
    banana: z.record(z.string().regex(/^[a-z_]+$/), z.number().int().positive()),
    startStations: z.strictObject({ drying_tray: z.number().int().nonnegative(), trap: z.number().int().nonnegative() }),
  }),
  /** มอนสเตอร์มาเยี่ยมและสูตรความชอบ ตาม GDD · rankBase เป็นค่าชั่วคราว (GDD ไม่ได้ระบุ) ปรับใน M10 */
  monsters: z.strictObject({
    rankBase: z.record(z.string().min(1), z.number().positive()),
    drinkBaseShare: z.number().positive(),
    taste: z.strictObject({ favourite: z.number(), like: z.number(), neutral: z.number(), dislike: z.number() }),
    variety: z.array(z.number().nonnegative()).min(1),
    starMultiplier: z.array(z.number().positive()).length(3),
    clean: z.strictObject({ goodFrom: z.number(), good: z.number(), badAtOrBelow: z.number(), bad: z.number() }),
    signatureAt: z.number().min(0).max(1),
    minRankByZone: z.array(z.string().min(1)).min(1),
    unlockedZones: z.number().int().positive(),
    visitorsBase: z.number().int().nonnegative(),
    soldPerVisitor: z.number().int().positive(),
    maxVisitors: z.number().int().positive(),
    visitFromHour: z.number(),
    visitToHour: z.number(),
    /** แขกที่ยังไม่ได้มาถึงชั่วโมงนี้ (เช่น เป็นลมข้ามไป) กินจากถาดเองโดยไม่เห็นภาพ */
    settleAfterHour: z.number(),
    appetiteMin: z.number().int().positive(),
    appetiteMax: z.number().int().positive(),
    towerMin: z.number().int().positive(),
    towerMax: z.number().int().positive(),
    warmFrom: z.number(),
    closeFrom: z.number(),
    talkChance: z.number().min(0).max(1),
    clearStars: z.number().int().nonnegative(),
    walkSpeed: z.number().positive(),
    browseMs: z.number().positive(),
    thinkMs: z.number().positive(),
    eatGapMs: z.number().nonnegative(),
    eyeSteps: z.number().int().min(2),
    labelReachPx: z.number().positive(),
    bubbleMs: z.number().positive(),
    maxBubbles: z.number().int().positive(),
    motesPerSecond: z.number().nonnegative(),
    /** หยิบเมนูโปรดกับเครื่องดื่มโปรดในการมาครั้งเดียว ความชอบของคู่นั้นคูณเท่านี้ (ค่าชั่วคราว) */
    setBonus: z.number().min(1),
    /** ตัวที่ยังระแวงคว้าอาหารแล้ววิ่งกลับโพรง ใช้ท่าเดินเร็วขึ้นเท่านี้ */
    runSpeedMultiplier: z.number().min(1),
    /** ตัวที่สนิทนั่งกินที่ลานหน้าบ้าน ห่างจากเท้าถาดเท่านี้ (พิกเซล) ถาดย้ายที่ก็ตามไป */
    yardSpots: z.array(z.tuple([z.number(), z.number()])).min(1),
    /** แฝดขี้แกล้งชั้น 5 (GDD): พี่ a น้อง b · firstPick โอกาสเป็นพี่ก่อนหลอดสลับ · teaseChance โอกาสพี่แวะมาแกล้งหลังหลอดสลับ · เวลาเฟรมฉากเฉลยเป็นมิลลิวินาที */
    twins: z.strictObject({
      a: z.string().regex(/^[a-z_]+$/),
      b: z.string().regex(/^[a-z_]+$/),
      _note: z.string().optional(),
      firstPick: z.number().min(0).max(1),
      teaseChance: z.number().min(0).max(1),
      shakeMs: z.strictObject({ first: z.number().positive(), middle: z.number().positive(), last: z.number().positive() }),
      giggleMs: z.number().positive(),
      giggleRepeat: z.number().int().positive(),
      runMs: z.number().positive(),
      jumpMs: z.number().positive(),
      standApartPx: z.number().positive(),
      stageDropPx: z.number(),
      quizReachPx: z.number().positive(),
      bellsMs: z.number().nonnegative(),
    }),
  }),
  /** ของตกแต่งที่ได้เป็นรางวัล วางในโหมดจัดวางได้ · dailyHappiness เพิ่มความสุขทุกเช้า · prefer ช่องที่ลองวางก่อน (ช่องแผนที่) */
  decor: z.record(
    z.string().regex(/^[a-z0-9_]+$/),
    z.strictObject({ swayMs: z.number().positive(), dailyHappiness: z.number().nonnegative(), todo: z.string().optional(), prefer: z.strictObject({ x: z.number().int(), y: z.number().int() }) }),
  ),
  /** ถาดอาหาร 3 · 6 · 10 จาน plates คือกลางจานในภาพถาด (นับจากมุมซ้ายบน) เรียงตามที่มอนสเตอร์เดินดู */
  tray: z.strictObject({
    reachPx: z.number().positive(),
    levels: z.array(z.strictObject({ id: z.string().min(1), plates: z.array(z.tuple([z.number().int(), z.number().int()])).min(1) })).min(1),
    stackStepPx: z.number().int().positive(),
    stackShownMax: z.number().int().positive(),
  }),
});


/** ร้านค้าระบบ ขายทุกวันกับสุ่มวันนี้ ราคาเมล็ดอ่านจาก crops.json ราคาสูตร = ราคาอาหาร × ตัวคูณ */
const volume = z.number().min(0).max(1);
export const audioSchema = z.strictObject({
  defaultVolume: z.strictObject({ bgm: volume, sfx: volume, voice: volume, amb: volume }),
  music: z.record(z.string().regex(/^bgm_[a-z_]+$/), z.strictObject({ loopStart: z.number().nonnegative() })),
  dayMusicFromHour: z.number(),
  nightMusicFromHour: z.number(),
  dayNightFadeMs: z.number().nonnegative(),
  titleFadeMs: z.number().nonnegative(),
  farmFrames: z.strictObject({ till: z.number().int(), plant: z.number().int(), water: z.number().int(), harvest: z.number().int() }),
  castFrames: z.strictObject({ east: z.number().int(), south: z.number().int(), north: z.number().int() }),
  cookLoopFadeMs: z.number().nonnegative(),
  /** เสียงพูดของตัวเอกที่ยังโหลด (ตอนนี้เหลือเสียงออกแรงตอนพรวนดิน) ตัวแรกใช้ลองเสียงในตั้งค่า */
  voiceTakes: z.array(z.string().regex(/^[a-z0-9_]+$/)).min(1),
  /** กินหรือดื่มจากกระเป๋า: เสียงกรุบเดียว แตะรัวหยุดเสียงก่อนหน้า */
  eatSound: z.string().regex(/^[a-z0-9_]+$/),
  /** เสียงออกแรงตอนจอบกระทบดิน (พรวนและขุดทิ้ง) โอกาสราว 1 ใน 3 และห่างกันอย่างน้อยเท่านี้ */
  tillVoice: z.string().regex(/^[a-z0-9_]+$/),
  tillVoiceChance: z.number().min(0).max(1),
  tillVoiceGapMs: z.number().nonnegative(),
  /** เสียงเป็นลม เล่นครั้งเดียวตอนม่านเป็นลมขึ้น */
  faint: z.string().regex(/^[a-z0-9_]+$/),
  /** เสียงบรรยากาศตามระยะ: ดังเต็มเมื่อใกล้กว่า nearTiles เงียบเมื่อไกลกว่า farTiles (ช่องละ 32 พิกเซล) */
  nearAmbience: z.strictObject({
    fadeMs: z.number().nonnegative(),
    pond: z.strictObject({ key: z.string().regex(/^[a-z0-9_]+$/), nearTiles: z.number().nonnegative(), farTiles: z.number().positive() }),
    campfire: z.strictObject({ key: z.string().regex(/^[a-z0-9_]+$/), nearTiles: z.number().nonnegative(), farTiles: z.number().positive() }),
  }),
  /** กระดิ่งสองโน้ตของแฝด: ฉากเฉลย และกระดิ่งลมแฝดที่ลานเมื่อเดินเข้าใกล้ (ดังเบา ไม่ถี่กว่า everyMs) */
  twinChime: z.strictObject({ key: z.string().regex(/^[a-z0-9_]+$/), nearTiles: z.number().positive(), volume, everyMs: z.number().nonnegative() }),
  warningEveryGameHours: z.number().positive(),
  bath: z.strictObject({ scoopFrame: z.number().int(), splashFrame: z.number().int(), splashes: z.array(z.string().regex(/^[a-z0-9_]+$/)).min(1) }),
  /** เสียงเท้า keys บนหญ้า dirtKeys บนดิน (ลานดินและแปลงผัก) นับรอบแยกกัน */
  steps: z.strictObject({
    frames: z.array(z.number().int().nonnegative()).min(1),
    keys: z.array(z.string().regex(/^[a-z0-9_]+$/)).min(1),
    dirtKeys: z.array(z.string().regex(/^[a-z0-9_]+$/)).min(1),
  }),
  farmGrownGapMs: z.number().nonnegative(),
  chestItems: z.array(z.string().regex(/^[a-z0-9_]+$/)).min(1),
  ambience: z.strictObject({
    day: z.string().regex(/^[a-z0-9_]+$/),
    night: z.string().regex(/^[a-z0-9_]+$/),
    rain: z.string().regex(/^[a-z0-9_]+$/),
    rainFadeMs: z.number().nonnegative(),
    rainLoopAfterStartMs: z.number().nonnegative(),
    underRain: volume,
  }),
  uiTapDedupeMs: z.number().nonnegative(),
});
export const soundGroupSchema = z.enum(['bgm', 'sfx', 'voice', 'amb']);
export const audioIndexSchema = z.record(z.string().regex(/^[a-z0-9_]+$/), soundGroupSchema);

/** ช่วงจำนวนเต็ม [น้อยสุด, มากสุด] */
const rangeSchema = z
  .array(z.number().int().positive())
  .length(2)
  .refine(([low = 0, high = 0]) => low <= high, 'range must be [low, high]');

export const shopSchema = z.strictObject({
  treats: z
    .array(z.strictObject({ item: z.string().regex(/^treat_[a-z_]+$/), price: z.number().int().positive(), taste: z.enum(['like', 'love', 'special']) }))
    .min(1),
  randomSeeds: z.number().int().nonnegative(),
  randomRecipes: z.number().int().nonnegative(),
  recipePriceMultiplier: z.number().positive(),
  /** ปุ๋ย: daily ขายทุกวัน · random ขายเฉพาะบางวันตาม chance (ราคาชั่วคราว ปรับใน M10) */
  fertilizers: z
    .array(z.strictObject({ item: z.string().regex(/^fertilizer_[a-z0-9_]+$/), price: z.number().int().positive(), tab: z.enum(['daily', 'random']), chance: z.number().min(0).max(1) }))
    .min(1),
  /**
   * วัตถุดิบ (งานอาหารโซน 1 ขั้นที่ 7): daily ขายทุกวัน perDay คือจำนวนต่อวัน (ไม่มีคือไม่จำกัด)
   * นม เนย น้ำผึ้ง ราคาปกติตลอด ไม่แพงก่อนมีสัตว์เลี้ยง (ผู้ใช้ตัดสิน 10 พ.ย. 2026) · random ขายบางวันตาม chance มีของ stock [น้อยสุด, มากสุด] ชิ้น
   */
  ingredients: z.strictObject({
    daily: z
      .array(z.strictObject({ item: z.string().regex(/^(ing|bait)_[a-z_]+$/), price: z.number().int().positive(), perDay: z.number().int().positive().optional() }))
      .min(1),
    random: z.array(z.strictObject({ item: z.string().regex(/^(ing|bait)_[a-z_]+$/), price: z.number().int().positive(), chance: z.number().min(0).max(1), stock: rangeSchema })),
  }),
  /** สูตรของหวานรางวัลชื่อเสียงร้าน (สเปก 8.1): ถึงดาวนี้แล้วขายถาวรในหมวดสูตร */
  reputationRecipes: z.record(z.string().regex(/^[1-9]$/), z.array(z.string().regex(/^[a-z_]+$/)).min(1)),
  /** ท็อปปิ้ง: สุ่มวันละ kinds ชนิด ชนิดละ stock ชิ้น ทุกแถวเป็นของ "วันนี้" */
  toppings: z.strictObject({
    kinds: rangeSchema,
    stock: rangeSchema,
    items: z.array(z.strictObject({ item: z.string().regex(/^ing_[a-z_]+$/), price: z.number().int().positive() })).min(1),
  }),
  /** ภาพบนชั้นร้านของสินค้าที่รหัสไม่ตรงกับชื่อภาพ (อุปกรณ์ครัว ถาด) ของที่ไม่มีในนี้ใช้ shop_item_<รหัส> หรือกล่องสี */
  shelfArt: z.record(z.string().regex(/^[a-z0-9_]+$/), z.string().regex(/^shop_item_[a-z0-9_]+$/)),
});
export type ShopData = z.infer<typeof shopSchema>;

const tasteListSchema = z.array(z.string().regex(/^[a-z_]+$/));

/** มอนสเตอร์ประจำชั้น เพิ่มตัวใหม่ได้โดยแก้แค่ monsters.json th.json และ dialogue.json · art null คือยังไม่มีภาพ ยังไม่มาเยี่ยม */
export const monstersSchema = z.record(
  z.string().regex(/^[a-z_]+$/),
  z.strictObject({
    floor: z.number().int().positive(),
    zone: z.number().int().positive(),
    /** คะแนนที่ต้องการให้ชอบครบ 100% */
    points: z.number().positive(),
    personality: z.enum(['shy', 'cheerful', 'proud', 'lazy', 'elder']),
    favourite: tasteListSchema,
    /** เครื่องดื่มโปรด ×3 เท่าเมนูโปรด หยิบคู่กับเมนูโปรดในครั้งเดียวได้โบนัสเซ็ต "เข้ากันสุดๆ!" */
    favouriteDrink: z.string().regex(/^[a-z_]+$/),
    /** ท็อปปิ้งที่ชอบ (รหัสใน toppings.json) ใส่แล้วความชอบคูณเพิ่ม และไม่ทำหน้าจะอ้วกแม้ใส่ผิดประเภท · ข้อมูลมาในขั้นที่ 8 */
    favouriteTopping: z.string().regex(/^[a-z_]+$/).optional(),
    likes: tasteListSchema,
    dislikes: tasteListSchema,
    /** เมนูประจำใจ ขอเมื่อความชอบถึง 90% ต้องได้จึงไปถึง 100% */
    signature: z.strictObject({ recipe: z.string().regex(/^[a-z_]+$/), stars: z.number().int().min(1).max(3) }),
    /** มอนสเตอร์ครู (สเปก 8.1): สอนสูตรเมื่อความชอบถึง at (0–1) ครั้งเดียว บทสอนอยู่ใน dialogue.json หัวข้อ teach */
    teaches: z.array(z.strictObject({ at: z.number().gt(0).lt(1), recipe: z.string().regex(/^[a-z_]+$/) })).optional(),
    /** แฝดตัวที่ซ่อน (น้อง) ชี้ไปหาพี่ ใช้ชั้น บทพูด และชื่อก่อนเฉลยร่วมกับพี่ */
    twinOf: z.string().regex(/^[a-z_]+$/).optional(),
    art: z
      .strictObject({
        /** รหัสภาพในทะเบียน มีต่อท้าย _hungry_ / _sweet_ กับ stand walk eat */
        sheet: z.string().regex(/^[a-z0-9_]+$/),
        frame: z.number().int().positive(),
        /** แถวล่างสุดที่ทึบของท่ายืนทิศใต้ (นับในช่อง) ใช้วางท่ายืนกับท่าเดินให้เท้าอยู่บนเส้นเดียวกับตัวเอก ไม่ใส่ใช้ค่าที่วัดจากภาพ */
        feetRow: z.number().int().nonnegative().optional(),
        /** มิลลิวินาทีต่อเฟรมท่าเดิน หรือรายการต่อเฟรม (ท่ากระโดดของผู้เฝ้าทุ่ง) */
        walkMs: z.union([z.number().positive(), z.array(z.number().positive()).min(1)]),
        eatMs: z.number().positive(),
        /** ลำดับเฟรมท่ากิน (ทิศใต้) */
        eatFrames: z.array(z.number().int().nonnegative()).min(1),
        /** สีตาตอนหิวในภาพ ช่วงกลางค่อย ๆ เปลี่ยนเป็นสีตาตอนหวานที่ตำแหน่งเดียวกัน · null คือภาพหิววาดมาครบแล้ว ใช้ภาพหิวจนครบ 100% */
        hungryEye: z.string().regex(/^#[0-9a-f]{6}$/).nullable(),
        /** ความสูงตัวที่มองเห็น ใช้วางฟองคำพูดและหอคอยอาหารเหนือหัว */
        height: z.number().int().positive(),
      })
      .nullable(),
  }),
);
export type MonsterData = z.infer<typeof monstersSchema>;

const tierLines = z.array(z.string().min(1)).min(1).optional();
const linesByTierSchema = z.strictObject({ hungry: tierLines, warm: tierLines, close: tierLines, any: tierLines });

/** ฟองคำพูด (ร่างจาก docs/dialogue_zone1_draft.json) ตัวละคร → จังหวะ → ระดับความชอบ แก้บทได้โดยไม่แตะโค้ด */
export const dialogueSchema = z.strictObject({
  _note: z.string().optional(),
  monsters: z.record(
    z.string().regex(/^[a-z_]+$/),
    z.strictObject({
      name: z.string().min(1),
      voice: z.string().min(1),
      appear: linesByTierSchema,
      browse: linesByTierSchema,
      dislike: linesByTierSchema,
      like: linesByTierSchema,
      favourite: linesByTierSchema,
      eat: linesByTierSchema,
      done: linesByTierSchema,
      emptyTray: linesByTierSchema,
    }),
  ),
  pets: z.record(z.string().regex(/^[a-z_]+$/), z.record(z.string().min(1), z.array(z.string().min(1)))),
  gio: z.record(z.string().min(1), z.array(z.string().min(1))),
  /** บทของมอนสเตอร์ครูตอนสอนสูตร มอนสเตอร์ → สูตร → ประโยค (ร่างฝั่งโค้ด รอผู้ใช้ตรวจ) */
  teach: z.record(z.string().regex(/^[a-z_]+$/), z.record(z.string().regex(/^[a-z_]+$/), z.string().min(1))),
  /** แฝดขี้แกล้งชั้น 5 (ร่าง ผู้ใช้ยังแก้คำได้) A = พี่ B = น้อง */
  twins: z.strictObject({
    _note: z.string().optional(),
    dislike_A_pre: z.array(z.string().min(1)).min(1),
    dislike_B_pre: z.array(z.string().min(1)).min(1),
    B_done_bar_frozen: z.array(z.string().min(1)).min(1),
    bar_switch: z.array(z.string().min(1)).min(1),
    A_tease_visit: z.array(z.string().min(1)).min(1),
    reveal_quiz: z.strictObject({ A: z.string().min(1), B: z.string().min(1), prompt: z.string().min(1), correct: z.string().min(1), wrong: z.string().min(1), retry_visit: z.string().min(1) }),
    reveal_line: z.array(z.string().min(1)).min(1),
    gio_news: z.strictObject({ pre_reveal_clue: z.string().min(1), reveal_next_day: z.string().min(1), after: z.string().min(1) }),
    /** บทพูดทั่วไปของน้อง ใช้ทุกครั้งที่น้องมาเยี่ยม (ก่อนและหลังเฉลย) ก่อนเฉลยบทไม่ชอบใช้ dislike_B_pre (pre_reveal เป็นแค่โน้ต) */
    B_general: z.strictObject({
      _note: z.string().optional(),
      voice: z.string().min(1),
      appear: linesByTierSchema,
      browse: linesByTierSchema,
      dislike: linesByTierSchema.extend({ pre_reveal: z.string().optional() }),
      like: linesByTierSchema,
      favourite: linesByTierSchema,
      eat: linesByTierSchema,
      done: linesByTierSchema,
      emptyTray: linesByTierSchema,
    }),
  }),
});
export type Dialogue = z.infer<typeof dialogueSchema>;

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
          /** ระดับปุ๋ยที่ใส่ไว้ 0 คือไม่ใส่ หมดตอนเก็บเกี่ยว */
          fertilizer: z.number().int().min(0).max(3),
        }),
      ),
    }),
    bag: z.array(z.strictObject({ item: z.string().min(1), count: z.number().int().positive() })),
    cooking: z.strictObject({
      slot: z
        .strictObject({ recipe: z.string().min(1), stars: z.number().int().positive(), minutesLeft: z.number().nonnegative(), count: z.number().int().positive() })
        .nullable(),
    }),
    /** สูตรที่รู้ ดาวสูงสุด และเศษม้วนสูตรจากหีบที่เก็บได้ต่อสูตร (ครบแล้วได้สูตร) */
    recipes: z.strictObject({ known: z.array(z.string().min(1)), bestStars: z.record(z.string(), z.number().int().positive()), fragments: z.record(z.string().min(1), z.number().int().positive()) }),
    cosmetics: z.strictObject({
      equipped: z.strictObject({
        charm: z.string().min(1).nullable(),
        wallpaper: z.string().min(1),
        canSkin: z.string().min(1),
      }),
      owned: z.strictObject({
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
    /** หีบที่เปิดติดกันโดยไม่ได้ของแต่ง · หีบที่ได้เศษติดกันโดยไม่ได้เศษสูตรหายาก (ข้าวต้มปลา) */
    chests: z.strictObject({ sinceCosmetic: z.number().int().nonnegative(), sinceRareFragment: z.number().int().nonnegative() }),
    /** ของเล่นจีโอ ระบบใช้ของเล่นมาใน M6 */
    toys: z.array(z.string().min(1)),
    /** ของจากหีบที่ยังไม่มีระบบ เก็บจำนวนไว้ก่อน */
    stash: z.record(z.string(), z.number().int().positive()),
    /** ความสุขจีโอ แมวเลียวันนี้ ลูบหัว และของที่ฝากขาย */
    gio: z.strictObject({
      happiness: z.number(),
      treatDay: z.number().int().nonnegative(),
      treatsToday: z.number().int().nonnegative(),
      pettedDay: z.number().int().nonnegative(),
      specialWeek: z.number().int(),
      /** วันที่อ่านข่าววันนี้แล้ว จุดชมพูบนปุ่มข่าวหายไป */
      newsDay: z.number().int().nonnegative(),
      /** แมวเลียรสที่จีโอเคยกินแล้ว เปิดรูปในอัลบั้ม */
      album: z.array(z.string().min(1)),
      /** ข่าวมอนสเตอร์ที่จีโอเล่าแล้ว (เมนูโปรด เครื่องดื่มโปรด เมนูประจำใจ) */
      tips: z.array(z.strictObject({ monster: z.string().min(1), kind: z.enum(['favourite', 'drink', 'signature', 'twin_clue', 'twin_reveal', 'set_hint', 'scroll_hint']), day: z.number().int().positive(), read: z.boolean() })),
      /** สรุปยอดวันล่าสุดที่ให้ข่าวไปแล้ว และวันล่าสุดที่ได้ข่าวจริง (ช่วงความสุขต่ำได้ข่าวทุก 2 วัน) */
      tipsReportDay: z.number().int().nonnegative(),
      lastTipDay: z.number().int().nonnegative(),
      consignment: z.strictObject({ items: z.array(z.strictObject({ item: z.string().min(1), count: z.number().int().positive() })), returnDay: z.number().int().positive(), tier: z.number().int().nonnegative() }).nullable(),
      report: z
        .strictObject({ day: z.number().int().positive(), sold: z.array(z.strictObject({ item: z.string().min(1), count: z.number().int().positive() })), returned: z.array(z.strictObject({ item: z.string().min(1), count: z.number().int().positive() })), gross: z.number(), commission: z.number(), coins: z.number(), tier: z.number().int().nonnegative(), gift: z.strictObject({ item: z.string().min(1), count: z.number().int().positive() }).nullable() })
        .nullable(),
    }),
    /** ที่ดินที่ซื้อแล้ว ซื้อตามลำดับจึงเก็บแค่จำนวน */
    land: z.strictObject({ owned: z.number().int().min(0).max(3) }),
    /**
     * งานประดิษฐ์: วันที่เขย่าต้นกล้วยล่าสุด (0 คือยังไม่เคย) ของที่ตัวเอกเคยพูดถึงแล้ว และจำนวนถาดตากกับลอบที่มี
     * drying คือของบนถาดตากแต่ละใบ (null ว่าง) · traps คือวันที่วางลอบแต่ละใบในน้ำ (null อยู่บนฝั่ง) · mortar เจอครกหินเก่าแล้ว
     */
    crafting: z.strictObject({
      bananaDay: z.number().int().nonnegative(),
      noticed: z.array(z.string().min(1)),
      stations: z.strictObject({ drying_tray: z.number().int().nonnegative(), trap: z.number().int().nonnegative() }),
      drying: z.array(z.strictObject({ recipe: z.string().min(1), count: z.number().int().positive(), day: z.number().int().positive(), shows: z.string().min(1) }).nullable()),
      traps: z.array(z.strictObject({ day: z.number().int().positive() }).nullable()),
      mortar: z.boolean(),
    }),
    /** จัดชุด: ชื่อเสียงร้าน (ขึ้นอย่างเดียว) ชุดคอมโบที่เคยจัด และโต๊ะใหญ่ (มีแล้วไหม ชุดในแต่ละช่อง ช่องว่างเป็น null) */
    sets: z.strictObject({
      reputation: z.number().nonnegative(),
      combos: z.array(z.string().min(1)),
      bigTable: z.strictObject({ owned: z.boolean(), sets: z.array(z.string().min(1).nullable()) }),
    }),
    /** ร้านจีโอมาร์ท: ของที่มีจำนวนจำกัดซื้อไปแล้วกี่ชิ้นในวัน day (วันอื่นนับใหม่) */
    shop: z.strictObject({ day: z.number().int().nonnegative(), bought: z.record(z.string().min(1), z.number().int().positive()) }),
    /** เกต: ชั้นที่เปิดหีบรางวัลแล้ว (ได้ครั้งเดียว) และจุดของป่าที่เก็บไปแล้วในวัน day ต่อชั้น (วันอื่นเก็บใหม่ได้) */
    gates: z.strictObject({
      chests: z.array(z.number().int().positive()),
      forage: z.record(z.string().regex(/^[0-9]+$/), z.strictObject({ day: z.number().int().nonnegative(), picked: z.array(z.number().int().nonnegative()) })),
    }),
    /** สัตว์เลี้ยงที่เจอแล้ว (M8b): ระยะรักษา บ้าน ความผูกพัน ผลผลิตที่รอเก็บ */
    pets: z.record(
      z.string().regex(/^[a-z_]+$/),
      z.strictObject({
        stage: z.enum(['treating', 'needs_home', 'living']),
        treatedDays: z.number().int().nonnegative(),
        lastTreatDay: z.number().int().nonnegative(),
        boosted: z.boolean(),
        homeOwned: z.boolean(),
        bond: z.number().int().nonnegative(),
        fedDay: z.number().int().nonnegative(),
        pettedDay: z.number().int().nonnegative(),
        stored: z.number().int().nonnegative(),
      }),
    ),
    /** ตำแหน่งเท้า (พิกเซล) ของของที่ผู้เล่นย้ายแล้ว */
    placed: z.record(z.string().min(1), z.strictObject({ x: z.number(), y: z.number() })),
    /** ถาดอาหาร: ระดับ (0 = 3 จาน) กับจานแต่ละใบ ใบละ 1 เมนู เมนูเดิมซ้อนในจานเดิม */
    tray: z.strictObject({
      level: z.number().int().nonnegative(),
      plates: z.array(z.strictObject({ item: z.string().min(1), count: z.number().int().positive() }).nullable()),
    }),
    /** ความชอบของมอนสเตอร์แต่ละตัว และแขกที่จะมาเยี่ยม */
    monsters: z.strictObject({
      affection: z.record(z.string().min(1), z.strictObject({ points: z.number().nonnegative(), signature: z.boolean() })),
      plannedDay: z.number().int().nonnegative(),
      arrivals: z.array(
        z.strictObject({ monster: z.string().min(1), day: z.number().int().positive(), hour: z.number(), done: z.boolean(), kind: z.enum(['tease', 'reveal', 'quiz']).optional() }),
      ),
      /** แฝดชั้น 5: เฉลยแล้วหรือยัง (วันไหน) และทายถูกแล้วหรือยัง */
      twins: z.strictObject({ revealed: z.boolean(), revealDay: z.number().int().nonnegative(), quizWon: z.boolean() }),
      /** เมนูที่ผู้เล่นเคยเสิร์ฟให้แต่ละตัวแล้ว (หยิบกินหรืองอน) รสนิยมในอัลบั้มเปิดตามนี้ */
      tasted: z.record(z.string().min(1), z.array(z.string().min(1))),
    }),
  }),
});

export type SaveFile = z.infer<typeof saveFileSchema>;

/** พืชหนึ่งชนิด เพิ่มพืชได้โดยแก้แค่ crops.json กับ th.json */
export const cropsSchema = z.record(
  z.string().regex(/^[a-z_]+$/),
  z.strictObject({
    /** start = พืชเริ่มเกม ขายทุกวัน · daily = ขายทุกวันแต่ไม่ใช่พืชเริ่มเกม (มะนาว ผักชี) · shop = ร้านสุ่ม · gate = ในเกต */
    source: z.enum(['start', 'daily', 'shop', 'gate']),
    growDays: z.number().int().positive(),
    regrowDays: z.number().int().positive().nullable(),
    firstYield: z.number().int().positive(),
    /** เก็บซ้ำได้กี่ครั้งหลังเก็บครั้งแรก ครบแล้วต้นเหี่ยว */
    regrowTimes: z.number().int().nonnegative(),
    regrowYield: z.number().int().positive().nullable(),
    sellPrice: z.number().int().positive(),
    /** ราคาเมล็ดในร้าน พืชเริ่มเกมขายทุกวัน (ราคาชั่วคราว ปรับใน M10) null คือไม่ขาย */
    seedPrice: z.number().int().positive().nullable(),
  }),
);

export type Crops = z.infer<typeof cropsSchema>;

const recipeSchema = z.strictObject({
  category: z.enum(['savory', 'sweet', 'drink']),
  rank: z.string().min(1),
  /** produce_ ผัก · ing_ วัตถุดิบหรือกลุ่มวัตถุดิบ (ingredients.json) · fish_ ปลาระบุชนิด เช่น กุ้ง ปู ปลาทู */
  ingredients: z.record(z.string().regex(/^(produce|ing|fish)_[a-zA-Z_]+$/), z.number().int().positive()),
  price: z.number().int().positive(),
  /**
   * วิธีได้สูตร (GDD "การได้สูตร") start รู้ตั้งแต่วันแรก · quest เควสวันที่ 4 · gate สูตรลับเกต · shop ร้านสุ่ม · shop_permanent ร้านขายถาวร
   * chest เศษสูตรจากหีบตกปลา · teacher มอนสเตอร์สอน · mortar รู้เองตอนเจอครก · special_quest ภารกิจพิเศษ · rank_special สูตรพิเศษแรงก์ตัวละคร
   */
  source: z.enum(['start', 'quest', 'gate', 'shop', 'shop_permanent', 'shop_heart', 'reputation', 'chest', 'teacher', 'mortar', 'special_quest', 'rank_special']),
  /** ภาชนะตามวิธีทำ (zone1 food update 2) mortar ทำที่ครกหินเก่าเท่านั้น ไม่ทำที่กองไฟ */
  method: z.enum(['grill', 'iron_pan', 'clay_pot', 'bowl', 'pot', 'pan', 'oven', 'mortar']),
  /** นับเป็นกับข้าวตอนจัดชุด */
  sideDish: z.literal(true).optional(),
  /** ซุปหรือแกง ลูกชิ้นโรยได้เฉพาะเมนูกลุ่มนี้ */
  soup: z.literal(true).optional(),
  /** ส่วนประกอบชุด (ข้าวสวย) ไม่นับเป็นสูตร */
  setPart: z.literal(true).optional(),
  /** รหัสภาพในทะเบียน ไม่มีคือใช้กล่องสีแทน */
  icon: z.string().min(1).optional(),
  /** ภาพเล็กสำหรับช่องกระเป๋า ไม่เกิน 32px */
  bagIcon: z.string().min(1).optional(),
});

/** วิธีทำสูตรละ 3 ขั้น */
export const recipeStepsSchema = z.record(z.string().regex(/^[a-z_]+$/), z.array(z.string().min(1).max(40)).length(3));

export const recipesSchema = z.record(z.string().regex(/^[a-z_]+$/), recipeSchema);
const fishKindSchema = z.enum(['fish', 'shrimp', 'crab', 'squid']);

/**
 * วัตถุดิบ value คือมูลค่า · กลุ่มที่สูตรใช้แทนของหลายชนิด: fish ปลาตามชนิดและแรงก์ (ไม่ระบุแรงก์คือแรงก์ไหนก็ได้) · anyOf ของชนิดใดก็ได้ในรายการ
 */
export const ingredientsSchema = z.record(
  z.string().regex(/^[a-zA-Z_]+$/),
  z.strictObject({
    value: z.number().positive(),
    fish: z.strictObject({ kind: fishKindSchema, rank: z.string().min(1).optional() }).optional(),
    anyOf: z.array(z.string().regex(/^(ing|produce|fish)_[a-z_]+$/)).min(2).optional(),
  }),
);

const itemMapSchema = z.record(z.string().regex(/^(ing|produce|fish)_[a-z_]+$/), z.number().int().positive());
const tilePointSchema = z.strictObject({ x: z.number(), y: z.number() });

const traySizeSchema = z.enum(['small', 'medium', 'large']);
const pointPairSchema = z.tuple([z.number(), z.number()]);

/**
 * จัดชุด (งานอาหารโซน 1 ขั้นที่ 6 · สเปกข้อ 6): ถาดสาน 3 ขนาด (slots คือกลางจานเป็นสัดส่วนของภาพถาด ui คือกลางช่องในหน้าต่าง พิกเซลภาพตัวอย่าง)
 * bonus คือตัวคูณราคาขายของชุด · comboAffection ตัวคูณความชอบของชุดคอมโบ · reputation ชื่อเสียงร้านจากชุดคอมโบ (stars คือคะแนนขั้นต่ำของดาว 1–5)
 * combos: ชุดลับ 15 ชุด ช่องเป็นรหัสสูตร หรือ @กลุ่ม จาก groups (flag ธงในสูตร · recipes รายชื่อสูตร · categories หมวด)
 */
export const setsSchema = z.strictObject({
  trays: z.record(
    traySizeSchema,
    z.strictObject({ item: z.string().regex(/^[a-z_]+$/), pieces: z.number().int().positive(), slots: z.array(pointPairSchema).min(1), ui: z.array(pointPairSchema).min(1), bigTable: z.boolean() }),
  ),
  rice: z.string().regex(/^[a-z_]+$/),
  bonus: z.strictObject({ free: z.number().positive(), freeRice: z.number().positive(), combo: z.record(traySizeSchema, z.number().positive()) }),
  comboAffection: z.number().positive(),
  reputation: z.strictObject({ combo: z.record(traySizeSchema, z.number().int().nonnegative()), firstCombo: z.number().int().nonnegative(), stars: z.array(z.number().int().nonnegative()).length(5) }),
  /** โต๊ะใหญ่: ราคา จุดกลางของแต่ละช่องวางชุด (x นับจากซ้ายของภาพโต๊ะ) และขอบล่างของถาด (y นับจากขอบบนของภาพโต๊ะ) */
  bigTable: z.strictObject({ item: z.string().regex(/^[a-z_]+$/), price: z.number().int().positive(), slots: z.array(z.number().int().nonnegative()).min(1), trayBottom: z.number().int().positive() }),
  groups: z.record(
    z.string().regex(/^[a-z_]+$/),
    z.union([
      z.strictObject({ flag: z.enum(['sideDish', 'soup']) }),
      z.strictObject({ recipes: z.array(z.string().regex(/^[a-z_]+$/)).min(1) }),
      z.strictObject({ categories: z.array(z.enum(['savory', 'sweet', 'drink'])).min(1) }),
    ]),
  ),
  combos: z.record(z.string().regex(/^[a-z_]+$/), z.strictObject({ tray: traySizeSchema, slots: z.array(z.string().regex(/^@?[a-z_]+$/)).min(2) })),
});
export type Sets = z.infer<typeof setsSchema>;
export type TraySize = z.infer<typeof traySizeSchema>;

/**
 * สถานีแปรรูป (งานอาหารโซน 1 ขั้นที่ 5 · สเปกข้อ 5): ถาดตาก ลอบ ครกหินเก่า
 * drying: ถาดละ 1 ชนิด ไม่เกิน maxPieces ชิ้น เก็บได้วันถัดไป readyHour · prefer คือช่องที่อยากวางถาดใบที่ 1–3 ในลานหน้าบ้าน (ย้ายได้)
 * trap: วางในน้ำได้ตั้งแต่ fromHour เก็บได้วันถัดไป readyHour ได้ 1 ตัวต่อลอบต่อคืน · spots คือที่วางบนฝั่งกับในน้ำของลอบใบที่ 1–3 (ช่องแผนที่ ใบแรกคือลอบเก่าที่ท่าน้ำ)
 * mortar: มินิเกมตำ ตำ pounds ครั้ง วงหดจาก firstRingMs ถึง lastRingMs · เป๊ะ/ดี ภายใน perfectMs/goodMs · คะแนนรวมถึง stars[].from ได้ดาวนั้น
 */
export const stationsSchema = z.strictObject({
  drying: z.strictObject({
    maxPieces: z.number().int().positive(),
    readyHour: z.number(),
    recipes: z.record(z.string().regex(/^[a-z_]+$/), z.strictObject({ in: itemMapSchema, out: z.string().regex(/^ing_[a-z_]+$/) })),
    prefer: z.array(tilePointSchema).min(1),
  }),
  trap: z.strictObject({
    fromHour: z.number(),
    readyHour: z.number(),
    catch: z.array(z.strictObject({ item: z.string().regex(/^fish_[a-z_]+$/), chance: z.number().positive() })).min(1),
    spots: z.array(z.strictObject({ land: tilePointSchema, water: tilePointSchema })).min(1),
  }),
  mortar: z.strictObject({
    pounds: z.number().int().positive(),
    firstRingMs: z.number().positive(),
    lastRingMs: z.number().positive(),
    perfectMs: z.number().positive(),
    goodMs: z.number().positive(),
    judgeMs: z.number().nonnegative(),
    points: z.strictObject({ perfect: z.number().int().nonnegative(), good: z.number().int().nonnegative() }),
    stars: z.array(z.strictObject({ from: z.number().int().nonnegative(), stars: z.number().int().min(1).max(3) })).min(1),
    itemMinutes: z.number().positive(),
    teaches: z.array(z.string().regex(/^[a-z_]+$/)),
    items: z.record(z.string().regex(/^[a-z_]+$/), z.strictObject({ in: itemMapSchema, out: z.string().regex(/^ing_[a-z_]+$/), gives: z.number().int().positive() })),
  }),
});
export type Stations = z.infer<typeof stationsSchema>;

/**
 * ของที่ทำที่โต๊ะช่างเก่า: วัสดุที่ใช้ ได้กี่ชิ้น · once ทำครั้งเดียวใช้ตลอด (แก้วไม้ไผ่) · station ถาดตากกับลอบ นับเป็นจำนวนที่มี ไม่อยู่ในกระเป๋า
 * max คือมีได้มากสุด · afterFirst ทำได้หลังได้ชิ้นแรกแล้ว (ถาดตากใบแรกตัวเอกคิดทำเองหลังเกต 2)
 */
export const workbenchSchema = z.record(
  z.string().regex(/^[a-z_]+$/),
  z.strictObject({
    materials: z.record(z.string().regex(/^[a-z_]+$/), z.number().int().positive()),
    gives: z.number().int().positive(),
    once: z.literal(true).optional(),
    station: z.literal(true).optional(),
    max: z.number().int().positive().optional(),
    afterFirst: z.literal(true).optional(),
  }),
);
export type Workbench = z.infer<typeof workbenchSchema>;

/** ท็อปปิ้งหนึ่งอย่าง item คือของในกระเป๋าที่ใช้ชิ้นละ 1 ต่อจาน · art คือภาพบนจาน 48 พิกเซล · kind บอกท่าตอนร่วง (ผงฟุ้งเป็นละออง ลูกชิ้นกระเซ็นในซุป) */
export const toppingsSchema = z.record(
  z.string().regex(/^[a-z_]+$/),
  z.strictObject({
    item: z.string().regex(/^(ing|produce)_[a-z_]+$/),
    type: z.enum(['savory', 'sweet', 'drink']),
    art: z.string().regex(/^[a-z0-9_]+$/),
    kind: z.enum(['piece', 'powder', 'ball']),
    /** โบนัสต่อชิ้นแทน pieceBonus (ผงนัว +20%) */
    bonus: z.number().positive().optional(),
    /** ใส่ได้กี่ชิ้นต่อจาน (ผงนัวจานละช้อน) */
    perDish: z.number().int().positive().optional(),
    /** ลูกชิ้นใส่ได้เฉพาะซุปและแกง */
    soupOnly: z.literal(true).optional(),
    /** ประกายกะพริบวนค้างบนจาน (ผงนัว) */
    twinkle: z.literal(true).optional(),
  }),
);
export type Toppings = z.infer<typeof toppingsSchema>;

export type Recipe = z.infer<typeof recipeSchema>;
export type Ingredients = z.infer<typeof ingredientsSchema>;
export type Recipes = z.infer<typeof recipesSchema>;

const rankSchema = z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']);

/** ปลาหนึ่งชนิด เพิ่มปลาได้โดยแก้แค่ fish.json กับ th.json · hours นับต่อเนื่องจากเที่ยงคืน 26 คือตีสอง null คือทั้งวัน */
export const fishSchema = z.record(
  z.string().regex(/^[a-z_]+$/),
  z.strictObject({
    /** ปลา กุ้ง ปู หมึก สูตรที่เขียนว่าปลานับเฉพาะ fish */
    kind: fishKindSchema,
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
    /** เหยื่อเรียกหีบ: โอกาสได้หีบต่อครั้งแทนโอกาสของคันเบ็ด (ฝนหรือกลางคืนบวก chestBonus เหมือนเดิม) */
    chestChance: z.number().min(0).max(1).optional(),
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
  /**
   * เศษม้วนสูตร (สเปก 8.1): ทุกหีบได้เศษ 1 ชิ้นจนครบทุกสูตร สูตรละ perRecipe ชิ้น สุ่มตามน้ำหนักใน recipes
   * สูตร rare.recipe ออกยาก แต่ได้เศษอย่างอื่นติดกัน rare.after ใบแล้ว ใบถัดไปได้เศษสูตรนั้นแน่
   */
  fragments: z.strictObject({
    perRecipe: z.number().int().positive(),
    recipes: z.record(z.string().regex(/^[a-z_]+$/), z.number().positive()),
    rare: z.strictObject({ recipe: z.string().regex(/^[a-z_]+$/), after: z.number().int().positive() }),
  }),
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
  z.strictObject({ slot: z.enum(['canSkins', 'charms', 'clips', 'wallpapers']), art: z.string().min(1) }),
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
    baitRanOut: z.string().min(1),
    noMoney: z.string().min(1),
    /** สถานีแปรรูป: ลอบก่อน 17:00 · ลอบยังไม่ถึงเช้า · ถาดตากยังไม่แห้ง · คิดทำถาดตากใบแรกเอง · เจอครกหินเก่า (ความรู้ของตัวเอง) */
    trapTooEarly: z.string().min(1),
    trapWaiting: z.string().min(1),
    dryingWaiting: z.string().min(1),
    dryingTrayIdea: z.string().min(1),
    mortarFound: z.string().min(1),
    /** อยู่ในเกตครบเวลาแล้ว กลับลานบ้านเอง */
    gateTimeUp: z.string().min(1),
    /** บทสั้น ๆ ครั้งแรกที่ได้วัสดุหรือวัตถุดิบใหม่ (ความรู้รอบตัวของตัวเอง ไม่ใช่ยายสอน) */
    firstItem: z.record(z.string().regex(/^[a-z_]+$/), z.string().min(1)),
  }),
  gio: z.strictObject({
    greet: z.string().min(1),
    treat: z.strictObject({ like: z.string().min(1), love: z.string().min(1), special: z.string().min(1) }),
    treatFull: z.string().min(1),
    noTreat: z.string().min(1),
    pet: z.string().min(1),
    petDone: z.string().min(1),
    news: z.string().min(1),
    consigned: z.string().min(1),
    busy: z.string().min(1),
    back: z.string().min(1),
    backBig: z.string().min(1),
  }),
  encouragement: z.array(z.string().min(1)).min(1),
});

/**
 * สมุดดูแลสัตว์ (ข้อมูลนิ่งจาก GDD ระบบสัตว์เลี้ยงมาใน M8) สัตว์ 15 ตัวเรียงตามเกตที่ต้องปลด
 * art = มีภาพการ์ดและฉากแล้ว · homePrice ราคาบ้านในร้าน (เหรียญ ×10 แล้ว) null = ไม่ต้องมีบ้าน · ความผูกพันระดับ 2–5 ต้องการแต้มตาม bondLevels
 */
/**
 * การดูแลสัตว์เลี้ยง M8b (ตาราง GDD "สัตว์เลี้ยง 5 ตัวใน MVP"): ของที่ใช้รักษาวันละครั้ง (`dish:<สูตร>` คืออาหารสูตรนั้นดาวไหนก็ได้
 * ผักดาวไหนก็ได้) · bath รักษาด้วยการอาบน้ำที่บ่อด้วยกัน · บ้านที่ต้องซื้อ (null คืออยู่ริมบ่อหรือในบ่อ)
 * ผลผลิตทุกเช้า (produce) · หนึบหนับรดน้ำแปลงตามระดับ (waters) · บับเบิ้ลอาบน้ำสะอาดเพิ่มตามระดับ (cleanBonus)
 */
const petCareSchema = z.strictObject({
  treat: z.record(z.string().regex(/^(produce_[a-z_]+|ing_[a-z_]+|dish:[a-z_]+|[a-z_]+)$/), z.number().int().positive()),
  bath: z.literal(true).optional(),
  home: z.string().min(1).nullable(),
  produce: z.string().regex(/^ing_[a-z_]+$/).optional(),
  waters: z.array(z.number().int().nonnegative()).length(5).optional(),
  cleanBonus: z.array(z.number().nonnegative()).length(5).optional(),
});

export const petsSchema = z.strictObject({
  bondLevels: z.array(z.number().int().positive()).length(4),
  /** แต้มผูกพันต่อวัน: ให้อาหาร + ลูบ (GDD วันละ 10) */
  bondPerCare: z.strictObject({ fed: z.number().int().nonnegative(), petted: z.number().int().nonnegative() }),
  /** ผลผลิตต่อวันตามระดับผูกพัน 1–5 (GDD 1 → 3) */
  produceByLevel: z.array(z.number().int().nonnegative()).length(5),
  /** ผลผลิตที่ยังไม่เก็บสะสมได้ไม่เกินกี่วัน */
  maxStoredDays: z.number().int().positive(),
  /** ของช่วยให้หายเร็วขึ้น 1 วัน (ใช้ได้ครั้งเดียวต่อการรักษา) */
  speedUpItems: z.array(z.string().min(1)),
  pets: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-z_]+$/),
        gate: z.number().int().positive(),
        art: z.boolean(),
        homePrice: z.number().int().positive().nullable(),
        treatDays: z.number().int().positive().nullable(),
        care: petCareSchema.optional(),
      }),
    )
    .length(15),
});

/** แผนที่หอคอย (ข้อมูลนิ่ง ระบบเข้าเกตมาใน M8) ฉากในเกตต่อชั้น และไอคอนอากาศของโซน */
const itemCountSchema = z.strictObject({ item: z.string().min(1), count: z.number().int().positive() });

export const gatesSchema = z.strictObject({
  stayHours: z.number().positive(),
  /** ออกจากเกตแล้วยืนตรงนี้ในลาน (หน้าประตูเกต พิกเซลกลางตัวชน) */
  yardReturn: z.strictObject({ x: z.number(), y: z.number() }),
  zones: z.array(z.strictObject({ zone: z.number().int().positive(), weather: z.string().min(1) })).min(1),
  gates: z
    .array(
      z.strictObject({
        floor: z.number().int().positive(),
        scene: z.string().min(1),
        /**
         * เกตที่เดินเข้าไปได้แล้ว: ชื่อแผนที่ใน src/data/gate_maps/<map>_map.json และภาพ <map>_bg <map>_fg
         * `box` คือฉากกล่องสีชั่วคราวของเกตที่ภาพยังไม่มา (ผู้ใช้เลือก 9 พ.ย. 2026) ได้ภาพจริงแล้วเปลี่ยนเป็น gate<N>
         */
        map: z.string().regex(/^(gate\d+|box)$/).optional(),
        /** มอนสเตอร์เจ้าของชั้นที่ยืนในฉาก ถ้าต่างจากในไฟล์แผนที่ (ฉากกล่องสีใช้แผนที่เดียวกันทุกบาน) */
        owner: z.string().min(1).optional(),
        /** หีบรางวัลครั้งแรก ได้ครั้งเดียว: ของเข้ากระเป๋า หรือสูตรลับของเกต (สูตรที่ `source: gate`) */
        reward: z.union([itemCountSchema, z.strictObject({ recipe: z.string().min(1) })]).optional(),
        /** ของป่าต่อจุด เก็บได้วันละครั้งต่อจุด */
        forage: itemCountSchema.optional(),
        /** สีพื้นนอกภาพ ตอนจอกว้างกว่าแผนที่ (สีขอบป่าในภาพ) */
        outside: z.string().regex(/^#[0-9a-f]{6}$/).optional(),
        /** ญาติมอนสเตอร์เดินช้ากว่ามอนสเตอร์มาเยี่ยมเท่านี้ · พักนานสุ่มในช่วงนี้ (ms) · ตอนพักมีโอกาสแทะหญ้าเท่านี้ */
        kinSpeed: z.number().positive().optional(),
        kinIdleMs: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
        kinNibbleChance: z.number().min(0).max(1).optional(),
        /** เงาเมฆลอยช้า ๆ (คูณสี จาง ๆ) */
        cloudShadows: z.strictObject({ count: z.number().int().positive(), alpha: z.number().min(0).max(1), driftPxPerSecond: z.number().positive() }).optional(),
      }),
    )
    .length(10),
});

const gateTileSchema = z.tuple([z.number(), z.number()]);
const tileRectSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

/** แผนที่ในเกต (ภาพวาดหนึ่งภาพ + ชั้นหน้า + ช่องเดินไม่ได้) ตำแหน่งเป็นช่อง 32 พิกเซล ตำแหน่งตัวละครคือเท้า (กลางล่าง) */
export const gateMapSchema = z.strictObject({
  size: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  tile: z.number().int().positive(),
  image_px_to_tiles: z.string().optional(),
  spawn: gateTileSchema,
  /** x0 y0 x1 y1 */
  exit_zone: tileRectSchema,
  owner: z.strictObject({ monster: z.string().min(1), pos: gateTileSchema }),
  reward_chest: z.strictObject({ pos: gateTileSchema, first_visit: z.string().optional() }),
  forage: z.strictObject({ item: z.string().min(1), respawn: z.literal('daily'), points: z.array(gateTileSchema).min(1) }),
  /** ญาติมอนสเตอร์เดินเล่น (ฉากกล่องสีไม่มี) */
  kin: z
    .strictObject({
      monster: z.string().min(1),
      count: z.number().int().positive(),
      variants: z.array(z.string().regex(/^[a-z]+$/)).min(1),
      wander_area: tileRectSchema,
      home_burrows: z.array(gateTileSchema).min(1),
    })
    .optional(),
  burrows: z.array(gateTileSchema),
  ambient: z.array(z.string()).optional(),
  blocked: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])),
});

export type GateMap = z.infer<typeof gateMapSchema>;

/** ขวดจดหมาย 20 ฉบับ (ข้อมูลนิ่ง ระบบตกขวดมาทีหลัง) โซนที่เริ่มตกได้ และกระดาษตามคนเขียน */
export const mailSchema = z.strictObject({
  homesick: z.number().int().positive(),
  letters: z
    .array(z.strictObject({ number: z.number().int().positive(), zone: z.number().int().min(1).max(10), paper: z.enum(['kid', 'old', 'tower', 'plain']) }))
    .length(20),
});

export type PetsData = z.infer<typeof petsSchema>;
export type GatesData = z.infer<typeof gatesSchema>;
export type MailData = z.infer<typeof mailSchema>;

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
  /** แผ่นหลายแถว แถวละทิศ จุดเท้าวัดแยกตามแถว */
  rows: z.array(z.string().min(1)).optional(),
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

/** แผ่นรวมภาพ สร้างโดย tools/pack-atlases.ts ห้ามแก้มือ · frames: รหัสภาพ → [แผ่น, x, y, กว้าง, สูง] · hashes: ไฟล์ต้นทาง → md5 ใช้ตรวจว่าแผ่นไม่เก่า */
export const atlasSchema = z.strictObject({
  pages: z.array(z.strictObject({ group: z.string().regex(/^[a-z0-9_]+$/), file: z.string().min(1), width: z.number().int().positive(), height: z.number().int().positive() })),
  frames: z.record(z.string().regex(/^[a-z0-9_]+$/), z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative(), z.number().int().nonnegative(), z.number().int().positive(), z.number().int().positive()])),
  hashes: z.record(z.string().min(1), z.string().min(1)),
});
export type AtlasManifest = z.infer<typeof atlasSchema>;

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
