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
  'action-changed': ContextAction | null;
  'action-pressed': undefined;
  notice: TextKey;
  'tool-changed': Tool;
  'dig-requested': { plot: number; crop: string };
  'dig-confirmed': number;
  /** key ของบทพูดตัวเอกใน lines.json */
  'player-says': 'bagFull' | 'mysteryFood' | 'fishEscaped' | 'noBait' | 'baitRanOut';
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
