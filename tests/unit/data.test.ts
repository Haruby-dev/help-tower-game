import { describe, expect, it } from 'vitest';
import { checkProject } from '../../tools/checks';

describe('project data', () => {
  it('passes every data and text check', () => {
    expect(checkProject()).toEqual([]);
  });
});
