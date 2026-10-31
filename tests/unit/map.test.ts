import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { registrySchema } from '../../src/data/schema';
import { projectRoot } from '../../tools/checks';
import {
  blockedRects,
  buildCorners,
  canReach,
  tileCorners,
  type MapLayout,
  type Rect,
} from '../../tools/map-layout';

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
  tilesets: { name: string }[];
};
const registry = registrySchema.parse(
  JSON.parse(readFileSync(join(projectRoot, 'assets-src/registry.json'), 'utf8')),
);

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
const reachable = (tileX: number, tileY: number): boolean =>
  canReach(
    spawn('player'),
    { x: tileX * tiled.tilewidth, y: tileY * tiled.tilewidth },
    obstacles,
    world,
    playerBody,
    8,
  );

describe('base map', () => {
  it('is the left 30 columns of the blueprint, using only the new ground sets', () => {
    expect([tiled.width, tiled.height]).toEqual([30, 17]);
    expect(tiled.tilesets.map(({ name }) => name)).toEqual([
      'ground_grass_dirt',
      'ground_grass_dark',
      'ground_water',
      'cliff_tall',
    ]);
  });

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
    ['in front of the house door', 19, 9.6],
    ['in front of the burrow', 25, 8.3],
    ['the terrace, by the stairs', 15, 3.1],
    ['behind the gate on the terrace', 15, 1.4],
    ['the shore of the pond', 22, 10.5],
    ['the far side of the pond', 22, 15.4],
    ['the farm plots', 7, 11],
    ['the dock', 19.4, 11.8],
    ['the campfire', 12.3, 9.6],
  ])('lets the player walk to %s', (_name, tileX, tileY) => {
    expect(reachable(tileX, tileY)).toBe(true);
  });

  it.each([
    ['the middle of the pond', 22, 13],
    ['the dense forest', 1, 8],
    ['the forest where the restaurant will open', 29, 8],
    ['the middle of the cliff wall', 10, 4],
    ['the pet house under the fog', 6.5, 14.8],
  ])('keeps the player out of %s', (_name, tileX, tileY) => {
    expect(reachable(tileX, tileY)).toBe(false);
  });

  it('places every object from the registry and none from the retired set', () => {
    const retired = ['tree_pink', 'tree_blossom', 'cave', 'burrow', 'stone_gate', 'bush', 'rock', 'flowers'];
    for (const { id } of layout.objects) {
      expect(registry[id], id).toBeDefined();
      expect(retired).not.toContain(id);
    }
  });
});

describe('placement rules', () => {
  const corners = buildCorners(layout);
  const flowers = layer('flowers').objects ?? [];
  const tileOf = (flower: Rect): ReturnType<typeof tileCorners> =>
    tileCorners(corners, Math.floor(flower.x / tiled.tilewidth), Math.floor(flower.y / tiled.tilewidth));

  it('scatters flowers only on plain and dark grass', () => {
    expect(flowers.length).toBeGreaterThan(0);
    for (const flower of flowers) {
      for (const terrain of Object.values(tileOf(flower))) expect(['grass', 'dark']).toContain(terrain);
    }
  });

  it('keeps flowers off the farm', () => {
    const farm = layout.flowers.keepOut[0]!;
    const inside = flowers.filter(
      (flower) =>
        flower.x >= farm.x * 32 &&
        flower.x < (farm.x + farm.width) * 32 &&
        flower.y >= farm.y * 32 &&
        flower.y < (farm.y + farm.height) * 32,
    );
    expect(inside).toEqual([]);
  });

  it('keeps about 50-60 small and 6-10 big flowers per screen of grass', () => {
    let grassTiles = 0;
    for (let y = 0; y < tiled.height; y += 1) {
      for (let x = 0; x < tiled.width; x += 1) {
        const terrains = Object.values(tileCorners(corners, x, y));
        if (terrains.every((terrain) => terrain === 'grass' || terrain === 'dark')) grassTiles += 1;
      }
    }
    const screens = grassTiles / layout.flowers.screenTiles;
    const big = flowers.filter((flower) => flower.name.startsWith('petal_big')).length;
    expect((flowers.length - big) / screens).toBeGreaterThanOrEqual(50);
    expect((flowers.length - big) / screens).toBeLessThanOrEqual(60);
    expect(big / screens).toBeGreaterThanOrEqual(6);
    expect(big / screens).toBeLessThanOrEqual(10);
  });

  it('has one big half-submerged rock in the pond', () => {
    const submerged = layout.objects.filter((object) => object.submerged);
    expect(submerged.map(({ id }) => id)).toEqual(['rock_big_10']);
  });

  it('never lines three pond rocks up in a row', () => {
    const rocks = layout.objects.filter((object) => object.id.startsWith('rock_small'));
    for (const a of rocks) {
      expect(rocks.filter((b) => b.y === a.y)).toHaveLength(1);
      expect(rocks.filter((b) => b.x === a.x)).toHaveLength(1);
    }
  });
});

describe('blockedRects', () => {
  it('blocks only the tile quarter next to each water corner', () => {
    const rects = blockedRects(
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

  it('blocks the whole wall tile but leaves the opening walkable', () => {
    const corners: ('wall' | 'grass')[][] = [
      ['wall', 'wall', 'wall'],
      ['grass', 'grass', 'grass'],
    ];
    expect(blockedRects(corners, 32, [{ x: 32, y: 0, width: 32, height: 32 }])).toEqual([
      { x: 0, y: 0, width: 32, height: 16 },
      { x: 0, y: 16, width: 32, height: 16 },
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
