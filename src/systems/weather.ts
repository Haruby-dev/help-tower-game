import { createRng, type Rng } from '../core/rng';
import type { Farm, Weather } from '../core/state';
import balance from '../data/balance.json';

const { weather: rules } = balance;
const KINDS: Weather[] = ['sunny', 'rain', 'cloudy'];
const SEED_MIX = 31;

/** แดด 60% ฝน 30% ครึ้ม 10% ตามค่าใน balance.json */
export function rollWeather(rng: Rng): Weather {
  const total = KINDS.reduce((sum, kind) => sum + rules.chances[kind], 0);
  let roll = rng.next() * total;
  for (const kind of KINDS) {
    roll -= rules.chances[kind];
    if (roll < 0) return kind;
  }
  return KINDS[0]!;
}

/** อากาศของแต่ละวันมาจากเลข seed ของเซฟกับเลขวัน โหลดเซฟเดิมจึงได้อากาศเดิม */
export const weatherFor = (seed: number, day: number): Weather => rollWeather(createRng(Math.imul(seed, SEED_MIX) + day));

/** ฝนตกรดน้ำให้ทุกแปลงที่พรวนแล้ว */
export const rainOnFarm = (farm: Farm): Farm => ({ plots: farm.plots.map((plot) => (plot.tilled ? { ...plot, watered: true } : plot)) });
