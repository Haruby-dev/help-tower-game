import { get, set } from 'idb-keyval';
import { defaultCosmetics, emptyWallet, type BagStack, type GioCare, type Wallet, type World } from '../core/state';
import { addToBag } from './farm';
import { newGioCare } from './gio';
import balance from '../data/balance.json';
import { saveFileSchema, type SaveFile } from '../data/schema';
import { cookingStarterBag, firstWeather, fishingStarterBag, newFarm, newFishing, newRecipeBook, newSeed, starterBag } from './gauges';

export const SAVE_VERSION = 10;
/** ผู้ใช้ตัดสิน 4 พ.ย. 2026: ตัวเลขเหรียญทั้งเกมใหญ่ขึ้น 10 เท่า สัดส่วนเศรษฐกิจเท่าเดิม */
export const COIN_SCALE = 10;
const OLD_TREAT = 'gio_lick_treat';
const NEW_TREAT = 'treat_special';
export const SLOT_COUNT = 3;

const slotKey = (slot: number): string => `save-slot-${slot}`;

/** เพิ่มตัวแปลงที่นี่ทุกครั้งที่เปลี่ยนรูปแบบเซฟ คีย์คือเวอร์ชันต้นทาง */
const MIGRATIONS: Record<number, (save: Record<string, unknown>) => Record<string, unknown>> = {
  // เวอร์ชัน 2 เพิ่มกระเป๋าเงิน เซฟเก่ายังไม่มีเงินจึงเริ่มจากศูนย์
  1: (save) => ({ ...save, world: { ...(save.world as object), wallet: emptyWallet() } }),
  // เวอร์ชัน 3 เพิ่มของแต่งโทรศัพท์และสีบัวรดน้ำ
  2: (save) => ({ ...save, world: { ...(save.world as object), cosmetics: defaultCosmetics() } }),
  // เวอร์ชัน 4 เพิ่มแปลงผักกับกระเป๋า เซฟเก่าได้ของเริ่มเกมเหมือนเกมใหม่
  3: (save) => ({ ...save, world: { ...(save.world as object), farm: newFarm(), bag: starterBag() } }),
  // เวอร์ชัน 5 เพิ่มการทำอาหาร เซฟเก่าได้วัตถุดิบเริ่มเกมเพิ่มต่อท้าย ของเดิมอยู่ครบ
  4: (save) => {
    const world = save.world as { bag: unknown[] };
    return { ...save, world: { ...world, bag: [...world.bag, ...cookingStarterBag()], cooking: { slot: null }, recipes: newRecipeBook() } };
  },
  // เวอร์ชัน 6 เพิ่มตกปลา อากาศ และหีบ เซฟเก่าได้เหยื่อเริ่มเกมต่อท้ายกระเป๋า
  5: (save) => {
    const world = save.world as { bag: unknown[]; cosmetics: { owned: object } };
    return {
      ...save,
      world: {
        ...world,
        bag: [...world.bag, ...fishingStarterBag()],
        cosmetics: { ...world.cosmetics, owned: { ...world.cosmetics.owned, clips: [] } },
        seed: newSeed(),
        weather: firstWeather,
        fishing: newFishing(),
        chests: { sinceCosmetic: 0 },
        toys: [],
        stash: {},
      },
    };
  },
  // เวอร์ชัน 7 ทำอาหารทีละหลายจาน อาหารที่ค้างที่กองไฟในเซฟเก่าคือ 1 จาน
  6: (save) => {
    const world = save.world as { cooking: { slot: object | null } };
    const { slot } = world.cooking;
    return { ...save, world: { ...world, cooking: { slot: slot ? { ...slot, count: 1 } : null } } };
  },
  // เวอร์ชัน 8 เหรียญทั้งเกม ×10 เซฟเก่าคูณยอดเหรียญ รายการรับจ่ายเหรียญ และยอดรายวันครั้งเดียว อำนาจซื้อจึงเท่าเดิม ดาวน้ำตาลไม่เปลี่ยน
  7: (save) => {
    const world = save.world as { wallet: Wallet };
    const { wallet } = world;
    return {
      ...save,
      world: {
        ...world,
        wallet: {
          ...wallet,
          coins: wallet.coins * COIN_SCALE,
          log: wallet.log.map((entry) => (entry.currency === 'coins' ? { ...entry, amount: entry.amount * COIN_SCALE } : entry)),
          daily: wallet.daily.map((total) => ({ ...total, coins: total.coins * COIN_SCALE })),
        },
      },
    };
  },
  // เวอร์ชัน 9 เพิ่มความสุขจีโอกับฝากขาย · แมวเลียจากหีบที่เก็บเป็นธงไว้ย้ายเข้ากระเป๋าเป็นรสพิเศษ ถ้ากระเป๋าเต็มเก็บธงไว้เหมือนเดิม
  8: (save) => {
    const world = save.world as { bag: BagStack[]; stash: Record<string, number> };
    const { [OLD_TREAT]: treats = 0, ...rest } = world.stash;
    const moved = treats > 0 ? addToBag(world.bag, NEW_TREAT, treats) : world.bag;
    const keep = moved === null;
    return {
      ...save,
      world: { ...world, bag: moved ?? world.bag, stash: keep ? world.stash : rest, gio: newGioCare() },
    };
  },
  // เวอร์ชัน 10 จำวันที่อ่านข่าวจีโอแล้ว และสรุปยอดมีของฝากได้
  9: (save) => {
    const world = save.world as { gio: GioCare };
    const report = world.gio.report;
    return { ...save, world: { ...world, gio: { ...world.gio, newsDay: 0, report: report ? { ...report, gift: null, tier: tierOfCommission(report) } : null } } };
  },
};

/** เซฟเก่าไม่ได้เก็บช่วงความสุขของสรุปยอด เดาจากสัดส่วนค่าคอม */
function tierOfCommission(report: { gross: number; commission: number }): number {
  const share = report.gross > 0 ? report.commission / report.gross : 0;
  let best = 0;
  balance.gioCare.tiers.forEach((tier, index) => {
    if (Math.abs(tier.commission - share) < Math.abs(balance.gioCare.tiers[best]!.commission - share)) best = index;
  });
  return best;
}

export function toSaveFile(world: World): SaveFile {
  return { version: SAVE_VERSION, savedAt: new Date().toISOString(), world };
}

/** ตอบ null เมื่อข้อมูลเสียหรือมาจากเกมเวอร์ชันใหม่กว่า เกมจะได้ไม่ล้ม */
export function parseSaveFile(raw: unknown): SaveFile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  let save = raw as Record<string, unknown>;
  let version = save.version;
  if (typeof version !== 'number' || version > SAVE_VERSION) return null;
  while (version < SAVE_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) return null;
    save = migrate(save);
    version += 1;
  }
  const result = saveFileSchema.safeParse({ ...save, version });
  return result.success ? result.data : null;
}

export async function readSlot(slot: number): Promise<SaveFile | null> {
  try {
    return parseSaveFile(await get(slotKey(slot)));
  } catch {
    return null;
  }
}

export async function writeSlot(slot: number, world: World): Promise<boolean> {
  try {
    await set(slotKey(slot), toSaveFile(world));
    return true;
  } catch {
    return false;
  }
}

export async function writeSaveFile(slot: number, save: SaveFile): Promise<boolean> {
  try {
    await set(slotKey(slot), save);
    return true;
  } catch {
    return false;
  }
}

export function downloadSave(slot: number, save: SaveFile): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `help-tower-save-${slot}-day-${save.world.day}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function readSaveUpload(file: File): Promise<SaveFile | null> {
  try {
    return parseSaveFile(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}
