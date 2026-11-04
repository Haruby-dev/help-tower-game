import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { registrySchema } from '../../src/data/schema';
import { checkProject, projectRoot } from '../../tools/checks';

describe('project data', () => {
  it('passes every data and text check', () => {
    expect(checkProject()).toEqual([]);
  });

  it('no longer uses the Gio hop frames whose face changes shape', () => {
    const registry = registrySchema.parse(
      JSON.parse(readFileSync(join(projectRoot, 'assets-src/registry.json'), 'utf8')),
    );
    expect(registry.gio_hop).toBeUndefined();
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

  it('lists every file from the 2 Nov UI and farm packages, without jade tone', () => {
    const registry = registrySchema.parse(
      JSON.parse(readFileSync(join(projectRoot, 'assets-src/registry.json'), 'utf8')),
    );
    for (const pack of ['ui', 'farm']) {
      const additions = JSON.parse(
        readFileSync(join(projectRoot, `assets-src/art_2026-11-02/${pack}/registry_additions.json`), 'utf8'),
      ) as Record<string, { source: string }>;
      for (const [name, addition] of Object.entries(additions)) {
        const entry = registry[name];
        if (entry?.type !== 'local') throw new Error(`${name} is missing`);
        // ภาพพืชย้ายไปชุด 48×64 ใน crops48 แล้ว
        if (!name.startsWith('crop_')) expect(entry.source).toBe(addition.source);
        expect(entry.jade_tone).toBe(false);
      }
    }
    const crop = registry.crop_scallion;
    expect(crop?.type === 'local' && [crop.width, crop.height, crop.frames]).toEqual([192, 64, 4]);
    const old = registry.ui_phone_open_frame;
    expect(old?.type === 'local' && old.not_built).toBeTruthy();
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
