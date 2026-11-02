import { eventBus, type RestCause } from '../core/events';
import { gameState, type Point, type World } from '../core/state';
import balance from '../data/balance.json';
import { finishOvernight, tickCooking } from './cooking';
import { growFarm } from './farm';
import { decayAwake, recoverFromFaint, shouldFaint, sleepUntilMorning } from './gauges';

const { time, gauges } = balance;
const MS_PER_HOUR = time.realSecondsPerGameHour * 1000;
const HOURS_PER_DAY = 24;

function nextMorning(world: World, restful: boolean): World {
  const morning = time.dayStartHour + HOURS_PER_DAY;
  return {
    ...world,
    day: world.day + 1,
    hour: time.dayStartHour,
    gauges: sleepUntilMorning(world.gauges, Math.max(0, morning - world.hour), restful),
    farm: growFarm(world.farm),
    cooking: finishOvernight(world.cooking),
  };
}

export type StepResult = { world: World; cause: RestCause | null };

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
  if (next.hour >= time.lateLimitHour) return { world: nextMorning(next, false), cause: 'passed_out' };
  return { world: next, cause: null };
}

export function faint(world: World): World {
  const skipped = world.hour + gauges.faint.skipHours;
  if (skipped >= time.lateLimitHour) {
    return { ...nextMorning(world, false), gauges: recoverFromFaint(sleepUntilMorning(world.gauges, 0, false)) };
  }
  return { ...world, hour: skipped, gauges: recoverFromFaint(world.gauges) };
}

export function sleep(world: World): World {
  return nextMorning(world, true);
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
