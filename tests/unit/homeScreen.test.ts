import { describe, expect, it } from 'vitest';
import { homeScreenAppSize } from '../../src/core/viewport';

describe('homeScreenAppSize', () => {
  it('uses the whole iPhone screen whichever way screen reports it', () => {
    expect(homeScreenAppSize(430, 932, true)).toEqual({ width: 932, height: 430 });
    expect(homeScreenAppSize(932, 430, true)).toEqual({ width: 932, height: 430 });
    expect(homeScreenAppSize(430, 932, false)).toEqual({ width: 430, height: 932 });
  });
});
