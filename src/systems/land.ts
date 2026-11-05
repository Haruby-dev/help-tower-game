import type { World } from '../core/state';
import balance from '../data/balance.json';
import { applyTransaction } from './economy';

const { land, farm } = balance;

export interface Cell {
  col: number;
  row: number;
}

export const landCount = land.lands.length;

const plotsOf = (index: number): number => {
  const { cols, rows } = land.lands[index]!.plots;
  return cols * rows;
};

/** แปลงผักเดิม 4×4 อยู่ก่อน แล้วต่อด้วยแปลงของที่ดินที่ซื้อตามลำดับ */
export const basePlotCount = farm.cols * farm.rows;

/** ช่องบนแผนที่ของแปลงผักลำดับนี้ ไม่มีแปลงนี้ตอบ null */
export function plotCell(index: number): Cell | null {
  if (index < basePlotCount) {
    return { col: farm.plotOrigin.col + (index % farm.cols), row: farm.plotOrigin.row + Math.floor(index / farm.cols) };
  }
  let offset = index - basePlotCount;
  for (const { plots } of land.lands) {
    const size = plots.cols * plots.rows;
    if (offset < size) return { col: plots.col + (offset % plots.cols), row: plots.row + Math.floor(offset / plots.cols) };
    offset -= size;
  }
  return null;
}

/** จำนวนแปลงผักทั้งหมดเมื่อซื้อที่ดินแล้ว owned แปลง */
export function plotCountFor(owned: number): number {
  let count = basePlotCount;
  for (let index = 0; index < owned; index += 1) count += plotsOf(index);
  return count;
}

/** ที่ดินซื้อตามลำดับ แปลงที่ซื้อได้ตอนนี้คือแปลงถัดไป ซื้อครบแล้วตอบ null */
export const nextLand = (world: World): number | null => (world.land.owned < landCount ? world.land.owned : null);

export const landPrice = (index: number): number => land.prices[index]!;

export type BuyLandResult = { world: World } | { world: null; reason: 'order' | 'money' };

/** ซื้อที่ดิน: จ่ายเหรียญ (เขียนรายการในกระเป๋าเงิน) แล้วแปลงในรั้วกลายเป็นแปลงผักว่างทั้งหมด */
export function buyLand(world: World, index: number): BuyLandResult {
  if (nextLand(world) !== index) return { world: null, reason: 'order' };
  const price = landPrice(index);
  if (world.wallet.coins < price) return { world: null, reason: 'money' };
  const paid = applyTransaction(world, 'coins', -price, 'wallet.land', 'wallet.category_land');
  const added = Array.from({ length: plotsOf(index) }, () => ({ tilled: false, watered: false, crop: null }));
  return {
    world: { ...paid, land: { owned: index + 1 }, farm: { plots: [...paid.farm.plots, ...added] } },
  };
}

/** จุดอยู่ในพื้นที่ในรั้วของที่ดินแปลงไหน (ช่องแผนที่ ทศนิยมได้) */
export function landAt(tileX: number, tileY: number): number | null {
  const found = land.lands.findIndex(({ area }) => tileX >= area.x && tileX < area.x + area.width && tileY >= area.y && tileY < area.y + area.height);
  return found === -1 ? null : found;
}
