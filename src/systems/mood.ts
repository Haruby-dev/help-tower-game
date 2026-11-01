import type { GaugeValues } from '../core/state';
import balance from '../data/balance.json';

export type Mood = 'happy' | 'normal' | 'tired' | 'faint';
export type BeadFill = 0 | 0.5 | 1;

const { hud, gauges } = balance;

/** หน้าดูจากอิ่มกับสุขเท่านั้น เพราะสองเกจนี้ทำให้เป็นลม */
export function moodOf(values: GaugeValues): Mood {
  const lowest = Math.min(values.fullness, values.happiness);
  if (lowest >= hud.moodHappyFrom) return 'happy';
  if (lowest >= hud.moodNormalFrom) return 'normal';
  if (lowest >= hud.moodTiredFrom) return 'tired';
  return 'faint';
}

/** ลูกปัดแต่ละเม็ดเต็ม ครึ่ง หรือว่าง เหลือนิดเดียวก็ยังเห็นครึ่งเม็ด เกจจะได้ไม่ดูหมดก่อนเวลา */
export function beadFills(value: number): BeadFill[] {
  const perBead = gauges.max / hud.beadsPerGauge;
  return Array.from({ length: hud.beadsPerGauge }, (_, index) => {
    const share = (value - index * perBead) / perBead;
    if (share >= 1) return 1;
    return share > 0 ? 0.5 : 0;
  });
}

export const isPulsing = (value: number): boolean => value > hud.alertAt && value <= hud.pulseAt;
export const isAlert = (value: number): boolean => value <= hud.alertAt;
export const isDirty = (cleanliness: number): boolean => cleanliness < hud.dirtyBelow;
