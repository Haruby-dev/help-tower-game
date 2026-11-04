import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
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

  it('stands and walks on 4 legs with the new 68 px set, and the old walk sheets are retired', () => {
    expect(registry.gio_stand4).toMatchObject({ type: 'local', frame_width: 68, frame_height: 68, frames: 4 });
    for (const facing of ['south', 'east', 'west', 'north']) {
      expect(registry[`gio_walk4_${facing}`]).toMatchObject({ type: 'local', frame_width: 68, frame_height: 68, frames: 8 });
    }
    expect(registry.gio_eat_lick).toMatchObject({ type: 'local', frame_width: 56, frame_height: 56, frames: 12 });
    for (const old of ['gio_walk_south', 'gio_walk_north', 'gio_walk_east', 'gio_idle', 'gio_stand']) expect(registry[old]).toBeUndefined();
  });

  // ผู้ใช้เห็นจีโอตัวโตขึ้นตอนสลับท่า: ทุกเฟรมที่ใช้ในเกมต้องมีเท้าอยู่บรรทัดเดียวกับจุดเท้าของแผ่นนั้น
  it('keeps the feet of every Gio frame used in-game on the same line, so switching poses never jumps', () => {
    const meta = spriteMeta as Record<string, { footY: Record<string, number> }>;
    const sheets: { id: string; rows: string[] }[] = [
      { id: 'gio_sit', rows: ['south', 'east', 'north', 'west'] },
      { id: 'gio_sit_blink', rows: ['south', 'east', 'north', 'west'] },
      { id: 'gio_stand4', rows: ['default'] },
      { id: 'gio_walk4_south', rows: ['default'] },
      { id: 'gio_walk4_east', rows: ['default'] },
      { id: 'gio_walk4_west', rows: ['default'] },
      { id: 'gio_walk4_north', rows: ['default'] },
      { id: 'gio_eat_lick', rows: ['default'] },
    ];
    for (const { id, rows } of sheets) {
      const entry = registry[id];
      if (entry?.type !== 'local' || !entry.frame_width || !entry.frame_height) throw new Error(`${id} missing`);
      const png = PNG.sync.read(readFileSync(join(projectRoot, 'public/assets', entry.file)));
      rows.forEach((row, rowIndex) => {
        const foot = meta[id]!.footY[row]!;
        for (let frame = 0; frame < entry.width / entry.frame_width!; frame += 1) {
          const bottom = lowestOpaqueRow(png, frame * entry.frame_width!, rowIndex * entry.frame_height!, entry.frame_width!, entry.frame_height!);
          expect(Math.abs(bottom - foot), `${id} ${row} frame ${frame}`).toBeLessThanOrEqual(1);
        }
      });
    }
    // ท่ายืนและเดินทุกแผ่นเท้าอยู่ที่ y 60 ของผืน 68 ตามเอกสารภาพ
    for (const id of ['gio_stand4', 'gio_walk4_south', 'gio_walk4_east', 'gio_walk4_west', 'gio_walk4_north']) expect(meta[id]!.footY.default).toBe(60);
  });
});

function lowestOpaqueRow(png: PNG, x0: number, y0: number, width: number, height: number): number {
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < width; x += 1) if (png.data[((y0 + y) * png.width + x0 + x) * 4 + 3]! > 0) return y + 1;
  }
  return height;
}
