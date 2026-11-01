import { describe, expect, it } from 'vitest';
import { newWorld } from '../../src/systems/gauges';
import { SAVE_VERSION, SLOT_COUNT, parseSaveFile, toSaveFile } from '../../src/systems/save';
import { formatClock } from '../../src/ui/hud';

describe('save file', () => {
  it('has 3 slots and survives a trip through JSON', () => {
    expect(SLOT_COUNT).toBe(3);
    const save = toSaveFile({ ...newWorld(), day: 5, player: { x: 10, y: 20 } });
    const parsed = parseSaveFile(JSON.parse(JSON.stringify(save)));
    expect(parsed?.version).toBe(SAVE_VERSION);
    expect(parsed?.world.day).toBe(5);
    expect(parsed?.world.player).toEqual({ x: 10, y: 20 });
  });

  it('refuses broken files and saves from a newer game', () => {
    expect(parseSaveFile(null)).toBeNull();
    expect(parseSaveFile('hello')).toBeNull();
    expect(parseSaveFile({ version: 1, savedAt: 'x', world: { day: 'one' } })).toBeNull();
    expect(parseSaveFile({ ...toSaveFile(newWorld()), version: SAVE_VERSION + 1 })).toBeNull();
    expect(parseSaveFile({ ...toSaveFile(newWorld()), version: 0 })).toBeNull();
  });
});

describe('clock text', () => {
  it('shows game hours past midnight as the next morning', () => {
    expect(formatClock(6)).toBe('06:00');
    expect(formatClock(13.5)).toBe('13:30');
    expect(formatClock(25.75)).toBe('01:45');
  });
});
