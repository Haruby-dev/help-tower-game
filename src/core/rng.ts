export interface Rng {
  /** ค่าสุ่มในช่วง 0 ถึงน้อยกว่า 1 */
  next(): number;
  between(min: number, max: number): number;
}

/** mulberry32: seed เดียวกันได้ลำดับเดิมเสมอ เพื่อให้ทดสอบซ้ำได้ */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    between: (min, max) => min + next() * (max - min),
  };
}
