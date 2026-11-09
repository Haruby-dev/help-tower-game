import type { World } from '../core/state';
import gatesJson from '../data/gates.json';
import { gateMapSchema, gatesSchema, type GateMap } from '../data/schema';
import { addToBag } from './farm';

/**
 * เกตที่เดินเข้าไปได้ (ทดลองเกต 3 · 9 พ.ย. 2026): แผนที่เป็นภาพวาดหนึ่งภาพกับชั้นหน้าและช่องเดินไม่ได้
 * หีบรางวัลได้ครั้งเดียวต่อชั้น · ของป่าเก็บได้จุดละครั้งต่อวัน · อยู่ได้ไม่เกิน stayHours ชั่วโมงเกม
 */
export const gates = gatesSchema.parse(gatesJson);

const mapFiles = import.meta.glob<unknown>('../data/gate_maps/*_map.json', { eager: true, import: 'default' });
const maps: Record<string, GateMap> = Object.fromEntries(
  Object.entries(mapFiles).map(([path, data]) => [/([a-z0-9]+)_map\.json$/.exec(path)![1]!, gateMapSchema.parse(data)]),
);

export type GateInfo = (typeof gates.gates)[number];

export function gateInfo(floor: number): GateInfo | null {
  return gates.gates.find((gate) => gate.floor === floor) ?? null;
}

/** แผนที่ของเกตชั้นนี้ ชั้นที่ยังเดินเข้าไม่ได้ตอบ null */
export function gateMapOf(floor: number): GateMap | null {
  const map = gateInfo(floor)?.map;
  return map ? (maps[map] ?? null) : null;
}

export const canEnterGate = (floor: number): boolean => gateMapOf(floor) !== null;

export const chestOpened = (world: World, floor: number): boolean => world.gates.chests.includes(floor);

export type GateReward = NonNullable<GateInfo['reward']>;
export type ChestResult = { world: World; reward: GateReward } | 'full' | null;

/**
 * เปิดหีบรางวัลครั้งแรก ได้ของเข้ากระเป๋าหรือได้สูตรลับ (รู้สูตรนั้นอยู่แล้วก็ยังนับว่าเปิดแล้ว)
 * กระเป๋าไม่พอหีบยังอยู่ (ตอบ 'full') เปิดแล้วหรือไม่มีรางวัลตอบ null
 */
export function openGateChest(world: World, floor: number): ChestResult {
  const reward = gateInfo(floor)?.reward;
  if (!reward || chestOpened(world, floor)) return null;
  const gates = { ...world.gates, chests: [...world.gates.chests, floor] };
  if ('recipe' in reward) {
    const known = world.recipes.known.includes(reward.recipe) ? world.recipes.known : [...world.recipes.known, reward.recipe];
    return { world: { ...world, recipes: { ...world.recipes, known }, gates }, reward };
  }
  const bag = addToBag(world.bag, reward.item, reward.count);
  if (!bag) return 'full';
  return { world: { ...world, bag, gates }, reward };
}

/** ของป่าของชั้นนี้วันนี้ยังเหลือให้เก็บไหม (ชั้นที่ยังไม่มีแผนที่ตอบ false) */
export function forageLeftToday(world: World, floor: number): boolean {
  const map = gateMapOf(floor);
  if (!map || !gateInfo(floor)?.forage) return false;
  return pickedToday(world, floor).length < map.forage.points.length;
}

/** จุดของป่าที่เก็บไปแล้ววันนี้ (วันอื่นงอกใหม่ทุกจุด) */
export function pickedToday(world: World, floor: number): number[] {
  const record = world.gates.forage[String(floor)];
  return record && record.day === world.day ? record.picked : [];
}

export const forageReady = (world: World, floor: number, point: number): boolean => !pickedToday(world, floor).includes(point);

export type ForageResult = { world: World; item: string; count: number } | 'full' | null;

/** เก็บของป่าจุดนี้ เก็บแล้ววันนี้ตอบ null กระเป๋าเต็มตอบ 'full' */
export function pickForage(world: World, floor: number, point: number): ForageResult {
  const forage = gateInfo(floor)?.forage;
  const map = gateMapOf(floor);
  if (!forage || !map || point < 0 || point >= map.forage.points.length || !forageReady(world, floor, point)) return null;
  const bag = addToBag(world.bag, forage.item, forage.count);
  if (!bag) return 'full';
  const picked = [...pickedToday(world, floor), point].sort((a, b) => a - b);
  return { world: { ...world, bag, gates: { ...world.gates, forage: { ...world.gates.forage, [String(floor)]: { day: world.day, picked } } } }, item: forage.item, count: forage.count };
}

/** ชั่วโมงเกมที่อยู่ในเกตแล้ว นับจากวันและชั่วโมงตอนเข้า */
export const hoursInGate = (world: World, entered: { day: number; hour: number }): number => (world.day - entered.day) * 24 + world.hour - entered.hour;

export const gateTimeUp = (world: World, entered: { day: number; hour: number }): boolean => hoursInGate(world, entered) >= gates.stayHours;
