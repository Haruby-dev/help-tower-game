import type { World } from '../core/state';
import balance from '../data/balance.json';
import { clampGauges } from './gauges';

const decor = balance.decor as Record<string, { swayMs: number; dailyHappiness: number; prefer: { x: number; y: number } }>;

/** ของตกแต่งรางวัลที่ได้แล้ว ตอนนี้มีกระดิ่งลมแฝด (ทายแฝดถูกในฉากเฉลยชั้น 5) */
export function ownedDecor(world: World): string[] {
  return world.monsters.twins.quizWon ? ['deco_bell_chime'] : [];
}

/** ความสุขที่ของตกแต่งเพิ่มให้ทุกเช้า (กระดิ่งลมแฝด +5 ผู้ใช้เลือก 7 พ.ย. 2026) */
export const decorHappiness = (world: World): number => ownedDecor(world).reduce((sum, id) => sum + (decor[id]?.dailyHappiness ?? 0), 0);

/** เช้าวันใหม่: เติมความสุขจากของตกแต่ง */
export function decorMorning(world: World): World {
  const gain = decorHappiness(world);
  if (gain <= 0) return world;
  return { ...world, gauges: clampGauges({ ...world.gauges, happiness: world.gauges.happiness + gain }) };
}
