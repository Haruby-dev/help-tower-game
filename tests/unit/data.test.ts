import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { registrySchema } from '../../src/data/schema';
import { checkProject, projectRoot } from '../../tools/checks';

describe('project data', () => {
  it('passes every data and text check', () => {
    expect(checkProject()).toEqual([]);
  });

  it('uses the fixed north hop for Gio, because the first set shows eyes on the back of the head', () => {
    const registry = registrySchema.parse(
      JSON.parse(readFileSync(join(projectRoot, 'assets-src/registry.json'), 'utf8')),
    );
    const hop = registry.gio_hop;
    if (hop?.type !== 'character') throw new Error('gio_hop must be a character');
    expect(hop.directionGroups?.north).toBe('4db519c5-4b83-41c8-ad8e-b070091969b7');
    for (const direction of ['south', 'east', 'west']) {
      expect(hop.directionGroups?.[direction]).toBe('1712125f-3044-4b2c-b9a8-4555ea225776');
    }
  });
});
