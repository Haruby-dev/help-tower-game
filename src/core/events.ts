import type { TextKey } from './i18n';
import type { Point, Tool, World } from './state';
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
  'action-changed': TextKey | null;
  'action-pressed': undefined;
  notice: TextKey;
  'tool-changed': Tool;
  'dig-requested': { plot: number; crop: string };
  'dig-confirmed': number;
  /** key ของบทพูดตัวเอกใน lines.json */
  'player-says': 'bagFull' | 'mysteryFood';
  'cook-open': undefined;
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
