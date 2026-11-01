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

  it('lists every file from the 1 Nov art update with the same tone and currency', () => {
    const registry = registrySchema.parse(
      JSON.parse(readFileSync(join(projectRoot, 'assets-src/registry.json'), 'utf8')),
    );
    const additions = JSON.parse(
      readFileSync(join(projectRoot, 'assets-src/art_2026-11-01/registry_additions.json'), 'utf8'),
    ) as { name: string; file: string; jade_tone: boolean; currency?: string }[];
    expect(additions).toHaveLength(250);
    for (const addition of additions) {
      const entry = registry[addition.name];
      if (entry?.type !== 'local' && entry?.type !== 'local_tileset') throw new Error(`${addition.name} is missing`);
      expect(entry.source).toBe(addition.file);
      expect(entry.jade_tone).toBe(addition.jade_tone);
      if (entry.type === 'local') expect(entry.currency).toBe(addition.currency);
    }
  });

  it('marks the stairs and the rustic decor as not used', () => {
    const registry = registrySchema.parse(
      JSON.parse(readFileSync(join(projectRoot, 'assets-src/registry.json'), 'utf8')),
    );
    const stairs = registry.stairs_cliff;
    expect(stairs?.type).toBe('not_used');
    const rustic = registry.decor_rustic_rejected;
    expect(rustic?.type === 'not_used' && rustic.pixellab_job).toBe('0c1d6656');
  });

  it('uses the hand-fixed house file and none of the retired art', () => {
    const raw = readFileSync(join(projectRoot, 'assets-src/registry.json'), 'utf8');
    const registry = registrySchema.parse(JSON.parse(raw));
    const house = registry.house_main;
    expect(house?.type === 'local' && house.source).toBe('assets-src/house_main_final.png');
    for (const retired of [
      '2d3798d1',
      'a7babc4e',
      '88a095aa',
      'ec7a4c94',
      '557b0313',
      '732049bb',
      'f6fca004',
      'fe8f8a6c',
      '6806c5eb',
      '80720cc2',
      'bd4f5347',
      'e3a6188f',
    ]) {
      expect(raw).not.toContain(retired);
    }
  });
});
