import { describe, expect, it } from 'vitest';
import { NearestPoints, chamferDistance, ellipseOutline, holeRadius, linePoints } from '../../src/scenes/pondMath';

describe('pond maths', () => {
  it('measures depth from the bank', () => {
    const width = 9;
    const inside = new Uint8Array(width * width);
    for (let y = 1; y < 8; y += 1) for (let x = 1; x < 8; x += 1) inside[y * width + x] = 1;
    const dist = chamferDistance(inside, width, width);
    expect(dist[0]).toBe(0);
    expect(dist[1 * width + 1]).toBe(1);
    expect(dist[4 * width + 4]).toBe(4);
  });

  it('keeps the hole edge close to the approved radius', () => {
    for (let i = 0; i < 12; i += 1) {
      const r = holeRadius((i / 12) * Math.PI * 2, 17);
      expect(r).toBeGreaterThan(17 * 0.78);
      expect(r).toBeLessThan(17 * 1.22);
    }
  });

  it('finds the two nearest points', () => {
    const near = new NearestPoints(new Float32Array([0, 10, 30]), new Float32Array([0, 0, 0]), 8);
    const [index, first, second] = near.query(2, 0);
    expect(index).toBe(0);
    expect(first).toBeCloseTo(2);
    expect(second).toBeCloseTo(8);
  });

  it('draws whole-pixel rings and lines', () => {
    for (const [x, y] of ellipseOutline(5.4, 3.2, 4, 2)) {
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
    }
    expect(linePoints(0, 0, 3, 0)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);
  });
});
