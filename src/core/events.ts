import type { TextKey } from './i18n';
import type { ContextAction, Point, Tool, World } from './state';
import type { Viewport } from './viewport';

export type RestCause = 'sleep' | 'passed_out' | 'faint';

export interface GameEvents {
  'viewport-changed': Viewport;
  'rotation-required-changed': boolean;
  'lighting-changed': boolean;
  'zoom-step-changed': number;
  'world-changed': World;
  'game-started': World;
  'player-moved': Point;
  'rest-finished': { cause: RestCause; day: number };
  /** เสียงบรรยากาศตามระยะจากฉาก (บ่อน้ำ กองไฟ) ชื่อเสียง → ระดับ 0–1 */
  'ambience-near': Record<string, number>;
  'action-changed': ContextAction | null;
  'action-pressed': undefined;
  notice: TextKey;
  'tool-changed': Tool;
  'dig-requested': { plot: number; crop: string };
  'dig-confirmed': number;
  /** ปุ๋ยระดับสูงกว่าจะแทนปุ๋ยเดิมในแปลง ถามก่อน */
  'fertilize-requested': { plot: number; item: string };
  'fertilize-confirmed': number;
  /** key ของบทพูดตัวเอกใน lines.json */
  'player-says': 'bagFull' | 'mysteryFood' | 'fishEscaped' | 'noBait' | 'baitRanOut' | 'noMoney';
  'cook-open': undefined;
  'book-open': undefined;
  /** ไอเท็มหีบในกระเป๋าที่จะเปิด */
  'chest-open': string;
  /** กดคุยกับจีโอ */
  'gio-talk': undefined;
  /** ให้แมวเลียสำเร็จ จีโอเล่นท่าเลียพร้อมหัวใจตามรส */
  'gio-treat': 'like' | 'love' | 'special';
  /** หน้าต่างเต็มเปิดหรือปิด (เฉพาะตอนที่เปลี่ยนจริง) ใช้เล่นเสียงเปิดปิด */
  'window-changed': { name: string; open: boolean };
  /** กดซื้อที่ป้ายขายที่ (เลขที่ดิน 0–2) */
  'land-requested': number;
  /** ซื้อที่ดินสำเร็จ ฉากเคลียร์วัชพืชและเปิดแปลงผักใหม่ */
  'land-bought': number;
  /** ปุ่มจัดวางด้านบน เข้าหรือออกจากโหมดจัดวาง */
  'arrange-toggle': undefined;
  /** ปุ่มในแถบจัดวาง */
  'arrange-command': 'place' | 'cancel' | 'done';
  /** สถานะโหมดจัดวาง ให้แถบล่างแสดงปุ่มให้ตรง */
  'arrange-changed': { active: boolean; selected: string | null; valid: boolean };
  /** ข้อความแจ้งที่ประกอบจากหลายส่วน (เช่น ประตูชั้น N เปิดแล้ว) */
  'notice-text': string;
  /** ฟองคำพูดเหนือหัวตัวละครในฉาก anchor ตอบตำแหน่งบนจอ (null คือตัวหายไปแล้ว) · พูดพร้อมกันไม่เกิน 3 ฟอง ที่เหลือรอคิว */
  speech: { speaker: string; text: string; anchor: () => Point | null; hold?: () => boolean };
  /** ป้ายชื่อกับความชอบเหนือหัวมอนสเตอร์ตอนยืนใกล้ */
  'monster-tag': { id: string; hidden: true } | { id: string; hidden: false; name: string; percent: number; anchor: () => Point | null };
  /** ยืนที่ถาดแล้วกดปุ่มกระทำ เปิดหน้าต่างวางอาหาร */
  'tray-open': undefined;
  /** ปุ่มทดสอบในตั้งค่า เรียกมอนสเตอร์มาตอนนี้ (ตอบผลกลับด้วย notice) */
  'monster-summon': undefined;
  /** ฉากเฉลยแฝดชั้น 5: เปิดคำถาม "ใครชอบกินปลา?" anchors คือกลางตัวแฝดซ้ายและขวาบนจอ */
  'twin-quiz': { prompt: string; anchors: (() => Point | null)[] };
  /** ผู้เล่นแตะแฝดตัวที่ index (0 ซ้าย 1 ขวา) */
  'twin-quiz-answer': { index: number };
  /** ปิดคำถามแฝด (แฝดกลับบ้านก่อนตอบ) */
  'twin-quiz-close': undefined;
}

type Listener<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

const listeners: { [K in keyof GameEvents]?: Set<Listener<K>> } = {};

export const eventBus = {
  on<K extends keyof GameEvents>(event: K, listener: Listener<K>): () => void {
    const set = (listeners[event] ?? new Set()) as Set<Listener<K>>;
    (listeners as Record<K, Set<Listener<K>>>)[event] = set;
    set.add(listener);
    return () => set.delete(listener);
  },
  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    (listeners[event] as Set<Listener<K>> | undefined)?.forEach((listener) => listener(payload));
  },
};
