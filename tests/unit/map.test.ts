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

import balance from '../../src/data/balance.json';

describe('farm plots', () => {
  it('sit on tiles whose four corners are all soil', () => {
    const layout = JSON.parse(readFileSync(join(projectRoot, 'assets-src/maps/base-layout.json'), 'utf8')) as MapLayout;
    const corners = buildCorners(layout);
    const { plotOrigin, cols, rows } = balance.farm;
    for (let y = plotOrigin.row; y <= plotOrigin.row + rows; y += 1) {
      for (let x = plotOrigin.col; x <= plotOrigin.col + cols; x += 1) expect(corners[y]![x]).toBe('soil');
    }
  });
});

describe('base map', () => {
  it('is the whole v3.1 blueprint, using only the new ground sets', () => {
    expect([tiled.width, tiled.height]).toEqual([51, 35]);
    expect(tiled.tilesets.map(({ name }) => name)).toEqual([
      'ground_grass_dirt',
      'ground_grass_dark',
      'ground_water',
      'cliff_tall',
      'ground_farm_soil',
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
    ['in front of the house door', 24, 8.8],
    ['in front of the burrow', 33, 8.4],
    ['the plateau, around the left end of the cliff', 22, 2.4],
    ['behind the gate on the plateau', 25, 1],
    ['in front of the gate', 25, 3.75],
    ['the north shore of the pond', 25, 14.2],
    ['the south shore of the pond', 26, 21.5],
    ['the farm', 7, 12],
    ['the end of the dock', 23.5, 18.8],
    ['the campfire', 17, 11.6],
    ['the middle of the playground', 25, 28],
    ['the far corner of the playground', 36, 30],
  ])('lets the player walk to %s', (_name, tileX, tileY) => {
    expect(reachable(tileX, tileY)).toBe(true);
  });

  it.each([
    ['the middle of the pond', 27, 18],
    ['the dense forest', 1, 8],
    ['the restaurant behind the trees and fog', 42, 10],
    ['the far side of the restaurant', 48, 16],
    ['the land plots not bought yet', 10, 6],
    ['the pets meadow under the fog', 10, 19],
  ])('keeps the player out of %s', (_name, tileX, tileY) => {
    expect(reachable(tileX, tileY)).toBe(false);
  });

  it('has no stones on the way up to the gate', () => {
    const stones = layout.objects.filter(({ id }) => id.startsWith('path_stone'));
    expect(stones.filter((stone) => stone.y < 9)).toEqual([]);
  });

  it('has no way up the cliff except around its left end', () => {
    expect(layout.openings).toEqual([]);
    const rightEnd = { x: 33 * 32, y: 7 * 32 };
    const plateau = { x: 28 * 32, y: 2 * 32 };
    const leftOfCliffCut = [...obstacles, { name: '', x: 15 * 32, y: 0, width: 5 * 32, height: 10 * 32 }];
    expect(canReach(rightEnd, plateau, leftOfCliffCut, world, playerBody, 8)).toBe(false);
  });

  it('puts the dock on the south shore, pointing north into the water', () => {
    const dock = layout.objects.find(({ id }) => id === 'fishing_dock')!;
    const corners = buildCorners(layout);
    expect(corners[Math.floor(dock.y)]![Math.floor(dock.x)]).toBe('grass');
    expect(corners[Math.floor(dock.y) - 2]![Math.floor(dock.x)]).toBe('water');
  });

  it('keeps the stepping stones free to walk on', () => {
    const stones = layout.objects.filter(({ id }) => id.startsWith('path_stone'));
    expect(stones.length).toBeGreaterThan(0);
    for (const stone of stones) {
      const inside = obstacles.filter(
        (rect) =>
          stone.x * 32 >= rect.x &&
          stone.x * 32 <= rect.x + rect.width &&
          stone.y * 32 >= rect.y &&
          stone.y * 32 <= rect.y + rect.height,
      );
      expect(inside, `stone at ${stone.x},${stone.y}`).toEqual([]);
    }
  });

  it('keeps the stepping stones away from where Gio sits', () => {
    const seat = layout.objects.find(({ id }) => id === 'gio_seat')!;
    for (const stone of layout.objects.filter(({ id }) => id.startsWith('path_stone'))) {
      expect(Math.hypot(stone.x - seat.x, stone.y - seat.y)).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('keeps every small rock at least a tile away from the stepping stones', () => {
    const stones = layout.objects.filter(({ id }) => id.startsWith('path_stone'));
    const rocks = layout.objects
      .filter(({ id }) => id.startsWith('rock_small'))
      .filter(
        (rock) =>
          !layout.blockers.some(
            (area) =>
              rock.x >= area.x && rock.x <= area.x + area.width && rock.y >= area.y && rock.y <= area.y + area.height,
          ),
      );
    for (const rock of rocks) {
      for (const stone of stones) {
        expect(Math.hypot(rock.x - stone.x, rock.y - stone.y), `rock at ${rock.x},${rock.y}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('leaves a wide walkway between the meadow fence and the pond', () => {
    const wideBody = { width: 28, height: 16 };
    const start = { x: 17.2 * 32, y: 15 * 32 };
    const goal = { x: 17.9 * 32, y: 21.5 * 32 };
    expect(canReach(start, goal, obstacles, world, wideBody, 8)).toBe(true);
  });

  it('has a price sign for each of the 3 land plots', () => {
    const signs = layout.objects.filter(({ id }) => id === 'land_sale_sign');
    expect(signs.map(({ plot }) => plot)).toEqual([0, 1, 2]);
  });

  it('places every object from the registry and none from the retired set', () => {
    const retired = ['tree_pink', 'tree_blossom', 'cave', 'burrow', 'stone_gate', 'bush', 'rock', 'flowers', 'stairs_cliff'];
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

  it('has no shadow anywhere in the map data', () => {
    expect(JSON.stringify(layout)).not.toContain('shadow');
    expect(JSON.stringify(tiled)).not.toContain('shadow');
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
