import { get, set } from 'idb-keyval';
import { emptyWallet, type World } from '../core/state';
import { saveFileSchema, type SaveFile } from '../data/schema';

export const SAVE_VERSION = 2;
export const SLOT_COUNT = 3;

const slotKey = (slot: number): string => `save-slot-${slot}`;

/** เพิ่มตัวแปลงที่นี่ทุกครั้งที่เปลี่ยนรูปแบบเซฟ คีย์คือเวอร์ชันต้นทาง */
const MIGRATIONS: Record<number, (save: Record<string, unknown>) => Record<string, unknown>> = {
  // เวอร์ชัน 2 เพิ่มกระเป๋าเงิน เซฟเก่ายังไม่มีเงินจึงเริ่มจากศูนย์
  1: (save) => ({ ...save, world: { ...(save.world as object), wallet: emptyWallet() } }),
};

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
