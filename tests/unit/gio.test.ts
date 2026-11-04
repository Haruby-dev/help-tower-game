import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { registrySchema } from '../../src/data/schema';
import spriteMeta from '../../src/data/sprite-meta.json';
import { projectRoot } from '../../tools/checks';

const registry = registrySchema.parse(JSON.parse(readFileSync(join(projectRoot, 'assets-src/registry.json'), 'utf8')));

describe('Gio v2', () => {
  it('sits in 4 directions with a blink sheet of the same layout', () => {
    for (const id of ['gio_sit', 'gio_sit_blink']) {
      const entry = registry[id];
      expect(entry).toMatchObject({ type: 'local', frame_width: 56, frame_height: 56, frames: 8, rows: ['south', 'east', 'north', 'west'] });
    }
    // ทิศใต้เท้าอยู่สูงกว่าทิศอื่น จุดเท้าจึงวัดแยกแถว
    expect((spriteMeta as Record<string, { footY: Record<string, number> }>).gio_sit!.footY).toMatchObject({ south: 45, east: 49 });
  });

  it('walks on 4 legs with 8 frames to the south, north and east, and no longer uses the hop sheets', () => {
    for (const id of ['gio_walk_south', 'gio_walk_north', 'gio_walk_east']) {
      const entry = registry[id];
      if (entry?.type !== 'local' || !entry.frame_width) throw new Error(`${id} missing`);
      expect(entry.width / entry.frame_width).toBe(8);
    }
    expect(registry.gio_idle).toBeUndefined();
    expect(registry.gio_stand).toBeUndefined();
  });
});
