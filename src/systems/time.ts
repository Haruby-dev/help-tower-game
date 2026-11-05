import { eventBus, type RestCause } from '../core/events';
import { gameState, type Point, type World } from '../core/state';
import balance from '../data/balance.json';
import { finishOvernight, tickCooking } from './cooking';
import { growFarm } from './farm';
import { gioMorning, settleGio } from './gio';
import { planVisits, settleVisits } from './monsters';
import { gainTips } from './news';
import { rainOnFarm, weatherFor } from './weather';
import { decayAwake, recoverFromFaint, shouldFaint, sleepUntilMorning } from './gauges';

const { time, gauges } = balance;
const MS_PER_HOUR = time.realSecondsPerGameHour * 1000;
const HOURS_PER_DAY = 24;

/** ฝนตกตอนเช้ารดน้ำให้ทั้งฟาร์ม */
function nextMorning(world: World, restful: boolean): World {
  const morning = time.dayStartHour + HOURS_PER_DAY;
  const day = world.day + 1;
  const weather = weatherFor(world.seed, day);
  const farm = growFarm(world.farm);
  return {
    ...world,
    day,
    weather,
    hour: time.dayStartHour,
    gauges: sleepUntilMorning(world.gauges, Math.max(0, morning - world.hour), restful),
    farm: weather === 'rain' ? rainOnFarm(farm) : farm,
    cooking: finishOvernight(world.cooking),
    gio: gioMorning(world.gio),
  };
}

export type StepResult = { world: World; cause: RestCause | null };

/** จีโอกลับมาพร้อมยอดขายและข่าว → วางแผนแขกพรุ่งนี้ · แขกที่เลยเวลาแล้วยังไม่ได้มาให้เห็น กินจากถาดเอง */
const settle = (world: World): World => settleVisits(planVisits(gainTips(settleGio(world))));

/** คำนวณอย่างเดียว ไม่แตะ GameState จึงทดสอบตัวเลขแยกได้ */
export function stepClock(world: World, deltaMs: number): StepResult {
  const hours = deltaMs / MS_PER_HOUR;
  const next: World = {
    ...world,
    hour: world.hour + hours,
    gauges: decayAwake(world.gauges, hours),
    cooking: tickCooking(world.cooking, hours),
  };

  if (shouldFaint(next.gauges)) return { world: faint(next), cause: 'faint' };
  if (next.hour >= time.lateLimitHour) return { world: settle(nextMorning(next, false)), cause: 'passed_out' };
  return { world: settle(next), cause: null };
}

export function faint(world: World): World {
  const skipped = world.hour + gauges.faint.skipHours;
  if (skipped >= time.lateLimitHour) {
    return { ...nextMorning(world, false), gauges: recoverFromFaint(sleepUntilMorning(world.gauges, 0, false)) };
  }
  return { ...world, hour: skipped, gauges: recoverFromFaint(world.gauges) };
}

export function sleep(world: World): World {
  return settle(nextMorning(world, true));
}

/** ฉากเรียกทุกเฟรม ส่ง home มาเพราะเป็นตำแหน่งบนแผนที่ที่ระบบไม่รู้เอง */
export function advanceClock(deltaMs: number, home: Point): void {
  if (!gameState.clockRunning) return;
  const { world, cause } = stepClock(gameState.world, deltaMs);
  gameState.setWorld(world);
  if (cause === 'faint') finishRest('faint', home);
  else if (cause === 'passed_out') finishRest('passed_out', null);
}

export function goToSleep(home: Point): void {
  gameState.setWorld(sleep(gameState.world));
  finishRest('sleep', home);
}

function finishRest(cause: RestCause, wakeAt: Point | null): void {
  if (wakeAt) gameState.movePlayer(wakeAt);
  eventBus.emit('rest-finished', { cause, day: gameState.world.day });
}
