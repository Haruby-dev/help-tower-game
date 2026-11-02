import { createRng } from '../core/rng';
import type { TextKey } from '../core/i18n';
import balance from '../data/balance.json';
import lines from '../data/lines.json';

const { calendar, time } = balance;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

/** 0 คือวันจันทร์ เรียงเหมือนแถบสัปดาห์ในโทรศัพท์ */
export function weekdayIndex(day: number): number {
  return (calendar.firstDayWeekdayIndex + day - 1) % DAYS_PER_WEEK;
}

export const weekdayName = (day: number): TextKey => `weekday.long_${weekdayIndex(day)}` as TextKey;
export const weekdayShort = (day: number): TextKey => `weekday.short_${weekdayIndex(day)}` as TextKey;

export const monthOf = (day: number): number => Math.floor((day - 1) / calendar.daysPerMonth) + 1;
export const dayOfMonth = (day: number): number => ((day - 1) % calendar.daysPerMonth) + 1;

/** วันจันทร์ถึงอาทิตย์ของสัปดาห์นี้ นับต่อเนื่องจากวันที่ 1 วันก่อนหน้านั้นคืนเป็นค่าน้อยกว่า 1 */
export function weekStrip(day: number): number[] {
  const monday = day - weekdayIndex(day);
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => monday + index);
}

/** เวลาที่ติดอยู่ในหอคอย นับตั้งแต่เช้าวันที่ 1 */
export function stuckTime(day: number, hour: number): { months: number; days: number; hours: number } {
  const total = Math.max(0, Math.floor((day - 1) * HOURS_PER_DAY + hour - time.dayStartHour));
  const totalDays = Math.floor(total / HOURS_PER_DAY);
  return {
    months: Math.floor(totalDays / calendar.daysPerMonth),
    days: totalDays % calendar.daysPerMonth,
    hours: total % HOURS_PER_DAY,
  };
}

/** สุ่มตาม seed ของวัน เปิดกี่ครั้งในวันเดียวกันก็ได้บทเดิม */
export function encouragementFor(day: number): string {
  const list = lines.encouragement;
  return list[Math.floor(createRng(day).next() * list.length)] as string;
}
