import type { World } from '../core/state';
import balance from '../data/balance.json';
import { clampGauges } from './gauges';

const { bath: rules } = balance;

/** อาบน้ำครบ 30 นาทีได้สะอาดเต็ม 60 เดินออกก่อนได้ตามเวลาที่อาบไป เวลาเดินตามนาฬิกาเกมระหว่างอาบอยู่แล้ว */
export function finishBath(world: World, minutesSpent: number): World {
  const share = Math.min(1, Math.max(0, minutesSpent / rules.minutes));
  return { ...world, gauges: clampGauges({ ...world.gauges, cleanliness: world.gauges.cleanliness + rules.cleanlinessGain * share }) };
}
