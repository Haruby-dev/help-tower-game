import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { projectRoot } from '../../tools/checks';
import { buildCorners, canReach, waterRects, type MapLayout, type Rect } from '../../tools/map-layout';

interface TiledLayer {
  name: string;
  data?: number[];
  objects?: (Rect & { name: string })[];
}

const layout = JSON.parse(
  readFileSync(join(projectRoot, 'assets-src/maps/base-layout.json'), 'utf8'),
) as MapLayout;
const tiled = JSON.parse(readFileSync(join(projectRoot, 'public/assets/maps/base.json'), 'utf8')) as {
  width: number;
  height: number;
  tilewidth: number;
  layers: TiledLayer[];
};

const layer = (name: string): TiledLayer => {
  const found = tiled.layers.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`missing layer ${name}`);
  return found;
};

const obstacles = layer('collision').objects ?? [];
const world = { width: tiled.width * tiled.tilewidth, height: tiled.height * tiled.tilewidth };
const playerBody = { width: 16, height: 10 };
const spawn = (name: string): Rect & { name: string } => {
  const point = layer('spawns').objects?.find((candidate) => candidate.name === name);
  if (!point) throw new Error(`missing spawn ${name}`);
  return point;
};

describe('base map', () => {
  it('fills every ground tile', () => {
    const data = layer('ground').data ?? [];
    expect(data).toHaveLength(tiled.width * tiled.height);
    expect(data.every((gid) => gid > 0)).toBe(true);
  });

  it('starts the player and Gio on free ground', () => {
    for (const name of ['player', 'gio']) {
      const point = spawn(name);
      const inside = obstacles.some(
        (rect) =>
          point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height,
      );
      expect(inside, name).toBe(false);
    }
  });

  it.each([
    ['in front of the cave', 8.5, 9.5],
    ['in front of the burrow', 42.5, 9.5],
    ['in front of the stone gate', 25.5, 7.5],
    ['the shore of the pond', 39, 20.5],
    ['the far side of the pond', 39, 31.5],
    ['the farm clearing', 10, 27],
  ])('lets the player walk to %s', (_name, tileX, tileY) => {
    const goal = { x: tileX * tiled.tilewidth, y: tileY * tiled.tilewidth };
    expect(canReach(spawn('player'), goal, obstacles, world, playerBody, 8)).toBe(true);
  });

  it('keeps the player out of the pond', () => {
    const goal = { x: 39 * tiled.tilewidth, y: 26 * tiled.tilewidth };
    expect(canReach(spawn('player'), goal, obstacles, world, playerBody, 8)).toBe(false);
  });
});

describe('waterRects', () => {
  it('blocks only the tile quarter next to each water corner', () => {
    const rects = waterRects(
      [
        ['grass', 'grass', 'grass'],
        ['grass', 'water', 'grass'],
        ['grass', 'grass', 'grass'],
      ],
      32,
    );
    expect(rects).toEqual([
      { x: 16, y: 16, width: 32, height: 16 },
      { x: 16, y: 32, width: 32, height: 16 },
    ]);
  });
});

describe('buildCorners', () => {
  it('makes one more corner than tiles on each side', () => {
    const corners = buildCorners(layout);
    expect(corners).toHaveLength(layout.heightTiles + 1);
    expect(corners[0]).toHaveLength(layout.widthTiles + 1);
  });
});
