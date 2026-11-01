import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../../src/core/assets', () => ({ animationKey: () => '', characterEntry: () => ({}), directionsOf: () => [], footY: () => 0 }));

const { hopPose } = await import('../../src/entities/Gio');

describe('Gio code hop', () => {
  it('stretches on take-off, arcs up, and squashes on landing', () => {
    expect(hopPose(0.05).frame).toBe(1);
    expect(hopPose(0.5).frame).toBe(0);
    expect(hopPose(0.5).lift).toBe(7);
    expect(hopPose(0.95).frame).toBe(2);
    expect(hopPose(0).lift).toBe(0);
  });
});
