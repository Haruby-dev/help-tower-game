export type Direction8 =
  | 'south'
  | 'south-east'
  | 'east'
  | 'north-east'
  | 'north'
  | 'north-west'
  | 'west'
  | 'south-west';

export type Direction4 = 'south' | 'east' | 'north' | 'west';

export interface Vector {
  x: number;
  y: number;
}

/** เรียงตามมุมจากทิศตะวันออก หมุนตามเข็มนาฬิกา (แกน y ของจอชี้ลง) */
const DIRECTIONS_8: readonly Direction8[] = [
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
  'north',
  'north-east',
];

const DIRECTIONS_4: readonly Direction4[] = ['east', 'south', 'west', 'north'];

const DEAD_ZONE = 0.15;

function sectorIndex(vector: Vector, sectors: number): number {
  const turn = Math.atan2(vector.y, vector.x) / (2 * Math.PI);
  return ((Math.round(turn * sectors) % sectors) + sectors) % sectors;
}

/** คืน null เมื่อแรงน้อยจนนับว่าไม่ได้สั่งเดิน */
export function direction8From(vector: Vector): Direction8 | null {
  if (Math.hypot(vector.x, vector.y) < DEAD_ZONE) return null;
  return DIRECTIONS_8[sectorIndex(vector, 8)] ?? null;
}

export function direction4From(vector: Vector): Direction4 {
  return DIRECTIONS_4[sectorIndex(vector, 4)] ?? 'south';
}

/** เดินทแยงต้องเร็วเท่าเดินตรง จอยสติ๊กที่ดันไม่สุดเดินช้าลงตามแรงดัน */
export function velocityFrom(vector: Vector, speed: number): Vector {
  const length = Math.hypot(vector.x, vector.y);
  if (length < DEAD_ZONE) return { x: 0, y: 0 };
  const strength = Math.min(1, length) / length;
  return { x: vector.x * strength * speed, y: vector.y * strength * speed };
}

/** แปลงตำแหน่งนิ้วบนจอยสติ๊กเป็นแรงดัน ขนาดไม่เกิน 1 */
export function joystickVector(offsetX: number, offsetY: number, radius: number): Vector {
  const length = Math.hypot(offsetX, offsetY);
  if (length === 0) return { x: 0, y: 0 };
  const scale = Math.min(length, radius) / length / radius;
  return { x: offsetX * scale, y: offsetY * scale };
}
