import type { Viewport } from './viewport';

export interface GameEvents {
  'viewport-changed': Viewport;
  'rotation-required-changed': boolean;
  'lighting-changed': boolean;
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
