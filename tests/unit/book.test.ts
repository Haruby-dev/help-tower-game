import { describe, expect, it } from 'vitest';
import { roundedCorner } from '../../src/ui/recipeBook';

describe('book corners', () => {
  it('steps in whole pixels and gets wider toward the edge', () => {
    const steps = roundedCorner(6);
    expect(steps).toHaveLength(6);
    for (const [inset] of steps) expect(Number.isInteger(inset)).toBe(true);
    const insets = steps.map(([inset]) => inset);
    expect(insets[0]).toBeGreaterThan(insets[insets.length - 1]!);
    expect(insets[insets.length - 1]).toBe(0);
  });
});
