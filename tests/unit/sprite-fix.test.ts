import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { projectRoot } from '../../tools/checks';
import { bottomRow, buildHopSheet, resizeAtCut, steadyWalkRow, topRow } from '../../tools/sprite-fix';

const sheetAt = (file: string): PNG => PNG.sync.read(readFileSync(join(projectRoot, 'public/assets/characters', file)));

function cell(sheet: PNG, column: number, row: number, width: number, height: number): PNG {
  const out = new PNG({ width, height });
  PNG.bitblt(sheet, out, column * width, row * height, width, height, 0, 0);
  return out;
}

/** กล่องทดสอบ: ตัวตั้งแต่ top ถึง bottom */
function box(top: number, bottom: number): PNG {
  const image = new PNG({ width: 8, height: 40 });
  for (let y = top; y <= bottom; y += 1) {
    for (let x = 2; x < 6; x += 1) {
      const at = (y * 8 + x) * 4;
      image.data[at] = y;
      image.data[at + 3] = 255;
    }
  }
  return image;
}

describe('resizeAtCut', () => {
  it('keeps the feet still and moves the top part as one piece', () => {
    const image = box(10, 30);
    const taller = resizeAtCut(image, 20, 2);
    expect(bottomRow(taller)).toBe(30);
    expect(topRow(taller)).toBe(8);
    expect(taller.data[(8 * 8 + 2) * 4]).toBe(10);
    const shorter = resizeAtCut(image, 20, -2);
    expect(bottomRow(shorter)).toBe(30);
    expect(topRow(shorter)).toBe(12);
  });
});

describe('steadyWalkRow', () => {
  it('lines every head up while the feet stay', () => {
    const sheet = new PNG({ width: 24, height: 40 });
    [box(12, 30), box(15, 30), box(14, 29)].forEach((frame, index) => {
      PNG.bitblt(frame, sheet, 0, 0, 8, 40, index * 8, 0);
    });
    steadyWalkRow(sheet, 0, 8, 40, 3, { waistY: 22 });
    for (let index = 0; index < 3; index += 1) {
      const frame = cell(sheet, index, 0, 8, 40);
      expect(topRow(frame)).toBe(14);
      expect(bottomRow(frame)).toBe(30);
    }
  });
});

describe('real sprite sheets', () => {
  it.each([
    ['south', 0],
    ['north', 4],
  ])('the player walking %s keeps the head within 1px and the feet level', (_name, row) => {
    const sheet = sheetAt('player_girl_walk.png');
    const tops = [];
    const bottoms = [];
    for (let frame = 0; frame < 8; frame += 1) {
      const image = cell(sheet, frame, row, 88, 88);
      tops.push(topRow(image));
      bottoms.push(bottomRow(image));
    }
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
    expect(new Set(bottoms).size).toBe(1);
  });

  it('keeps Gio v2 sitting on the same feet line in every frame of a direction', () => {
    const sheet = sheetAt('gio_v2/gio_sit.png');
    for (let row = 0; row < 4; row += 1) {
      const bottoms = Array.from({ length: 8 }, (_, frame) => bottomRow(cell(sheet, frame, row, 56, 56)));
      expect(new Set(bottoms).size).toBeLessThanOrEqual(2);
    }
  });

  it('builds the hop sheet from any still frame', () => {
    const still = new PNG({ width: 8, height: 40 });
    PNG.bitblt(box(10, 30), still, 0, 0, 8, 40, 0, 0);
    const sheet = buildHopSheet(still, 8, 40, 1, { rows: 2, cutShare: 0.6 });
    expect(sheet.width).toBe(24);
  });
});
