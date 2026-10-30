import { describe, expect, it } from 'vitest';
import { direction4From, direction8From, joystickVector, velocityFrom } from '../../src/core/movement';
import { createRng } from '../../src/core/rng';

describe('direction8From', () => {
  it.each([
    [1, 0, 'east'],
    [1, 1, 'south-east'],
    [0, 1, 'south'],
    [-1, 1, 'south-west'],
    [-1, 0, 'west'],
    [-1, -1, 'north-west'],
    [0, -1, 'north'],
    [1, -1, 'north-east'],
  ])('maps %i,%i to %s', (x, y, direction) => {
    expect(direction8From({ x, y })).toBe(direction);
  });

  it('treats a tiny push as standing still', () => {
    expect(direction8From({ x: 0.05, y: 0.05 })).toBeNull();
  });
});

describe('direction4From', () => {
  it('picks the nearest of the four hop directions', () => {
    expect(direction4From({ x: 0.9, y: 0.2 })).toBe('east');
    expect(direction4From({ x: -0.2, y: -0.9 })).toBe('north');
    expect(direction4From({ x: -0.9, y: 0.1 })).toBe('west');
    expect(direction4From({ x: 0.1, y: 0.9 })).toBe('south');
  });
});

describe('velocityFrom', () => {
  it('walks diagonally at the same speed as straight', () => {
    const straight = velocityFrom({ x: 1, y: 0 }, 96);
    const diagonal = velocityFrom({ x: 1, y: 1 }, 96);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(Math.hypot(straight.x, straight.y));
    expect(straight.x).toBe(96);
  });

  it('walks slower when the joystick is only partly pushed', () => {
    const velocity = velocityFrom({ x: 0.5, y: 0 }, 96);
    expect(velocity.x).toBeCloseTo(48);
  });

  it('stands still inside the dead zone', () => {
    expect(velocityFrom({ x: 0.1, y: 0 }, 96)).toEqual({ x: 0, y: 0 });
  });
});

describe('joystickVector', () => {
  it('never pushes harder than full strength', () => {
    const vector = joystickVector(300, 400, 34);
    expect(Math.hypot(vector.x, vector.y)).toBeCloseTo(1);
  });

  it('scales with distance from the center', () => {
    expect(joystickVector(17, 0, 34).x).toBeCloseTo(0.5);
    expect(joystickVector(0, 0, 34)).toEqual({ x: 0, y: 0 });
  });
});

describe('createRng', () => {
  it('repeats the same sequence for the same seed', () => {
    const first = createRng(42);
    const second = createRng(42);
    expect([first.next(), first.next()]).toEqual([second.next(), second.next()]);
  });

  it('stays inside the requested range', () => {
    const rng = createRng(7);
    for (let i = 0; i < 100; i += 1) {
      const value = rng.between(2000, 5000);
      expect(value).toBeGreaterThanOrEqual(2000);
      expect(value).toBeLessThan(5000);
    }
  });
});
