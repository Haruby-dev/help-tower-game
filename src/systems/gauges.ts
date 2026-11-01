import type { GaugeValues, World } from '../core/state';
import balance from '../data/balance.json';

const { gauges, time } = balance;

const clamp = (value: number): number => Math.min(gauges.max, Math.max(gauges.min, value));

function clampAll(values: GaugeValues): GaugeValues {
  return {
    fullness: clamp(values.fullness),
    happiness: clamp(values.happiness),
    cleanliness: clamp(values.cleanliness),
    homesickness: clamp(values.homesickness),
  };
}

export function newWorld(): World {
  return {
    day: 1,
    hour: time.dayStartHour,
    gauges: { ...gauges.start },
    player: null,
  };
}

/** เกจลดตามเวลาตอนตื่น สุขลดเฉพาะตอนทำงาน ซึ่งจะเริ่มมีใน M3 */
export function decayAwake(values: GaugeValues, hours: number): GaugeValues {
  return clampAll({
    ...values,
    fullness: values.fullness - gauges.fullness.awakePerHour * hours,
    cleanliness: values.cleanliness - gauges.cleanliness.idlePerHour * hours,
  });
}

/** นอนจนถึงเช้า หลับคาที่ไม่ได้โบนัสสุขจากการนอน แล้วตื่นมาเสียสุขตามความคิดถึงบ้าน */
export function sleepUntilMorning(values: GaugeValues, hoursAsleep: number, restful: boolean): GaugeValues {
  const homesickness = clamp(values.homesickness + gauges.homesickness.perDay);
  return clampAll({
    fullness: values.fullness - gauges.fullness.asleepPerHour * hoursAsleep,
    cleanliness: values.cleanliness - gauges.cleanliness.idlePerHour * hoursAsleep,
    happiness:
      values.happiness + (restful ? gauges.happiness.sleepGain : 0) - homesickness / gauges.happiness.homesickDivisor,
    homesickness,
  });
}

export function shouldFaint(values: GaugeValues): boolean {
  return values.fullness <= gauges.min || values.happiness <= gauges.min;
}

/** เกจที่ถึงศูนย์ฟื้นกลับมาเป็นค่าที่ตกลงไว้ ส่วนเกจอื่นคงเดิม */
export function recoverFromFaint(values: GaugeValues): GaugeValues {
  return {
    ...values,
    fullness: values.fullness <= gauges.min ? gauges.faint.recoverTo : values.fullness,
    happiness: values.happiness <= gauges.min ? gauges.faint.recoverTo : values.happiness,
  };
}
